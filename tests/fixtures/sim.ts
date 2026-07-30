import { PlayerBrain } from '@core/player/PlayerBrain.ts';
import { InputBuffer } from '@core/input/InputBuffer.ts';
import type { GameAction } from '@core/input/actions.ts';
import { integrateVertical } from '@core/physics/integrate.ts';
import { MOVEMENT } from '@core/tuning/movement.ts';
import { EMPTY_PROBE } from '@core/player/probes.ts';
import type { WorldProbeResult } from '@core/player/probes.ts';
import type { BodySample, Contacts } from '@core/physics/BodySample.ts';
import type { PlayerTickResult } from '@core/player/PlayerBrain.ts';

/**
 * A minimal deterministic world for exercising PlayerBrain in Node.
 *
 * This is the whole payoff of the core boundary: a jump arc can be measured to
 * the pixel, at a fixed timestep, with no Phaser, no canvas and no jsdom. It
 * also means the tests describe the *design* rather than the engine — if Phaser
 * ever changed under us, these would still say what the jump is supposed to do.
 *
 * The integration order mirrors Arcade's: contacts are resolved at the end of a
 * step and read at the start of the next one, so a body that lands this frame
 * reports `contacts.down` next frame. Getting that backwards makes coyote time
 * appear to work when it does not.
 */
export const FIXED_DT_MS = 1000 / 60;

export interface SimOptions {
  /** World Y of the ground's top surface. */
  readonly groundTopY?: number;
  /** Omit for an endless void — useful for pure fall tests. */
  readonly hasGround?: boolean;
  readonly startX?: number;
  readonly world?: WorldProbeResult;
}

export class Sim {
  readonly brain = new PlayerBrain();
  readonly input = new InputBuffer();

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly width = MOVEMENT.bodyWidth;
  height = MOVEMENT.bodyHeight;

  timeMs = 0;
  axisX = 0;
  private readonly heldActions = new Set<GameAction>();
  private contacts: Contacts = { down: false, up: false, left: false, right: false };

  private readonly groundTopY: number;
  private hasGround: boolean;
  private readonly world: WorldProbeResult;

  last!: PlayerTickResult;

  constructor(options: SimOptions = {}) {
    this.groundTopY = options.groundTopY ?? 600;
    this.hasGround = options.hasGround ?? true;
    this.x = options.startX ?? 0;
    this.y = this.groundTopY - MOVEMENT.bodyHeight;
    this.world = options.world ?? EMPTY_PROBE;
    // Start settled on the floor, as a spawned player would be.
    this.contacts = { down: this.hasGround, up: false, left: false, right: false };
  }

  /**
   * Delete the floor from under the body — the equivalent of running off a
   * ledge, without needing real level geometry. This is how coyote time gets
   * tested: the frame after this, `contacts.down` goes false.
   */
  removeGround(): void {
    this.hasGround = false;
  }

  hold(action: GameAction): void {
    this.heldActions.add(action);
  }

  release(action: GameAction): void {
    this.heldActions.delete(action);
  }

  /** Press and release inside a single frame — a clean discrete tap. */
  tap(action: GameAction): void {
    this.heldActions.add(action);
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get grounded(): boolean {
    return this.contacts.down;
  }

  sample(): BodySample {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      vx: this.vx,
      vy: this.vy,
      contacts: this.contacts,
    };
  }

  step(dtMs: number = FIXED_DT_MS): PlayerTickResult {
    this.timeMs += dtMs;
    const dtSec = dtMs / 1000;

    this.input.update({ held: new Set(this.heldActions), axisX: this.axisX, timeMs: this.timeMs });

    const result = this.brain.tick({
      timeMs: this.timeMs,
      dtSec,
      body: this.sample(),
      input: this.input,
      world: this.world,
    });
    this.last = result;

    const motion = result.motion;
    this.vx = motion.vx;
    if (motion.vyOverride !== null) this.vy = motion.vyOverride;
    if (motion.teleport !== null) {
      this.x = motion.teleport.x;
      this.y = motion.teleport.y;
    }

    this.vy = integrateVertical(this.vy, motion.gravityScale, motion.maxFall, dtSec);

    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;

    // Resolve against the floor and publish contacts for the next tick.
    let down = false;
    if (this.hasGround && this.bottom >= this.groundTopY && this.vy >= 0) {
      this.y = this.groundTopY - this.height;
      this.vy = 0;
      down = true;
    }
    this.contacts = { down, up: false, left: false, right: false };

    return result;
  }

  /** Advance `count` frames, returning every result. */
  run(count: number, dtMs: number = FIXED_DT_MS): PlayerTickResult[] {
    const out: PlayerTickResult[] = [];
    for (let i = 0; i < count; i += 1) out.push(this.step(dtMs));
    return out;
  }

  /** Advance until `predicate` holds or `limit` frames elapse. */
  runUntil(predicate: (sim: Sim) => boolean, limit = 600): number {
    for (let i = 0; i < limit; i += 1) {
      this.step();
      if (predicate(this)) return i + 1;
    }
    return -1;
  }
}
