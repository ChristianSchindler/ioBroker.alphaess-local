'use strict';

const ModbusRTU = require('modbus-serial');

/**
 * Small Modbus TCP client for AlphaESS inverters.
 * Tries every configured host in order and remembers the one that answered.
 */
class AlphaEssClient {
    /**
     * @param {object} options
     * @param {string[]} options.hosts   IP addresses / host names, first = preferred
     * @param {number} [options.port]
     * @param {number} [options.unitId]
     * @param {number} [options.timeout] ms
     * @param {{debug: Function, info: Function, warn: Function}} [options.log]
     */
    constructor({ hosts, port = 502, unitId = 85, timeout = 3000, log = console }) {
        this.hosts = hosts.filter(Boolean);
        this.port = port;
        this.unitId = unitId;
        this.timeout = timeout;
        this.log = log;
        this.client = null;
        this.host = null;
    }

    get connected() {
        return !!(this.client && this.client.isOpen);
    }

    async connect() {
        if (this.connected) {
            return this.host;
        }
        // Try the last working host first, then all others
        const order = this.host ? [this.host, ...this.hosts.filter(h => h !== this.host)] : this.hosts;
        const errors = [];
        for (const host of order) {
            const client = new ModbusRTU();
            try {
                await withTimeout(client.connectTCP(host, { port: this.port }), this.timeout, 'connect timeout');
                client.setID(this.unitId);
                client.setTimeout(this.timeout);
                // Probe: battery SOC must be readable, otherwise this is not an AlphaESS
                await client.readHoldingRegisters(0x0102, 1);
                if (this.host && this.host !== host) {
                    this.log.warn(`Inverter not reachable at ${this.host}, switched to ${host}`);
                }
                this.client = client;
                this.host = host;
                return host;
            } catch (e) {
                errors.push(`${host}: ${e.message || e}`);
                await closeQuietly(client);
            }
        }
        throw new Error(`No inverter reachable (${errors.join('; ')})`);
    }

    async close() {
        if (this.client) {
            await closeQuietly(this.client);
            this.client = null;
        }
    }

    /**
     * Read a block of holding registers.
     *
     * @returns {Promise<Map<number, number>>} address → raw 16 bit value
     */
    async readBlock(block) {
        try {
            const res = await this.client.readHoldingRegisters(block.start, block.length);
            const map = new Map();
            res.data.forEach((v, i) => map.set(block.start + i, v));
            return map;
        } catch (e) {
            if (isConnectionError(e)) {
                await this.close();
            }
            throw new Error(`Reading block ${block.id} (0x${block.start.toString(16)}) failed: ${e.message || e}`);
        }
    }

    async writeRegister(addr, value) {
        await this.connect();
        try {
            await this.client.writeRegister(addr, value);
        } catch (e) {
            if (isConnectionError(e)) {
                await this.close();
            }
            throw e;
        }
    }
}

function isConnectionError(e) {
    // Modbus exceptions (illegal address etc.) carry a modbusCode, everything else is a transport problem
    return !(e && typeof e.modbusCode === 'number');
}

function withTimeout(promise, ms, message) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

function closeQuietly(client) {
    // destroy() instead of close(): close() only half-closes the socket and the inverter
    // keeps it open for ~2 minutes, which blocks the next connection.
    return new Promise(resolve => {
        const timer = setTimeout(resolve, 500);
        try {
            client.destroy(() => {
                clearTimeout(timer);
                resolve();
            });
        } catch {
            clearTimeout(timer);
            resolve();
        }
    });
}

/**
 * Decode one state definition from a register map.
 *
 * @returns {number|string|null} null when registers are missing
 */
function decode(def, regs) {
    const get = a => regs.get(a);
    const scale = v => round(v * (def.scale || 1), decimals(def.scale));

    switch (def.type) {
        case 'uint16': {
            const v = get(def.addr);
            return v === undefined ? null : scale(v);
        }
        case 'int16': {
            const v = get(def.addr);
            return v === undefined ? null : scale(v >= 0x8000 ? v - 0x10000 : v);
        }
        case 'uint32':
        case 'int32': {
            const hi = get(def.addr);
            const lo = get(def.addr + 1);
            if (hi === undefined || lo === undefined) {
                return null;
            }
            let v = hi * 0x10000 + lo;
            if (def.type === 'int32' && v >= 0x80000000) {
                v -= 0x100000000;
            }
            return scale(v);
        }
        case 'string': {
            let s = '';
            for (let i = 0; i < def.words; i++) {
                const v = get(def.addr + i);
                if (v === undefined) {
                    return null;
                }
                s += String.fromCharCode(v >> 8, v & 0xff);
            }
            return s.replace(/\0/g, '').trim();
        }
        case 'time': {
            const h = get(def.addr);
            const m = get(def.minuteAddr);
            if (h === undefined || m === undefined) {
                return null;
            }
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
        default:
            throw new Error(`Unknown register type ${def.type}`);
    }
}

/** Parse "HH:MM" → [hour, minute] or null */
function parseTime(text) {
    const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(text));
    if (!m) {
        return null;
    }
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h < 24 && min < 60 ? [h, min] : null;
}

