import type { LocomotionState } from './states.ts';
import { LOCOMOTION_DEFS } from './definitions.ts';
import type { LocomotionStateDef, MachineIO } from '../types.ts';

/**
 * Arbitrates locomotion transitions.
 *
 * Deliberately not a generic FSM library. The rules that matter here are the
 * interrupt rules — minimum durations, allow-lists, and overrides that ignore
 * both — and those are specific enough that a general implementation would be
 * longer than this one and harder to reason about.
 *
 * Guarantees, each of which has a test:
 *   - `onExit` and `onEnter` fire exactly once per transition, in that order;
 *   - a state cannot transition to itself;
 *   - a rejected request is silently dropped, never queued (a queued transition
 *     surfaces one frame late and reads as input lag);
 *   - `Disabled` can always pre-empt.
 */
export class LocomotionMachine {
  private state: LocomotionState;
  private enteredAt = 0;
  private requested: LocomotionState | null = null;

  constructor(initial: LocomotionState = 'Idle') {
    this.state = initial;
  }

  current(): LocomotionState {
    return this.state;
  }

  definition(): LocomotionStateDef {
    return LOCOMOTION_DEFS[this.state];
  }

  timeInState(timeMs: number): number {
    return timeMs - this.enteredAt;
  }

  /** Queue a transition for this tick. Later requests win. */
  request(next: LocomotionState): void {
    this.requested = next;
  }

  /**
   * Bypass the interrupt rules entirely.
   *
   * Reserved for decisions the brain owns rather than any individual state —
   * jump initiation is the F1 example. Coyote time means a jump can begin while
   * in `JumpFall`, so jump cannot live inside the grounded states, and it must
   * not be second-guessed by the state it is leaving.
   */
  force(next: LocomotionState, io: MachineIO): void {
    this.transition(next, io);
  }

  /** Run the current state's tick, then resolve any request it made. */
  tick(io: MachineIO): void {
    this.requested = null;
    LOCOMOTION_DEFS[this.state].tick?.(io);

    const next = this.requested;
    this.requested = null;
    if (next === null || next === this.state) return;
    if (!this.canLeave(next, io.ctx.timeMs)) return;

    this.transition(next, io);
  }

  private canLeave(next: LocomotionState, timeMs: number): boolean {
    const rule = LOCOMOTION_DEFS[this.state].interrupt;
    if (rule.overrides.includes(next)) return true;
    if (timeMs - this.enteredAt < rule.minDurationMs) return false;
    if (rule.by === 'none') return false;
    if (rule.by === 'any') return true;
    return rule.by.includes(next);
  }

  private transition(next: LocomotionState, io: MachineIO): void {
    if (next === this.state) return;
    LOCOMOTION_DEFS[this.state].onExit?.(io);
    this.state = next;
    this.enteredAt = io.ctx.timeMs;

    const def = LOCOMOTION_DEFS[next];
    if (!def.implemented) {
      // Loud rather than silent. A state that is declared but not built should
      // announce itself in the debug overlay, not behave like a subtly broken
      // version of the one before it.
      io.emit({ kind: 'notImplemented', state: next });
    }
    def.onEnter?.(io);
  }
}
