import { describe, expect, it } from 'vitest';

/**
 * The runtime half of the core-purity guard.
 *
 * This suite runs in the `core` Vitest project, whose environment is **node**
 * with no DOM. Phaser's device detection (src/device/Browser.js, Features.js,
 * CanvasFeatures.js) executes at module-init and touches `document`, so any
 * value-level leak from core into Phaser fails right here at import time.
 *
 * Together with the static scan in core-boundary.test.ts this covers both
 * halves of the problem: the scan catches type-only imports (which erase at
 * runtime and would slip past this), and this catches anything the scan's
 * regexes might not anticipate.
 */
describe('core loads headless', () => {
  it('imports the whole core barrel under Node with no DOM', async () => {
    const core = await import('../../src/core/index.ts');
    expect(core).toBeDefined();
    expect(core.MOVEMENT).toBeDefined();
  });

  it('really has no DOM in this environment', () => {
    // If this ever fails, the environment changed and the runtime half of the
    // guard has silently stopped guarding anything.
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });
});
