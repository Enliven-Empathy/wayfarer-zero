import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The single most important architectural rule in this project:
 * **`src/core` must never depend on Phaser.**
 *
 * Why a test and not a linter: `typescript-eslint` cannot run against
 * TypeScript 7 — TS 7.0 ships no programmatic API, and the support request was
 * closed as not-planned. Enforcing this with ESLint would mean carrying a
 * second TypeScript compiler in the lockfile purely to lint one rule.
 *
 * Why not tsconfig project references: a core-only tsconfig that omits Phaser
 * from `types` does *not* stop `import Phaser from 'phaser'` — under
 * `moduleResolution: bundler` the package still resolves through its `exports`
 * map. The `types` array only governs global/ambient inclusion.
 *
 * A source scan is ~100 dependency-free lines and runs inside `npm run check`.
 *
 * It makes several assertions, not one, because there is more than one way to
 * breach the boundary and an import scan alone catches only the obvious one.
 */

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CORE_DIR = path.join(ROOT, 'src', 'core');

/**
 * Every module specifier in a file: `from '…'`, `import '…'`, `import('…')`,
 * `require('…')`. Covers `import type …`, `export … from …` and `export * from`.
 */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

/**
 * A bare `Phaser.Something` reference.
 *
 * This is the hole an import-only scan misses, and it is a real one:
 * `phaser.d.ts` declares a **global** `Phaser` namespace *before* its
 * `declare module 'phaser'` block. So this compiles inside src/core with no
 * import statement anywhere in the file:
 *
 *     let r: Phaser.Geom.Rectangle;
 *
 * It erases at runtime, so the Node-environment test project cannot catch it
 * either. Only a source scan can.
 *
 * The lookbehind excludes member access (`foo.Phaser.x`) and identifiers that
 * merely end in "Phaser" (`MyPhaser.x`).
 */
const GLOBAL_PHASER_NS = /(?<![.\w$])Phaser\s*\./;

/**
 * `node:*` is forbidden in core too.
 *
 * The root tsconfig lists "node" in `types` because the test suite and the two
 * Vite config files genuinely read the filesystem. That would otherwise quietly
 * license core to reach for `node:fs`, which breaks the browser build in a way
 * no typecheck would catch. Forbidding the specifiers here is a tighter
 * guarantee than a second tsconfig project, for one array entry.
 */
const FORBIDDEN_PACKAGES = [/^phaser(\/|$)/, /^node:/];

/** Core may not import downstream layers either — the arrow points one way. */
const FORBIDDEN_LAYERS = ['/src/game/', '/src/scenes/', '@game/'];

/**
 * Blank out comments, and optionally string/template literals, so the scan
 * only ever looks at code.
 *
 * This is not fussiness. The first run of this guard failed on
 * `src/core/index.ts`, whose doc comment explains that core must not reference
 * `Phaser.` — the guard flagged its own documentation. A check that fires on
 * prose is a check people disable, so it has to read code and nothing else.
 *
 * Characters are replaced with spaces rather than deleted, so line and column
 * numbers in the violation report still point at the real source.
 */
function scrub(source: string, options: { strings: boolean }): string[] {
  const output: string[] = [];
  let inBlockComment = false;

  for (const raw of source.split('\n')) {
    let line = '';
    let i = 0;

    while (i < raw.length) {
      if (inBlockComment) {
        const end = raw.indexOf('*/', i);
        if (end === -1) {
          line += ' '.repeat(raw.length - i);
          i = raw.length;
        } else {
          line += ' '.repeat(end + 2 - i);
          i = end + 2;
          inBlockComment = false;
        }
        continue;
      }

      const pair = raw.slice(i, i + 2);
      if (pair === '/*') {
        inBlockComment = true;
        line += '  ';
        i += 2;
        continue;
      }
      if (pair === '//') {
        line += ' '.repeat(raw.length - i);
        break;
      }

      const ch = raw[i] ?? '';
      if (options.strings && (ch === '"' || ch === "'" || ch === '`')) {
        let j = i + 1;
        while (j < raw.length && raw[j] !== ch) {
          if (raw[j] === '\\') j += 1;
          j += 1;
        }
        const consumed = Math.min(j, raw.length - 1) - i + 1;
        line += ' '.repeat(consumed);
        i += consumed;
        continue;
      }

      line += ch;
      i += 1;
    }

    output.push(line);
  }

  return output;
}

function coreFiles(): string[] {
  return readdirSync(CORE_DIR, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => path.join(CORE_DIR, entry));
}

function rel(file: string): string {
  return path.relative(ROOT, file);
}

function explain(violations: string[]): string {
  return [
    '',
    'src/core must not depend on Phaser, on Node builtins, or on the game/scene layers.',
    'Dependency direction is one-way: content -> core -> game adapters -> scenes.',
    '',
    'Fix: move the engine-facing code into src/game/adapters/ and pass plain data',
    'into core (BodySample in, MotionCommand out). Core decides; adapters apply.',
    '',
    ...violations.map((v) => `  - ${v}`),
    '',
  ].join('\n');
}

