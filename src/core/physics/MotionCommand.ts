/**
 * The other half of the core boundary: what core decided, as plain data, for
 * the adapter to apply. Core states *what* should be true of the body this
 * frame; the adapter alone knows *how* to make an Arcade body agree.
 */
export interface MotionCommand {
  /** Core always owns horizontal velocity — it integrates accel/decel itself,
   *  so "how fast does he turn around" is a tested pure function rather than an
   *  engine behaviour. */
  readonly vx: number;

  /**
   * `null` means "let gravity integrate normally this frame". A number is a
   * hard override: jump impulse, variable-jump cut, wall-cling clamp, pound
   * speed, ledge freeze. Modelling it as nullable rather than as a flag plus a
   * value makes "I didn't touch vy" unrepresentable-as-a-mistake.
   */
  readonly vyOverride: number | null;

  /**
   * Multiplier on `MOVEMENT.gravity`. The adapter does
   * `body.setGravityY(gravity * gravityScale)`.
   *
   * Core emits a scalar and never names a physics engine. `0` means genuinely
   * frozen — which only works because world gravity is configured to zero and
   * all gravity is per-body. Arcade *adds* body gravity to world gravity, so
   * with a non-zero world value this would mean "fall normally", and a ledge
   * hang would quietly slide.
   */
  readonly gravityScale: number;

  /** Terminal fall speed for this frame. Lets a pound exceed the normal cap
   *  without permanently raising it. */
  readonly maxFall: number;

  /**
   * Absolute body top-left rewrite, or null.
   *
   * Non-null only for ledge pinning, climb, and respawn — and while hanging it
   * is emitted **every** tick, not once. That is deliberate: Lionn's ledge grab
   * drifted by fractions of a pixel per frame until the character visibly slid
   * off the ledge, and the fix was to re-pin unconditionally rather than to
   * hunt the source of the drift.
   */
  readonly teleport: { readonly x: number; readonly y: number } | null;

  /**
   * A token, never a pixel count.
   *
   * The adapter owns how a height change is realised, which is where the Arcade
   * body auto-sync trap is quarantined: `Body.updateBounds()` recomputes
   * `height = sourceHeight × |scaleY|`, so `setSize()` plus sprite scaling
   * compounds. Keeping this a token means exactly one function in the codebase
   * can get that wrong.
   */
  readonly bodyHeight: 'standing' | 'crouched';

  readonly facing: 1 | -1;
}

/** Mutable form, built up across a tick before being frozen into a command. */
export interface MotionDraft {
  vx: number;
  vyOverride: number | null;
  gravityScale: number;
  maxFall: number;
  teleport: { x: number; y: number } | null;
  bodyHeight: 'standing' | 'crouched';
  facing: 1 | -1;
}

export function freezeMotion(draft: MotionDraft): MotionCommand {
  return {
    vx: draft.vx,
    vyOverride: draft.vyOverride,
    gravityScale: draft.gravityScale,
    maxFall: draft.maxFall,
    teleport: draft.teleport === null ? null : { x: draft.teleport.x, y: draft.teleport.y },
    bodyHeight: draft.bodyHeight,
    facing: draft.facing,
  };
}
