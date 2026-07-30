import { createGame } from './game/boot.ts';

const game = createGame();

if (import.meta.env.DEV) {
  // Inspection hook for devtools and preview tooling. Dev-only.
  (globalThis as unknown as { __wayfarer: unknown }).__wayfarer = game;

  /**
   * Destroy the game on hot reload.
   *
   * Without this, every HMR update constructs a *new* `Phaser.Game` while the
   * old one keeps running: several engines share one canvas parent, each with
   * its own render loop, input listeners and scene manager. The symptoms are
   * baffling — the framerate drops, and `window.__wayfarer` points at an
   * instance that is not the one you can see, so scene transitions appear to
   * "not fire" when in fact they fired on an invisible duplicate.
   *
   * It also stacks the `Game.prototype.step` patch once per reload.
   */
  import.meta.hot?.dispose(() => {
    game.destroy(true, false);
  });
}
