import { MOVEMENT } from '../tuning/movement.ts';

/**
 * How much steering a locomotion state grants.
 *
 * `scripted` means the state writes `vx` itself — a dash, a ledge climb, a
 * pound. It is distinct from `locked` (which decays to a stop) because a
 * scripted state must be able to hold a velocity the integrator would otherwise
 * bleed away.
 */
export type HorizontalControl = 'full' | 'reduced' | 'locked' | 'scripted';

export interface IntegrateArgs {
  readonly vx: number;
  /** −1, 0 or +1 after deadzone. Analog magnitude is deliberately discarded:
   *  a side-scroller with two ground speeds reads as a bug, not a feature. */
  readonly axisX: number;
  readonly dtSec: number;
  readonly control: HorizontalControl;
  readonly grounded: boolean;
  /** Multiplier from the action machine — carrying, aiming, attack recovery. */
  readonly speedScale: number;
}

/**
 * Two-magnitude horizontal integrator.
 *
 * Transcribed from Lionn's `PlayerMovement.applyHorizontal`, which is the one
 * piece of that file worth keeping verbatim as an *algorithm*: separate
 * acceleration and deceleration magnitudes, a weaker airborne pair, and a
 * target-crossing clamp so a step never overshoots and oscillates.
 *
 * Separate accel/decel is what makes the bible's "responsive acceleration with
 * immediate reversal at low speed" achievable — one shared magnitude forces a
 * choice between floaty starts and mushy stops.
 */
export function integrateHorizontal(args: IntegrateArgs): number {
  if (args.control === 'scripted') return args.vx;

  const controlFactor =
    args.control === 'full' ? 1 : args.control === 'reduced' ? MOVEMENT.reducedControlFactor : 0;

  const target = args.axisX * controlFactor * MOVEMENT.runSpeed * args.speedScale;

  // Accelerating toward a non-zero target, or decaying toward rest? Those are
  // different feels and get different magnitudes.
  const accelerating = target !== 0;
  const rate = args.grounded
    ? accelerating
      ? MOVEMENT.groundAccel
      : MOVEMENT.groundDecel
    : accelerating
      ? MOVEMENT.airAccel
      : MOVEMENT.airDecel;

  const step = rate * args.dtSec;

  // Clamp at the target rather than stepping past it. Without this, a large dt
  // (a stalled frame, a backgrounded tab) overshoots and the next frame steps
  // back — visible as a jitter exactly when the game is already struggling.
  if (target > args.vx) return Math.min(target, args.vx + step);
  if (target < args.vx) return Math.max(target, args.vx - step);
  return args.vx;
}

/**
 * Vertical integration under a gravity scale, capped at a terminal speed.
 *
 * Core does this itself rather than leaving it to Arcade so that jump-arc tests
 * can run in Node with no engine — the arc is the single most important feel
 * property in the game and it deserves an executable spec.
 */
export function integrateVertical(vy: number, gravityScale: number, maxFall: number, dtSec: number): number {
  const next = vy + MOVEMENT.gravity * gravityScale * dtSec;
  return next > maxFall ? maxFall : next;
}
