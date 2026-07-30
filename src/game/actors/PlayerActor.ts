import type { GameObjects, Physics, Scene } from 'phaser';
import { PlayerBrain } from '@core/player/PlayerBrain.ts';
import type { PlayerTickResult } from '@core/player/PlayerBrain.ts';
import { InputBuffer } from '@core/input/InputBuffer.ts';
import { EMPTY_PROBE } from '@core/player/probes.ts';
import { MOVEMENT } from '@core/tuning/movement.ts';
import { COLORS, DEPTH } from '@core/tuning/world.ts';
import { ArcadeBodyAdapter } from '../adapters/ArcadeBodyAdapter.ts';
import { PhaserInputSource } from '../adapters/PhaserInputSource.ts';
import { TEXTURE } from '../render/placeholders.ts';

/**
 * Rook in the scene: a physics body, a piece of art that follows it, and the
 * engine-free brain that decides what both should do.
 *
 * The split is the bible's "player physics position is authoritative; sprite
 * art is visual only" made structural. The art is a **separate GameObject with
 * no body**, so:
 *   - nothing can accidentally derive collision from a sprite's bounds;
 *   - the physics object's scale stays 1 forever, which is what makes the
 *     Arcade auto-sync trap unreachable rather than merely avoided;
 *   - swapping the placeholder for a real sprite sheet in F3 touches this file
 *     and nothing else.
 */
export class PlayerActor {
  readonly physics: GameObjects.Rectangle;
  private readonly art: GameObjects.Image;
  private readonly bodyAdapter: ArcadeBodyAdapter;
  private readonly inputSource: PhaserInputSource;
  private readonly inputBuffer = new InputBuffer();
  private readonly brain = new PlayerBrain();

  last: PlayerTickResult | null = null;
  /** Draws the collision box when the debug overlay is on. */
  showBody = false;

  constructor(scene: Scene, x: number, y: number) {
    this.physics = scene.add.rectangle(x, y, MOVEMENT.bodyWidth, MOVEMENT.bodyHeight, COLORS.faceLight, 0);
    this.physics.setDepth(DEPTH.player);
    scene.physics.add.existing(this.physics);

    this.bodyAdapter = new ArcadeBodyAdapter(this.physics.body as Physics.Arcade.Body);

    this.art = scene.add.image(x, y, TEXTURE.rookBare);
    // Foot pivot: the sprite contract puts Rook's feet at the bottom of the
    // cell, so anchoring at (0.5, 1) lets art of any height sit correctly on
    // the body's bottom edge without per-asset offsets.
    this.art.setOrigin(0.5, 1);
    this.art.setDepth(DEPTH.player);

    this.inputSource = new PhaserInputSource(scene);
  }

  update(timeMs: number, deltaMs: number): PlayerTickResult {
    // Clamp the timestep. A backgrounded tab or a stalled frame delivers a
    // delta of hundreds of ms, which tunnels the body straight through a floor.
    const dtSec = Math.min(deltaMs, 50) / 1000;

    this.inputBuffer.update(this.inputSource.read(timeMs));

    const result = this.brain.tick({
      timeMs,
      dtSec,
      body: this.bodyAdapter.sample(),
      input: this.inputBuffer,
      world: EMPTY_PROBE,
    });

    this.bodyAdapter.apply(result.motion);
    this.syncArt(result);
    this.last = result;
    return result;
  }

  private syncArt(result: PlayerTickResult): void {
    const body = this.bodyAdapter.sample();
    this.art.setPosition(body.x + body.width / 2, body.y + body.height);
    // Runtime horizontal flip for left, per the sprite contract — art is
    // authored facing right only.
    this.art.setFlipX(result.motion.facing === -1);
    this.physics.setFillStyle(COLORS.faceLight, this.showBody ? 0.18 : 0);
  }

  get x(): number {
    return this.physics.x;
  }

  get y(): number {
    return this.physics.y;
  }

  destroy(): void {
    this.inputSource.destroy();
    this.art.destroy();
    this.physics.destroy();
  }
}
