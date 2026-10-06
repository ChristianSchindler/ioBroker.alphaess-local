// Copies the vite build output of src-widgets into widgets/alphaess-local (the folder vis-2 loads)
import { cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src-widgets', 'build');
const dest = join(root, 'widgets', 'alphaess-local');
if (!existsSync(src)) {
    throw new Error('src-widgets/build not found - run "npm run build" in src-widgets first');
}
rmSync(join(root, 'widgets'), { recursive: true, force: true });
cpSync(src, dest, { recursive: true, filter: f => !f.endsWith('index.html') });
console.log(`Widgets copied to ${dest}`);
