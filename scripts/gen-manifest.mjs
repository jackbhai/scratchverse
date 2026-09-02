// Generates dist/manifest.webmanifest + dist/404.html after the Vite build.
// 404.html lets GitHub Pages serve the SPA for any deep link.
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const manifest = {
  name: 'ScratchVerse — Premium Scratch Arcade',
  short_name: 'ScratchVerse',
  description: 'Scratch cards, win coins, level up. 100% offline, data stored on your device.',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#05070b',
  theme_color: '#05070b',
  categories: ['games', 'entertainment'],
  icons: [
    { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

try {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  manifest.version = pkg.version;
} catch {}

writeFileSync(resolve(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
writeFileSync(resolve(dist, '404.html'), readFileSync(resolve(dist, 'index.html'), 'utf8').replace('<title>', '<title>404 · '));
console.log('✓ manifest.webmanifest + 404.html written to dist/');
