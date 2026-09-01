// Copies the self-hosted variable weights from @fontsource into public/fonts (offline-first).
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/fonts');
mkdirSync(OUT, { recursive: true });
const want = ['sora-latin-400-normal.woff2', 'sora-latin-600-normal.woff2', 'sora-latin-700-normal.woff2', 'sora-latin-800-normal.woff2',
  'manrope-latin-400-normal.woff2', 'manrope-latin-500-normal.woff2', 'manrope-latin-600-normal.woff2', 'manrope-latin-700-normal.woff2'];
let n = 0;
for (const pkg of ['sora', 'manrope']) {
  const dir = resolve(ROOT, 'node_modules/@fontsource', pkg, 'files');
  if (!existsSync(dir)) { console.log(`! ${pkg}: npm i -D @fontsource/${pkg}`); continue; }
  for (const f of readdirSync(dir)) if (want.includes(f)) { cpSync(resolve(dir, f), resolve(OUT, f)); n++; }
}
console.log(`✓ ${n} woff2 fonts in public/fonts (offline-first, no CDN)`);
