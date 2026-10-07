// Sets the adapter version in package.json, io-package.json (incl. changelog "news"), src-widgets/package.json and both lock files.
// Usage: node scripts/set-version.mjs <x.y.z> "<changelog text>"
import { readFileSync, writeFileSync } from 'node:fs';

const [version, news = 'Maintenance release'] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
    console.error('Usage: node scripts/set-version.mjs <x.y.z> "<changelog text>"');
    process.exit(1);
}

const edit = (file, fn) => {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    fn(json);
    writeFileSync(file, `${JSON.stringify(json, null, 4)}\n`);
    console.log(`${file} → ${version}`);
};

const setPkg = p => (p.version = version);
const setLock = l => {
    l.version = version;
    if (l.packages?.['']) {
        l.packages[''].version = version;
    }
};
edit('package.json', setPkg);
edit('package-lock.json', setLock);
edit('src-widgets/package.json', setPkg);
edit('src-widgets/package-lock.json', setLock);
edit('io-package.json', p => {
    if (p.common.news?.[version] && p.common.version === version) {
        return; // already set (re-run of a release)
    }
    p.common.version = version;
    // vis-2 always loads the widget entry from the same URL and the browser caches it, so after an update the old
    // widget kept running until Ctrl+F5. The version in the query makes every release a new URL.
    Object.values(p.common.visWidgets || {}).forEach(set => {
        set.url = `${set.url.split('?')[0]}?v=${version}`;
    });
    // newest entry first, ioBroker shows at most 20
    const entries = Object.entries(p.common.news || {}).filter(([v]) => v !== version);
    p.common.news = Object.fromEntries([[version, { en: news, de: news }], ...entries].slice(0, 20));
});
