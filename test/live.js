'use strict';
// Live test against a real inverter: node test/live.js <host> [fallbackHost...]
const { AlphaEssClient, decode, calculate, totals, today } = require('../lib/alphaess');
const { BLOCKS, REGISTER_STATES, pvStringStates } = require('../lib/registers');

(async () => {
    const hosts = process.argv.slice(2);
    if (!hosts.length) {
        throw new Error('Usage: node test/live.js <inverter-ip> [fallback-ip...]');
    }
    const client = new AlphaEssClient({ hosts, timeout: 2000 });
    const t0 = Date.now();
    console.log('connected to', await client.connect(), `in ${Date.now() - t0} ms`);
    const regs = new Map();
    for (const block of BLOCKS) {
        const t = Date.now();
        const m = await client.readBlock(block);
        m.forEach((v, k) => regs.set(k, v));
        console.log(`block ${block.id.padEnd(12)} ${m.size} regs in ${Date.now() - t} ms`);
    }
    await client.close();
    const values = {};
    for (const def of [...REGISTER_STATES, ...pvStringStates(2)]) {
        values[def.id] = decode(def, regs);
    }
    Object.assign(values, calculate(values, 2));
    const t = totals(values);
    Object.assign(values, today(t, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v - 1]))));
    for (const id of Object.keys(values).sort()) {
        console.log(`  ${id.padEnd(40)} ${JSON.stringify(values[id])}`);
    }
})().catch(e => {
    console.error(e.message);
    process.exit(1);
});