describe('architecture: src/core is engine-free', () => {
  it('finds core source files to check', () => {
    // Guards against a silent path typo quietly making every other assertion
    // in this file vacuously true.
    expect(coreFiles().length).toBeGreaterThan(0);
  });

  it('imports no phaser module and no node builtin', () => {
    const violations: string[] = [];
    for (const file of coreFiles()) {
      // Comments stripped, strings KEPT — import specifiers are strings.
      const code = scrub(readFileSync(file, 'utf8'), { strings: false }).join('\n');
      for (const match of code.matchAll(SPECIFIER)) {
        const specifier = match[1];
        if (specifier === undefined) continue;
        if (FORBIDDEN_PACKAGES.some((pattern) => pattern.test(specifier))) {
          violations.push(`${rel(file)} imports "${specifier}"`);
        }
      }
    }
    expect(violations, explain(violations)).toEqual([]);
  });

  it('references no global Phaser namespace', () => {
    const violations: string[] = [];
    for (const file of coreFiles()) {
      // Comments AND strings stripped — this scan looks for identifiers only.
      const lines = scrub(readFileSync(file, 'utf8'), { strings: true });
      lines.forEach((line, index) => {
        if (GLOBAL_PHASER_NS.test(line)) {
          violations.push(`${rel(file)}:${index + 1}  ${line.trim()}`);
        }
      });
    }
    expect(violations, explain(violations)).toEqual([]);
  });

  it('never imports upward into the game or scene layers', () => {
    const violations: string[] = [];
    for (const file of coreFiles()) {
      const code = scrub(readFileSync(file, 'utf8'), { strings: false }).join('\n');
      for (const match of code.matchAll(SPECIFIER)) {
        const specifier = match[1];
        if (specifier === undefined) continue;
        const resolved = specifier.startsWith('.')
          ? path.resolve(path.dirname(file), specifier)
          : specifier;
        const normalized = resolved.split(path.sep).join('/');
        if (FORBIDDEN_LAYERS.some((segment) => normalized.includes(segment))) {
          violations.push(`${rel(file)} imports "${specifier}"`);
        }
      }
    }
    expect(violations, explain(violations)).toEqual([]);
  });
});

describe('the guard itself works', () => {
  // A guard that cannot fail is not a guard. These assert the detectors fire on
  // known-bad input and stay quiet on known-good input, so a future refactor of
  // the regexes or the scrubber cannot silently neuter the whole file.

  it('detects a phaser import', () => {
    const bad = scrub(`import Phaser from 'phaser';\n`, { strings: false }).join('\n');
    const hits = [...bad.matchAll(SPECIFIER)].map((m) => m[1]);
    expect(hits).toContain('phaser');
    expect(FORBIDDEN_PACKAGES.some((p) => p.test('phaser'))).toBe(true);
    expect(FORBIDDEN_PACKAGES.some((p) => p.test('phaser/types/phaser'))).toBe(true);
  });

  it('detects a node builtin import without catching lookalike packages', () => {
    expect(FORBIDDEN_PACKAGES.some((p) => p.test('node:fs'))).toBe(true);
    expect(FORBIDDEN_PACKAGES.some((p) => p.test('nodemailer'))).toBe(false);
  });

  it('detects a bare global Phaser namespace reference', () => {
    expect(GLOBAL_PHASER_NS.test('let r: Phaser.Geom.Rectangle;')).toBe(true);
    expect(GLOBAL_PHASER_NS.test('  const x = Phaser.Math.Between(1, 2);')).toBe(true);
  });

  it('does not fire on innocent lookalikes', () => {
    expect(GLOBAL_PHASER_NS.test('this.notPhaser.thing();')).toBe(false);
    expect(GLOBAL_PHASER_NS.test('adapter.Phaser.thing();')).toBe(false);
  });

  it('scrubs a line comment that mentions the forbidden pattern', () => {
    // The exact false positive that made the guard fail its first run.
    const scrubbed = scrub('const a = 1; // see Phaser.Geom notes\n', { strings: true });
    expect(GLOBAL_PHASER_NS.test(scrubbed[0] ?? '')).toBe(false);
  });

  it('scrubs a block comment spanning several lines', () => {
    const source = ['/**', ' * Never reference Phaser.Geom here.', ' */', 'const a = 1;'].join('\n');
    const scrubbed = scrub(source, { strings: true });
    expect(scrubbed.some((line) => GLOBAL_PHASER_NS.test(line))).toBe(false);
    expect(scrubbed[3]).toContain('const a = 1;');
  });

  it('scrubs a string literal that mentions the forbidden pattern', () => {
    const scrubbed = scrub(`const msg = "Phaser.Geom is banned";\n`, { strings: true });
    expect(GLOBAL_PHASER_NS.test(scrubbed[0] ?? '')).toBe(false);
  });

  it('still sees real code on a line that also has a trailing comment', () => {
    const scrubbed = scrub('let r: Phaser.Geom.Rectangle; // unavoidable\n', { strings: true });
    expect(GLOBAL_PHASER_NS.test(scrubbed[0] ?? '')).toBe(true);
  });

  it('preserves line numbering while scrubbing', () => {
    const source = ['/* a', '   b */', 'let r: Phaser.Math.Vector2;'].join('\n');
    const scrubbed = scrub(source, { strings: true });
    expect(scrubbed).toHaveLength(3);
    expect(GLOBAL_PHASER_NS.test(scrubbed[2] ?? '')).toBe(true);
  });
});
