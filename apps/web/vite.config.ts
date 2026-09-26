/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
      '/sitemap.xml': { target: 'http://localhost:4000', rewrite: () => '/api/sitemap.xml', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The lazily-loaded 3D scene is ~300 kB gzipped by nature; everything else stays small.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // three.js is deliberately left out: it only arrives through the lazy HeroScene import,
        // so it is never part of the initial load (forcing it into a manual chunk would make the
        // entry depend on it via shared helpers).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(three|@react-three|three-stdlib|@monogrid|troika|meshline|camera-controls|maath|suspend-react|its-fine|react-reconciler|zustand\/esm\/traditional)/.test(id)) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'react';
          if (/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id)) return 'motion';
          if (/node_modules\/(@tanstack|socket\.io-client|engine\.io-client|socket\.io-parser|zod|@hookform|react-hook-form)\//.test(id)) return 'data';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
