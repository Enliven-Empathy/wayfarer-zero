import { MOVEMENT } from '../tuning/movement.ts';
import type { InputBuffer } from '../input/InputBuffer.ts';

/**
 * Coyote time, jump buffering, and the variable-height cut.
 *
 * These three are the whole of "does the jump feel good", and all three are
 * pure timing rules over timestamps — so they live in core and are tested
 * without an engine. That matters more than it sounds: the jump arc is the
 * single most-felt property in a platformer, and an executable spec for it is
 * worth more than any amount of careful tuning that nobody can re-verify.
 */
export class JumpController {
  private lastGroundedAt = Number.NEGATIVE_INFINITY;
  private jumpStartedAt = Number.NEGATIVE_INFINITY;
  private inJump = false;

  /**
   * One-shot latch for the variable-height cut.
   *
   * Without it the cut re-applies on every frame the button is up, and the jump
   * does not shorten — it collapses. Lionn hit exactly this and the symptom
   * ("short hops barely leave the ground") looked like a tuning problem for
   * days before it turned out to be a missing boolean.
   */
  private cutApplied = false;

  /**
   * Set when the player deliberately drops through a one-way platform.
   *
   * Bible §26: "Do not permit coyote jump after a deliberate drop-through."
   * Without this, pressing Down to drop and then Jump gives a free mid-air
   * jump out of the platform you just chose to leave — which reads as the game
   * ignoring your input.
   */
  private droppedThrough = false;

  /** Call every frame with the current grounded state. */
  noteGrounded(timeMs: number, grounded: boolean): void {
    if (!grounded) return;
    this.lastGroundedAt = timeMs;
    this.inJump = false;
    this.cutApplied = false;
    this.droppedThrough = false;
  }

  noteDropThrough(): void {
    this.droppedThrough = true;
  }

  /** Remaining coyote grace in ms, clamped at zero. Debug overlay reads this. */
  coyoteRemainingMs(timeMs: number): number {
    if (this.droppedThrough) return 0;
    const elapsed = timeMs - this.lastGroundedAt;
    const remaining = MOVEMENT.coyoteMs - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  withinCoyote(timeMs: number): boolean {
    return !this.droppedThrough && timeMs - this.lastGroundedAt <= MOVEMENT.coyoteMs;
  }

  /**
   * Attempt a jump, consuming the buffered press if one is available.
   *
   * Both generosities fall out of the same two lines:
   *   - **coyote** — grounded is false but `withinCoyote` is still true, and the
   *     press is fresh;
   *   - **buffer** — grounded just became true, and the press is up to
   *     `jumpBufferMs` old.
   *
   * The press goes through `consumePress`, so a held button cannot satisfy this
   * twice. That guard is why a held jump does not instantly burn the air jump
   * the moment one exists.
   */
  tryJump(input: InputBuffer, timeMs: number, grounded: boolean): boolean {
    if (!grounded && !this.withinCoyote(timeMs)) return false;
    if (!input.consumePress('jump', MOVEMENT.jumpBufferMs)) return false;

    this.inJump = true;
    this.jumpStartedAt = timeMs;
    this.cutApplied = false;
    // Spend the coyote window. Otherwise one walk-off supplies two jumps.
    this.lastGroundedAt = Number.NEGATIVE_INFINITY;
    return true;
  }

  /**
   * The variable-height cut.
   *
   * Returns the reduced upward velocity, or `null` when nothing should change.
   * Only ever fires once per jump, only while still rising, and only when the
   * button is genuinely up.
   */
  applyVariableCut(vy: number, jumpHeld: boolean): number | null {
    if (!this.inJump) return null;
    if (this.cutApplied) return null;
    if (jumpHeld) return null;
    // Already falling: there is no upward velocity left to trim, and cutting
    // here would slow the descent instead — a jump that hangs when you let go.
    if (vy >= 0) return null;

    this.cutApplied = true;
    return vy * MOVEMENT.variableJumpCut;
  }

  isInJump(): boolean {
    return this.inJump;
  }

  timeSinceJumpMs(timeMs: number): number {
    return timeMs - this.jumpStartedAt;
  }
}
