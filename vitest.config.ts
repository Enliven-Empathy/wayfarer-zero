import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolvePath = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Two projects, deliberately.
 *
 * `core` runs in a **Node** environment with no DOM. That is a second,
 * free enforcement of the core-purity rule: Phaser's device detection runs at
 * module-init and touches `document`, so anything under src/core that
 * transitively reaches Phaser fails at import time rather than silently
 * working. The static scan in tests/guards catches type-only leaks (which
 * erase at runtime); the Node environment catches value leaks. Together they
 * cover both halves.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@core': resolvePath('./src/core'),
      '@game': resolvePath('./src/game'),
      '@content': resolvePath('./src/content'),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@core': resolvePath('./src/core'),
            '@game': resolvePath('./src/game'),
            '@content': resolvePath('./src/content'),
          },
        },
        test: {
          name: 'core',
          environment: 'node',
          include: ['tests/core/**/*.test.ts', 'tests/guards/**/*.test.ts', 'tests/smoke/**/*.test.ts'],
        },
      },
      {
        resolve: {
          alias: {
            '@core': resolvePath('./src/core'),
            '@game': resolvePath('./src/game'),
            '@content': resolvePath('./src/content'),
          },
        },
        test: {
          name: 'game',
          environment: 'jsdom',
          include: ['tests/game/**/*.test.ts'],
        },
      },
    ],
  },
});
