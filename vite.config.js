import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './'  -> relative asset URLs, so one build works on
// https://<user>.github.io/<repo>/, a custom domain, or file:// (double-click dist/index.html).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true, hmr: { protocol: 'wss', clientPort: 443 } },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    cssMinify: true,
    reportCompressedSize: true,
    rollupOptions: { output: { manualChunks: { vendor: ['react', 'react-dom', 'zustand', 'immer', 'zod', 'dexie', 'motion'] } } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{js,jsx}'],
    setupFiles: ['tests/unit/setup.js'],
  },
});