function decimals(scale) {
    if (!scale || scale >= 1) {
        return 0;
    }
    return Math.round(-Math.log10(scale));
}

function round(v, d = 0) {
    const f = 10 ** d;
    return Math.round(v * f) / f;
}

/**
 * Compute overview / summary values from the decoded register values.
 *
 * @param {Record<string, any>} v decoded values by state id
 * @param {number} pvStrings
 */
function calculate(v, pvStrings) {
    const out = {};
    let pv = 0;
    for (let n = 1; n <= pvStrings; n++) {
        pv += v[`pv.string${n}.power`] || 0;
    }
    out['pv.power'] = pv;

    const grid = v['grid.power'];
    const bat = v['battery.power'];
    const inv = v['inverter.power'];
    if (grid != null && inv != null) {
        // House = what the inverter delivers on AC + what comes from the grid
        const load = Math.max(0, inv + grid);
        out['overview.load_power'] = load;
        out['overview.grid_power'] = grid;
        out['overview.grid_import'] = Math.max(0, grid);
        out['overview.grid_export'] = Math.max(0, -grid);
        out['overview.autarky'] = load > 0 ? round(Math.max(0, 100 * (1 - Math.max(0, grid) / load)), 1) : 100;
        out['overview.self_consumption'] = pv > 0 ? round(Math.max(0, 100 * (1 - Math.max(0, -grid) / pv)), 1) : 100;
    }
    out['overview.pv_power'] = pv;
    if (bat != null) {
        out['overview.battery_power'] = bat;
        out['overview.battery_charge'] = Math.max(0, -bat);
        out['overview.battery_discharge'] = Math.max(0, bat);
    }
    if (v['battery.soc'] != null) {
        out['overview.battery_soc'] = v['battery.soc'];
    }
    if (v['battery.cells.max_voltage'] != null && v['battery.cells.min_voltage'] != null) {
        out['battery.cells.voltage_spread'] = Math.round((v['battery.cells.max_voltage'] - v['battery.cells.min_voltage']) * 1000);
    }
    const t = totals(v);
    if (t) {
        out['energy.total.consumption'] = round(houseEnergy(t), 2);
    }
    return out;
}

const TOTAL_KEYS = {
    pv: 'energy.total.pv',
    grid_feed_in: 'energy.total.grid_feed_in',
    grid_consumption: 'energy.total.grid_consumption',
    battery_charge: 'energy.total.battery_charge',
    battery_discharge: 'energy.total.battery_discharge',
};

/** Extract lifetime counters, or null if any is missing */
function totals(v) {
    const t = {};
    for (const [k, id] of Object.entries(TOTAL_KEYS)) {
        if (v[id] == null) {
            return null;
        }
        t[k] = v[id];
    }
    return t;
}

function houseEnergy(t) {
    return Math.max(0, t.pv + t.grid_consumption - t.grid_feed_in + t.battery_discharge - t.battery_charge);
}

/**
 * Daily energy values = current lifetime counters − counters at midnight.
 *
 * @param {Record<string, number>} t current totals
 * @param {Record<string, number>} base totals at start of day
 */
function today(t, base) {
    const d = {};
    for (const k of Object.keys(TOTAL_KEYS)) {
        d[k] = round(Math.max(0, t[k] - base[k]), 2);
    }
    const consumption = round(houseEnergy(d), 2);
    return {
        'energy.today.pv': d.pv,
        'energy.today.grid_feed_in': d.grid_feed_in,
        'energy.today.grid_consumption': d.grid_consumption,
        'energy.today.battery_charge': d.battery_charge,
        'energy.today.battery_discharge': d.battery_discharge,
        'energy.today.consumption': consumption,
        'energy.today.autarky': consumption > 0 ? round(Math.max(0, 100 * (1 - d.grid_consumption / consumption)), 1) : 100,
        'energy.today.self_consumption': d.pv > 0 ? round(Math.max(0, 100 * (1 - d.grid_feed_in / d.pv)), 1) : 100,
    };
}

/** Local calendar date "YYYY-MM-DD" */
function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Counter values the daily energy is measured against.
 *
 * The inverter only has lifetime counters, so "today" = counter now − counter at midnight.
 * `last` holds the most recent counters seen (persisted regularly). On a day change the
 * last counters of the previous day become the new baseline - this keeps the day complete
 * even if the adapter was not running exactly at midnight.
 *
 * @param {{date: string, totals: object, since: number, last?: {date: string, totals: object}} | null} baseline
 * @param {object} t current totals
 * @param {Date} [now]
 * @returns baseline valid for the current day (same object if unchanged)
 */
function rollBaseline(baseline, t, now = new Date()) {
    const date = localDate(now);
    if (baseline && baseline.date === date && baseline.totals) {
        return baseline;
    }
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (baseline && baseline.last && baseline.last.date === yesterday && baseline.last.totals) {
        // complete day: start from yesterday's final counters
        return { date, totals: baseline.last.totals, since: midnight.getTime() };
    }
    // first run, or adapter was off for more than a day: count from now
    return { date, totals: t, since: now.getTime() };
}

module.exports = { AlphaEssClient, decode, parseTime, calculate, totals, today, localDate, rollBaseline };
