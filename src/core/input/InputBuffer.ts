import type { GameAction } from './actions.ts';
import { ALL_ACTIONS } from './actions.ts';

interface ActionState {
  held: boolean;
  /** Timestamp of the most recent press, or -Infinity. */
  pressedAt: number;
  /** Timestamp of the most recent release, or -Infinity. */
  releasedAt: number;
  /**
   * Set when a press has been *spent* by a consumer.
   *
   * This is the load-bearing field. See `consumePress`.
   */
  consumed: boolean;
}

/** What an adapter reports each frame: which actions are physically down. */
export interface RawInputFrame {
  readonly held: ReadonlySet<GameAction>;
  /** Horizontal stick/dpad axis after deadzone, −1 / 0 / +1. */
  readonly axisX: number;
  readonly timeMs: number;
}

/**
 * Edge detection and buffering over the raw action set.
 *
 * Ported from Lionn's `InputController`, with its bindings hoisted out into
 * data. The timing model is timestamps, not countdown counters — a counter
 * decremented by `delta` accumulates float error and drifts against the
 * wall-clock windows the tests assert.
 */
export class InputBuffer {
  private readonly states = new Map<GameAction, ActionState>();
  private axisXValue = 0;
  private nowMs = 0;

  constructor() {
    for (const action of ALL_ACTIONS) {
      this.states.set(action, {
        held: false,
        pressedAt: Number.NEGATIVE_INFINITY,
        releasedAt: Number.NEGATIVE_INFINITY,
        consumed: false,
      });
    }
  }

  update(frame: RawInputFrame): void {
    this.nowMs = frame.timeMs;
    this.axisXValue = frame.axisX;

    for (const action of ALL_ACTIONS) {
      const state = this.states.get(action);
      if (state === undefined) continue;

      const isHeld = frame.held.has(action);
      if (isHeld && !state.held) {
        state.pressedAt = frame.timeMs;
        // A fresh press is a fresh opportunity. Clearing here — and only here —
        // is what makes `consumePress` a per-press guard rather than a
        // per-frame one.
        state.consumed = false;
      } else if (!isHeld && state.held) {
        state.releasedAt = frame.timeMs;
      }
      state.held = isHeld;
    }
  }

  axisX(): number {
    return this.axisXValue;
  }

  held(action: GameAction): boolean {
    return this.states.get(action)?.held ?? false;
  }

  /** ms since this action was last pressed. `Infinity` if never. */
  sincePress(action: GameAction): number {
    const at = this.states.get(action)?.pressedAt ?? Number.NEGATIVE_INFINITY;
    return this.nowMs - at;
  }

  /** ms since this action was last released. `Infinity` if never. */
  sinceRelease(action: GameAction): number {
    const at = this.states.get(action)?.releasedAt ?? Number.NEGATIVE_INFINITY;
    return this.nowMs - at;
  }

  /** Was this action pressed within `windowMs`, regardless of consumption? */
  pressedWithin(action: GameAction, windowMs: number): boolean {
    return this.sincePress(action) <= windowMs;
  }

  /**
   * Take a press if one is available inside `windowMs`, and mark it spent.
   *
   * **This is the double-spend guard, and it is not optional.** In Lionn,
   * holding the jump button meant that on the very next frame the same physical
   * press still satisfied "pressed recently" — so the ground jump fired, and
   * then the air jump fired off the identical press, and a held button burned
   * the double jump instantly. Every consumer of a discrete press must go
   * through here; only a genuine release-and-press-again clears `consumed`.
   */
  consumePress(action: GameAction, windowMs: number): boolean {
    const state = this.states.get(action);
    if (state === undefined) return false;
    if (state.consumed) return false;
    if (this.nowMs - state.pressedAt > windowMs) return false;
    state.consumed = true;
    return true;
  }

  /** Discard any pending press without acting on it (menus, cutscenes). */
  clearPress(action: GameAction): void {
    const state = this.states.get(action);
    if (state !== undefined) state.consumed = true;
  }
}
