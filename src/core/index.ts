/**
 * Public barrel for the pure rules core.
 *
 * Everything re-exported here must be free of Phaser, the DOM, and Node. That
 * is enforced two ways, both of which run inside `npm run check`:
 *   - `tests/guards/core-boundary.test.ts` statically scans src/core for Phaser
 *     imports and for bare `Phaser.` global-namespace references (the type-only
 *     leak an import scan alone would miss);
 *   - the `core` Vitest project runs in a Node environment with no DOM, so any
 *     value-level leak fails at import time.
 *
 * Dependency direction: content data → core rules → game adapters → scenes.
 * Nothing below this line may point back up.
 */

export { MOVEMENT, JUMP_APEX_PX, JUMP_TIME_TO_APEX_MS } from './tuning/movement.ts';
export type { MovementTuning } from './tuning/movement.ts';
export { VIEW, CAMERA, COLORS, DEPTH } from './tuning/world.ts';
