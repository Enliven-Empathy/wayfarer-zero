import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * Pins the locked stack from the bible's §21 table.
 *
 * Deliberately reads package metadata rather than `import`ing Phaser: this
 * suite runs in the `core` Node project with no DOM, and importing Phaser here
 * would defeat the point of that environment.
 *
 * The bible names Phaser 4.1.0; 4.2.1 is the current stable 4.x and is what we
 * pin. The assertion is on the major line, so a patch bump does not break the
 * build while a jump to 5.x does.
 */
const require = createRequire(import.meta.url);

function version(pkg: string): string {
  return (require(`${pkg}/package.json`) as { version: string }).version;
}

describe('locked toolchain', () => {
  it('runs Phaser 4.x', () => {
    expect(version('phaser')).toMatch(/^4\./);
  });

  it('runs TypeScript 7.x', () => {
    expect(version('typescript')).toMatch(/^7\./);
  });

  it('runs Vite 8.x', () => {
    expect(version('vite')).toMatch(/^8\./);
  });

  it('runs on Node 22.12 or newer', () => {
    const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
    expect(major > 22 || (major === 22 && minor >= 12)).toBe(true);
  });
});
