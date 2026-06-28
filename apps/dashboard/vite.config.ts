import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Static SPA — built off-box, served as static files by nginx (docs/ARCHITECTURE.md §7).
// NOT Next.js SSR: SSR is too heavy for the 512 MB VPS.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Dev-only: forward API calls to the local gateway.
      '/health': 'http://localhost:3000',
      '/v1': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
