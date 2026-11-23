import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-electron');

await fs.mkdir(OUT_DIR, { recursive: true });

await Promise.all([
  build({
    entryPoints: [path.join(ROOT, 'electron', 'main.ts')],
    outfile: path.join(OUT_DIR, 'main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron', 'electron-updater'],
    sourcemap: false,
  }),
  build({
    entryPoints: [path.join(ROOT, 'electron', 'preload.ts')],
    outfile: path.join(OUT_DIR, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron'],
    sourcemap: false,
  }),
]);

console.log('Built Electron main & preload into dist-electron/');
