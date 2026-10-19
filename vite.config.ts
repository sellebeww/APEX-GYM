import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, '.'),
    },
  },
  test: {
    // Playwright specs live in tests/e2e and run with `npm run test:e2e`
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep heavy, rarely-changing libraries in their own long-cacheable chunks
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('motion')) return 'motion';
          if (id.includes('react')) return 'react';
          if (id.includes('qrcode') || id.includes('canvas-confetti')) return 'extras';
          return undefined;
        },
      },
    },
  },
  server: {
    // API runs separately (npm run dev:server); same-origin proxy keeps cookies and CSRF checks identical to production
    proxy: { '/api': 'http://127.0.0.1:8787' },
    // Set DISABLE_HMR=true to turn off hot reload and file watching (e.g. in hosted sandboxes)
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
