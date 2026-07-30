import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const resolvePath = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  /* Relative asset URLs. Required so the same `dist/` works from GitHub Pages
     (served under /wayfarer-zero/), from a plain local http server, and from
     file://. An absolute base breaks two of those three. */
  base: './',

  resolve: {
    // Mirrors tsconfig `paths`. Both must be edited together.
    alias: {
      '@core': resolvePath('./src/core'),
      '@game': resolvePath('./src/game'),
      '@content': resolvePath('./src/content'),
    },
  },

  /* Phaser's ESM entry (dist/phaser.esm.js) is ~8.8 MB unminified. Without an
     explicit pre-bundle the dev server stalls on cold start and then triggers a
     surprise full-page reload the first time a scene imports it. */
  optimizeDeps: {
    include: ['phaser'],
  },

  build: {
    target: 'es2023',
    sourcemap: true,
  },

  server: {
    port: 5190,
    host: true,
    strictPort: true,
  },
});
