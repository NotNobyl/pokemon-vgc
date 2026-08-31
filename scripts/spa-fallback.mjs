/**
 * SPA deep-link fallback for static hosts (GitHub Pages, etc.).
 * Copies dist/index.html to dist/404.html so hard-refreshing a client-side
 * route (e.g. /meta) serves the app instead of a host 404.
 * Also adds .nojekyll so GitHub Pages serves the /assets folder correctly.
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '..', 'dist');

copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
writeFileSync(resolve(dist, '.nojekyll'), '');
console.log('SPA fallback: wrote dist/404.html and dist/.nojekyll');
