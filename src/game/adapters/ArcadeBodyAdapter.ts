import type { Physics } from 'phaser';
import { MOVEMENT } from '@core/tuning/movement.ts';
import type { BodySample, Contacts } from '@core/physics/BodySample.ts';
import type { MotionCommand } from '@core/physics/MotionCommand.ts';

/**
 * The only file in the codebase that knows both Arcade and the rules core.
 *
 * Reads the body into a plain `BodySample`, applies a plain `MotionCommand`
 * back. Nothing else may touch `body.setSize`, `body.setGravityY`, or
 * `body.setMaxVelocity` — concentrating those here is what makes the
 * body-resize trap below a one-file problem instead of a whole-codebase one.
 */
export class ArcadeBodyAdapter {
  private currentHeight: 'standing' | 'crouched' = 'standing';
  // Written out rather than as a constructor parameter property: the project
  // enables `erasableSyntaxOnly`, which bans them along with enum and namespace.
  private readonly body: Physics.Arcade.Body;

  constructor(body: Physics.Arcade.Body) {
    this.body = body;
    body.setSize(MOVEMENT.bodyWidth, MOVEMENT.bodyHeight);
    body.setMaxVelocity(100_000, MOVEMENT.maxFall);
    body.setCollideWorldBounds(false);
  }

  sample(): BodySample {
    // Arcade distinguishes `blocked` (a static tile or world bound) from
    // `touching` (another moving body). No movement rule in this game cares
    // which, so they are OR-ed here and core never learns the distinction
    // exists. Forgetting one of the two is how "he won't jump off that moving
    // platform" bugs happen.
    const contacts: Contacts = {
      down: this.body.blocked.down || this.body.touching.down,
      up: this.body.blocked.up || this.body.touching.up,
      left: this.body.blocked.left || this.body.touching.left,
      right: this.body.blocked.right || this.body.touching.right,
    };

    return {
      x: this.body.x,
      y: this.body.y,
      width: this.body.width,
      height: this.body.height,
      vx: this.body.velocity.x,
      vy: this.body.velocity.y,
      contacts,
    };
  }

  apply(command: MotionCommand): void {
    // World gravity is zero; all of it arrives here. See boot.ts.
    this.body.setGravityY(MOVEMENT.gravity * command.gravityScale);
    this.body.setMaxVelocity(100_000, command.maxFall);
    this.body.setVelocityX(command.vx);

    if (command.vyOverride !== null) {
      this.body.setVelocityY(command.vyOverride);
    }

    this.applyBodyHeight(command.bodyHeight);

    // After the resize, so a teleport always wins over the resize's own
    // re-anchoring — a respawn must land exactly where it was told to.
    if (command.teleport !== null) {
      this.body.reset(command.teleport.x + this.body.width / 2, command.teleport.y + this.body.height / 2);
    }
  }

  /**
   * Change the body's height with its feet staying put.
   *
   * **This is the quarantine for the Arcade body auto-sync trap**, which is
   * still live in Phaser 4.2.1 (`Body.js:1020`, `:1506`):
   *
   *     // updateBounds(), every frame:
   *     this.width  = this.sourceWidth  * |scaleX|
   *     this.height = this.sourceHeight * |scaleY|
   *
   * `setSize()` writes `sourceHeight`, and the per-frame sync then multiplies
   * it by the owning object's scale. In Lionn, crouch scaled the sprite *and*
   * called `setSize`, so 36 became 36 × 0.5625 = 20.25 and the body shrank a
   * little more every frame. It cost four failed fix attempts across a week.
   *
   * Two rules make it unreachable here:
   *   1. The physics object's scale is never changed — art is a separate
   *      GameObject that follows the body, so `scaleY` stays 1 forever.
   *   2. Height is expressed as a token in `MotionCommand`, so no state can
   *      pass a pixel count and no other file can call `setSize`.
   *
   * The feet-stay-planted correction is the visible half of the fix: shrinking
   * a top-left-anchored body without moving it downward makes Rook hover.
   */
  private applyBodyHeight(next: 'standing' | 'crouched'): void {
    if (next === this.currentHeight) return;

    const previousBottom = this.body.y + this.body.height;
    const height = next === 'crouched' ? MOVEMENT.crouchBodyHeight : MOVEMENT.bodyHeight;

    this.body.setSize(MOVEMENT.bodyWidth, height);
    this.body.y = previousBottom - height;
    this.currentHeight = next;
  }

  bodyHeightMode(): 'standing' | 'crouched' {
    return this.currentHeight;
  }
}
