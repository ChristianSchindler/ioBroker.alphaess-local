'use strict';

const utils = require('@iobroker/adapter-core');
const { AlphaEssClient, decode, parseTime, calculate, totals, today, rollBaseline } = require('./lib/alphaess');
const { BLOCKS, CHANNELS, REGISTER_STATES, CALCULATED_STATES, pvStringStates } = require('./lib/registers');

const MIN_POLL_SECONDS = 0.2; // 5 polls per second

class AlphaEssLocal extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'alphaess-local' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));

        this.client = null;
        this.pollTimer = null;
        this.stopped = false;
        this.registers = new Map(); // address → raw value (cache of all blocks)
        this.defs = []; // register based state definitions
        this.defsById = new Map();
        this.lastSlowPoll = 0;
        this.onceDone = false;
        this.baseline = null; // { date, totals, since, last } for daily energy, see rollBaseline()
        this.baselineSaved = 0;
        this.errorLogged = false;
        this.writeQueue = Promise.resolve();
    }

    async onReady() {
        const c = this.config;
        const hosts = [c.host, ...String(c.fallbackHosts || '').split(/[,;\s]+/)].map(h => (h || '').trim()).filter(Boolean);
        if (!hosts.length) {
            this.log.error('No inverter IP address configured - please open the instance settings');
            return;
        }
        this.pollSeconds = Math.max(MIN_POLL_SECONDS, Number(c.pollInterval) || 5);
        this.slowSeconds = Math.max(10, Number(c.slowPollInterval) || 60);
        this.pvStrings = Math.min(6, Math.max(1, Number(c.pvStrings) || 2));

        this.defs = [...REGISTER_STATES, ...pvStringStates(this.pvStrings)];
        this.defs.forEach(d => this.defsById.set(d.id, d));

        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.pollInterval', this.pollSeconds, true);
        await this.createObjects();
        await this.restoreBaseline();

        this.client = new AlphaEssClient({
            hosts,
            port: Number(c.port) || 502,
            unitId: Number(c.unitId) || 85,
            timeout: Number(c.timeout) || 3000,
            log: this.log,
        });

        this.subscribeStates('settings.*');
        this.subscribeStates('info.pollInterval');
        this.log.info(`Polling ${hosts.join(' → ')} every ${this.pollSeconds} s (settings every ${this.slowSeconds} s)`);
        this.poll();
    }

    // ---------- objects ----------

    async createObjects() {
        for (const [id, name] of Object.entries(CHANNELS)) {
            await this.extendObjectAsync(id, { type: 'channel', common: { name }, native: {} });
        }
        for (const def of this.defs) {
            const writable = !!def.write && !!this.config.enableControl;
            const isText = def.type === 'string' || def.type === 'time';
            const common = {
                name: def.name,
                type: isText ? 'string' : 'number',
                role: writable ? def.role : def.role.replace(/^level/, 'value'),
                read: true,
                write: writable,
            };
            if (def.unit) {
                common.unit = def.unit;
            }
            if (def.states) {
                common.states = def.states;
            }
            if (def.min !== undefined) {
                common.min = def.min;
                common.max = def.max;
            }
            await this.extendObjectAsync(def.id, { type: 'state', common, native: { address: hex(def.addr), type: def.type } });
        }
        for (const def of CALCULATED_STATES) {
            await this.extendObjectAsync(def.id, {
                type: 'state',
                common: { name: def.name, type: 'number', role: def.role, unit: def.unit, read: true, write: false },
                native: { calculated: true },
            });
        }
        // Remove PV strings that are no longer configured
        for (let n = this.pvStrings + 1; n <= 6; n++) {
            await this.delObjectAsync(`pv.string${n}`, { recursive: true }).catch(() => {});
        }
    }

    // ---------- polling ----------

    async poll() {
        if (this.stopped) {
            return;
        }
        const started = Date.now();
        try {
            const host = await this.client.connect();
            const now = Date.now();
            const slow = now - this.lastSlowPoll >= this.slowSeconds * 1000;
            for (const block of BLOCKS) {
                if (block.poll === 'fast' || (block.poll === 'slow' && slow) || (block.poll === 'once' && !this.onceDone)) {
                    const regs = await this.client.readBlock(block);
                    regs.forEach((v, a) => this.registers.set(a, v));
                }
            }
            if (slow) {
                this.lastSlowPoll = now;
            }
            const firstRun = !this.onceDone;
            this.onceDone = true;

            await this.publish(firstRun || slow);

            await this.setStateChangedAsync('info.connection', true, true);
            await this.setStateChangedAsync('info.host', host, true);
            await this.setStateAsync('info.lastUpdate', Date.now(), true);
            await this.setStateChangedAsync('info.pollDuration', Date.now() - started, true);
            if (this.errorLogged) {
                this.log.info(`Connection to inverter ${host} restored`);
                this.errorLogged = false;
            }
        } catch (e) {
            await this.setStateChangedAsync('info.connection', false, true);
            if (!this.errorLogged) {
                this.log.warn(`Polling failed: ${e.message} - retrying`);
                this.errorLogged = true;
            } else {
                this.log.debug(`Polling failed: ${e.message}`);
            }
        }
        if (!this.stopped) {
            const delay = Math.max(100, this.pollSeconds * 1000 - (Date.now() - started));
            this.pollTimer = this.setTimeout(() => this.poll(), delay);
        }
    }

    /** Decode all register states, calculate derived values and write states */
    async publish(includeSlow) {
        const values = {};
        for (const def of this.defs) {
            const v = decode(def, this.registers);
            if (v !== null) {
                values[def.id] = v;
            }
        }
        Object.assign(values, calculate(values, this.pvStrings));

        const t = totals(values);
        if (t) {
            const next = rollBaseline(this.baseline, t);
            const newDay = next !== this.baseline;
            if (newDay) {
                this.log.info(`Daily energy counted from ${new Date(next.since).toLocaleString()}`);
            }
            this.baseline = next;
            this.baseline.last = { date: next.date, totals: t };
            // Persist on a new day and once a minute, so a restart (also over midnight) keeps the day complete
            if (newDay || Date.now() - this.baselineSaved > 60000) {
                await this.saveBaseline();
            }
            Object.assign(values, today(t, this.baseline.totals));
            values['energy.today.since'] = this.baseline.since ?? null;
        }

        const onlyChanged = this.config.updateOnlyChanged !== false;
        for (const [id, val] of Object.entries(values)) {
            const def = this.defsById.get(id);
            if (def && !includeSlow && isSlowState(def)) {
                continue;
            }
            if (onlyChanged) {
                await this.setStateChangedAsync(id, val, true);
            } else {
                await this.setStateAsync(id, val, true);
            }
        }
    }

    async restoreBaseline() {
        await this.extendObjectAsync('energy.today.baseline', {
            type: 'state',
            common: { name: 'Counter values at start of day (internal)', type: 'string', role: 'json', read: true, write: false, expert: true },
            native: {},
        });
        const st = await this.getStateAsync('energy.today.baseline');
        try {
            // Also an old one: rollBaseline() decides whether it is still usable
            this.baseline = st && st.val ? JSON.parse(String(st.val)) : null;
        } catch {
            this.baseline = null;
        }
    }

    async saveBaseline() {
        if (this.baseline) {
            this.baselineSaved = Date.now();
            await this.setStateAsync('energy.today.baseline', JSON.stringify(this.baseline), true);
        }
    }

    // ---------- writing ----------

    async onStateChange(id, state) {
        if (!state || state.ack) {
            return;
        }
        const localId = id.substring(this.namespace.length + 1);

        if (localId === 'info.pollInterval') {
            const sec = Number(state.val);
            if (sec >= MIN_POLL_SECONDS) {
                this.pollSeconds = sec;
                this.log.info(`Poll interval changed to ${sec} s`);
            }
            await this.setStateAsync('info.pollInterval', this.pollSeconds, true);
            return;
        }

        const def = this.defsById.get(localId);
        if (!def || !def.write) {
            return;
        }
        if (!this.config.enableControl) {
            this.log.warn(`Writing ${localId} ignored: "Enable control" is switched off in the instance settings`);
            return;
        }
        // Serialize writes, the inverter handles one request at a time
        this.writeQueue = this.writeQueue.then(() => this.writeSetting(def, state.val)).catch(() => {});
    }

    async writeSetting(def, val) {
        try {
            if (def.type === 'time') {
                const t = parseTime(val);
                if (!t) {
                    throw new Error(`"${val}" is not a valid time (HH:MM)`);
                }
                await this.client.writeRegister(def.addr, t[0]);
                await this.client.writeRegister(def.minuteAddr, t[1]);
            } else {
                const n = Math.round(Number(val));
                if (!Number.isFinite(n) || n < def.min || n > def.max) {
                    throw new Error(`value ${val} out of range ${def.min}..${def.max}`);
                }
                await this.client.writeRegister(def.addr, n);
            }
            this.log.info(`Wrote ${def.id} = ${val}`);
        } catch (e) {
            this.log.error(`Writing ${def.id} failed: ${e.message}`);
        }
        // Read back the real value from the inverter
        try {
            for (const block of BLOCKS.filter(b => b.poll === 'slow')) {
                const regs = await this.client.readBlock(block);
                regs.forEach((v, a) => this.registers.set(a, v));
            }
            const v = decode(def, this.registers);
            if (v !== null) {
                await this.setStateAsync(def.id, v, true);
            }
        } catch (e) {
            this.log.warn(`Read-back of ${def.id} failed: ${e.message}`);
        }
    }

    // ---------- shutdown ----------

    async onUnload(callback) {
        try {
            this.stopped = true;
            if (this.pollTimer) {
                this.clearTimeout(this.pollTimer);
            }
            if (this.client) {
                await this.client.close();
            }
            await this.saveBaseline();
            await this.setStateAsync('info.connection', false, true);
        } finally {
            callback();
        }
    }
}

function isSlowState(def) {
    return def.id.startsWith('settings.') || def.id.startsWith('device.');
}


function hex(addr) {
    return addr === undefined ? undefined : `0x${addr.toString(16).toUpperCase().padStart(4, '0')}`;
}

if (require.main !== module) {
    module.exports = options => new AlphaEssLocal(options);
} else {
    new AlphaEssLocal();
}
