import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: { sourcemap: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': {
        target: process.env['WS_PROXY_TARGET'] ?? 'http://localhost:4000',
        ws: true,
      },
    },
  },
});
