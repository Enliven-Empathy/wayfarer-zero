/**
 * Player movement tuning — bible §26, "Foundation movement measurements".
 *
 * Every number here is authored, not derived, and every one carries the
 * reasoning that produced it. That habit is the single biggest reason a tuning
 * file survives a year of iteration: six months from now the question is never
 * "what is this value" but "why is it not something else".
 *
 * The bible calls these "starting values, not sacred final tuning". They are
 * nonetheless *fenced by a test* (tests/core/tuning/tuning.test.ts) which
 * asserts each one literally against the bible. Changing a number is fine;
 * changing it by accident is not. The fence exists specifically because the
 * neighbouring Lionn project uses very different numbers (gravity 1700, run
 * 290, jump -570) and muscle memory is a real failure mode.
 */

export interface MovementTuning {
  /** Logical tile size. Level geometry is authored on this grid. */
  readonly tileSize: number;

  /** Rook's visual height in Bare Chassis. Art only — never collision. */
  readonly visualHeight: number;
  /** Standing physics body, px. Narrower than the art so shoulders don't snag. */
  readonly bodyWidth: number;
  readonly bodyHeight: number;
  /**
   * Crouched physics body height. Not in the bible's table; derived from the
   * same ratio the standing body uses against the visual (104/128 ≈ 0.81), so a
   * crouch that halves the visual gives 0.81 × 64 ≈ 52. Rounded to 52 so a
   * crouched Rook is exactly one body-width tall — a shape that is trivial to
   * eyeball in the debug overlay.
   */
  readonly crouchBodyHeight: number;

  /** Downward acceleration, px/s². Applied per-body, never as world gravity. */
  readonly gravity: number;
  /** Top horizontal ground speed, px/s. */
  readonly runSpeed: number;
  /** Ground acceleration toward the target speed, px/s². 0→320 in 133 ms. */
  readonly groundAccel: number;
  /** Ground deceleration toward zero, px/s². 320→0 in 114 ms. */
  readonly groundDecel: number;
  /** Air acceleration, px/s². 0→320 in 213 ms — noticeably heavier than ground. */
  readonly airAccel: number;
  /**
   * Air deceleration, px/s².
   *
   * **The bible does not specify this.** It gives ground accel, ground decel
   * and air accel, then stops. Choosing air decel = air accel keeps airborne
   * handling symmetric, which is the least surprising default and preserves the
   * bible's "preserve horizontal momentum through jump takeoff" rule — an
   * asymmetric, higher air decel would bleed momentum on neutral stick and
   * quietly contradict it. Revisit after the first playtest.
   */
  readonly airDecel: number;

  /** Jump impulse, px/s (negative = up). Apex = 820²/(2·2200) = 152.82 px. */
  readonly jumpVelocity: number;
  /** Terminal fall speed, px/s. */
  readonly maxFall: number;
  /** Grace window after leaving a floor during which jump still works, ms. */
  readonly coyoteMs: number;
  /** Window before landing during which a jump press is remembered, ms. */
  readonly jumpBufferMs: number;
  /** Upward velocity is multiplied by this when jump is released early. */
  readonly variableJumpCut: number;

  /** Second airborne Down must arrive inside this window to commit a pound, ms. */
  readonly groundPoundWindowMs: number;

  /** How far ahead of the body to look for a grabbable ledge, px. */
  readonly ledgeProbeX: number;
  /** How far below the body top a ledge edge may sit and still be caught, px. */
  readonly ledgeProbeY: number;
  /**
   * After a deliberate drop from a ledge, re-catching is disabled for this
   * long, ms. Without it, Down-to-drop immediately re-grabs the same ledge and
   * the player is stuck in a one-input loop.
   */
  readonly ledgeRecatchLockoutMs: number;

  /**
   * Horizontal-control multiplier for states that reduce but do not remove
   * steering (carrying, aiming, attack recovery). Not in the bible; a single
   * shared value keeps "reduced" meaning one thing everywhere.
   */
  readonly reducedControlFactor: number;
}

export const MOVEMENT: MovementTuning = {
  tileSize: 64,

  visualHeight: 128,
  bodyWidth: 52,
  bodyHeight: 104,
  crouchBodyHeight: 52,

  gravity: 2200,
  runSpeed: 320,
  groundAccel: 2400,
  groundDecel: 2800,
  airAccel: 1500,
  airDecel: 1500,

  jumpVelocity: -820,
  maxFall: 1200,
  coyoteMs: 120,
  jumpBufferMs: 140,
  variableJumpCut: 0.48,

  groundPoundWindowMs: 350,

  ledgeProbeX: 20,
  ledgeProbeY: 40,
  ledgeRecatchLockoutMs: 180,

  reducedControlFactor: 0.55,
} as const;

/**
 * Analytic jump apex, px. Derived rather than authored so it can never drift
 * from the two values that produce it: `v²/(2g)`.
 *
 * Used by the level validator to reject any platform placed higher than Rook
 * can reach — the same class of guard that stopped Lionn's procedural generator
 * from ever emitting an impossible jump.
 */
export const JUMP_APEX_PX = (MOVEMENT.jumpVelocity * MOVEMENT.jumpVelocity) / (2 * MOVEMENT.gravity);

/** Time from launch to apex, ms. `|v|/g`. */
export const JUMP_TIME_TO_APEX_MS = (Math.abs(MOVEMENT.jumpVelocity) / MOVEMENT.gravity) * 1000;
