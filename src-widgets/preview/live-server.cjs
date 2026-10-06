// Dev helper: polls the inverter with the adapter's own library and serves the values as JSON
// for the widget preview.  node preview/live-server.cjs <host>
const http = require('node:http');
const { AlphaEssClient, decode, calculate, totals, today } = require('../../lib/alphaess');
const { BLOCKS, REGISTER_STATES, pvStringStates } = require('../../lib/registers');

if (!process.argv[2]) {
    console.error('Usage: node preview/live-server.cjs <inverter-ip>');
    process.exit(1);
}
const client = new AlphaEssClient({ hosts: [process.argv[2]] });
const defs = [...REGISTER_STATES, ...pvStringStates(2)];
const regs = new Map();
let values = {};
let baseline = null;
let connected = false;

async function poll() {
    try {
        await client.connect();
        for (const b of BLOCKS.filter(b => b.poll === 'fast')) {
            (await client.readBlock(b)).forEach((v, a) => regs.set(a, v));
        }
        const v = {};
        defs.forEach(d => (v[d.id] = decode(d, regs)));
        Object.assign(v, calculate(v, 2));
        const t = totals(v);
        // No midnight counters here: pretend the day started with 1 kWh less on every counter
        baseline ||= Object.fromEntries(Object.entries(t).map(([k, x]) => [k, x - 1.3]));
        Object.assign(v, today(t, baseline));
        v['info.connection'] = true;
        values = v;
        connected = true;
    } catch (e) {
        connected = false;
        values['info.connection'] = false;
        console.error(e.message);
    }
}
setInterval(poll, 1000);
poll();

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ connected, values }));
}).listen(8899, () => console.log('live values on http://localhost:8899'));
