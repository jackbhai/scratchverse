import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './'  -> relative asset paths, so the build works on
// https://<user>.github.io/<repo>/ OR any custom domain with zero config.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: { protocol: 'wss', clientPort: 443 },
  },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  build: {
    target: 'es2019',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
