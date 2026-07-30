import { Scene } from 'phaser';
import { createPlaceholderTextures } from '../render/placeholders.ts';

/**
 * Boot: create the procedural fallbacks, then hand off immediately.
 *
 * Bible §23 gives BootScene exactly one job — build procedural fallback
 * textures and validate minimum configuration. It deliberately does *not*
 * linger on a splash: a timed hand-off ties the very first transition in the
 * game to the frame clock, and any environment that throttles
 * requestAnimationFrame (an occluded window, a background tab, a headless
 * preview) then stalls the whole game before it starts. Phaser clamps
 * per-frame delta, so at ~0.4 fps a 700 ms timer needs half a minute of wall
 * clock — which presents as "the game is frozen on the title", with no error.
 *
 * Handing off synchronously from `create()` has no such dependency.
 */
export class BootScene extends Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start('Lab');
  }
}
