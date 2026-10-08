'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decode, parseTime, calculate, today, rollBaseline } = require('../lib/alphaess');
const { REGISTER_STATES, pvStringStates } = require('../lib/registers');

// Raw register snapshot taken from a SMILE-T10-HV + BAT-8.2P
const RAW = {
    0x0010: 32, 0x0011: 24902, 0x0012: 10, 0x0013: 7798, 0x001a: 4999,
    0x0021: 65535, 0x0022: 65526, 0x0100: 2676, 0x0102: 1000, 0x0107: 3344, 0x010a: 3349,
    0x0120: 1, 0x0121: 2501, 0x0122: 0, 0x0123: 63448, 0x0126: 0, 0x040c: 0, 0x040d: 350,
    0x041d: 3980, 0x041e: 6, 0x041f: 0, 0x0420: 238, 0x0421: 2600, 0x0422: 4, 0x0423: 0, 0x0424: 104,
    0x043e: 5, 0x043f: 48348, 0x0435: 360, 0x0856: 15, 0x085e: 0,
    0x064a: 12593, 0x064b: 13378, 0x064c: 17968, 0x064d: 12850, 0x064e: 14642, 0x064f: 13616, 0x0650: 12855, 0x0651: 13056,
};
const regs = new Map(Object.entries(RAW).map(([k, v]) => [Number(k), v]));
const defs = Object.fromEntries([...REGISTER_STATES, ...pvStringStates(2)].map(d => [d.id, d]));
const val = id => decode(defs[id], regs);

test('decodes scaled and signed values', () => {
    assert.strictEqual(val('energy.total.grid_feed_in'), 21220.54);
    assert.strictEqual(val('energy.total.grid_consumption'), 6631.58);
    assert.strictEqual(val('energy.total.pv'), 37602.8);
    assert.strictEqual(val('grid.power'), -10);
    assert.strictEqual(val('grid.frequency'), 49.99);
    assert.strictEqual(val('battery.soc'), 100);
    assert.strictEqual(val('battery.voltage'), 267.6);
    assert.strictEqual(val('battery.cells.min_voltage'), 3.344);
    assert.strictEqual(val('inverter.temperature'), 36);
    assert.strictEqual(val('pv.string1.power'), 238);
});

test('decodes strings and times', () => {
    assert.strictEqual(val('device.inverter_sn'), '114BF0229250273');
    assert.strictEqual(val('settings.charge.window1_start'), '15:00');
    assert.strictEqual(val('battery.soh'), null); // missing register
});

test('parses times', () => {
    assert.deepStrictEqual(parseTime('7:30'), [7, 30]);
    assert.deepStrictEqual(parseTime('23:45'), [23, 45]);
    assert.strictEqual(parseTime('24:00'), null);
    assert.strictEqual(parseTime('abc'), null);
});

test('calculates power flow', () => {
    const v = {};
    for (const id of Object.keys(defs)) {
        const x = val(id);
        if (x !== null) v[id] = x;
    }
    const c = calculate(v, 2);
    assert.strictEqual(c['pv.power'], 342);
    assert.strictEqual(c['overview.load_power'], 340); // inverter 350 + grid -10
    assert.strictEqual(c['overview.grid_export'], 10);
    assert.strictEqual(c['overview.grid_import'], 0);
    assert.strictEqual(c['overview.autarky'], 100);
    assert.strictEqual(c['battery.cells.voltage_spread'], 5);
});

test('calculates daily energy', () => {
    const base = { pv: 100, grid_feed_in: 50, grid_consumption: 20, battery_charge: 10, battery_discharge: 5 };
    const now = { pv: 110, grid_feed_in: 52, grid_consumption: 23, battery_charge: 13, battery_discharge: 8 };
    const d = today(now, base);
    assert.strictEqual(d['energy.today.pv'], 10);
    assert.strictEqual(d['energy.today.consumption'], 11); // 10 + 3 - 2 + 3 - 3
    assert.strictEqual(d['energy.today.autarky'], 72.7);
    assert.strictEqual(d['energy.today.self_consumption'], 80);
});

test('daily baseline: first start counts from now', () => {
    const now = new Date(2026, 9, 6, 18, 22);
    const b = rollBaseline(null, { pv: 100 }, now);
    assert.deepStrictEqual(b.totals, { pv: 100 });
    assert.strictEqual(b.since, now.getTime());
});

test('daily baseline: same day keeps baseline', () => {
    const b = { date: '2026-10-06', totals: { pv: 100 }, since: 1 };
    assert.strictEqual(rollBaseline(b, { pv: 120 }, new Date(2026, 9, 6, 22, 0)), b);
});

test('daily baseline: new day starts from yesterday\'s last counters (complete day)', () => {
    const b = { date: '2026-10-06', totals: { pv: 100 }, since: 1, last: { date: '2026-10-06', totals: { pv: 130 } } };
    // adapter restarted at 08:00, was off over midnight - day still counted from midnight
    const now = new Date(2026, 9, 7, 8, 0);
    const n = rollBaseline(b, { pv: 131 }, now);
    assert.deepStrictEqual(n.totals, { pv: 130 });
    assert.strictEqual(n.since, new Date(2026, 9, 7).getTime());
    assert.strictEqual(n.date, '2026-10-07');
});

test('daily baseline: older than yesterday counts from now', () => {
    const b = { date: '2026-10-01', totals: { pv: 10 }, since: 1, last: { date: '2026-10-01', totals: { pv: 20 } } };
    const now = new Date(2026, 9, 7, 8, 0);
    const n = rollBaseline(b, { pv: 90 }, now);
    assert.deepStrictEqual(n.totals, { pv: 90 });
    assert.strictEqual(n.since, now.getTime());
});

test('combines warning and fault registers into an alarm', () => {
    const ok = { 'battery.warning': 0, 'battery.fault': 0, 'inverter.warning_1': 0, 'inverter.fault_1': 0, 'inverter.work_mode': 1 };
    assert.strictEqual(calculate(ok, 2)['overview.alarm'], 0);
    assert.strictEqual(calculate(ok, 2)['overview.alarm_text'], '');
    const warn = calculate({ ...ok, 'battery.warning': 4 }, 2);
    assert.strictEqual(warn['overview.alarm'], 1);
    assert.strictEqual(warn['overview.alarm_text'], 'Battery warning: Discharge low temperature (0x4)');
    const fault = calculate({ ...ok, 'battery.warning': 4, 'inverter.fault_1': 0x100 }, 2);
    assert.strictEqual(fault['overview.alarm'], 2);
    assert.strictEqual(
        fault['overview.alarm_text'],
        'Battery warning: Discharge low temperature (0x4), Inverter fault: gfci fault (0x100)',
    );
    // several bits, reserved bit
    assert.strictEqual(
        calculate({ ...ok, 'battery.warning': 0x80000081 }, 2)['overview.alarm_text'],
        'Battery warning: Temperature imbalance, Cell low voltage, bit 31 (0x80000081)',
    );
    assert.strictEqual(calculate({ ...ok, 'inverter.work_mode': 4 }, 2)['overview.alarm'], 2);
    // decoded from the raw registers (32 bit)
    const r = new Map([[0x011c, 0x0001], [0x011d, 0x0002]]);
    assert.strictEqual(decode(defs['battery.warning'], r), 0x10002);
});
