import type { BodySample } from '../physics/BodySample.ts';
import type { MotionDraft } from '../physics/MotionCommand.ts';
import type { HorizontalControl } from '../physics/integrate.ts';
import type { InputBuffer } from '../input/InputBuffer.ts';
import type { GameAction } from '../input/actions.ts';
import type { WorldProbeResult } from './probes.ts';
import type { LocomotionState, LocomotionCategory } from './locomotion/states.ts';
import type { ActionState, ActionCategory } from './action/states.ts';

/**
 * Something that happened this tick which is not motion.
 *
 * Returned as data rather than fired as a callback, so core never reaches out
 * into the engine and the whole tick stays a pure function of its inputs. The
 * adapter decides what a `sfx:land` actually sounds like.
 */
export type PlayerEffect =
  | { readonly kind: 'sfx'; readonly id: string }
  | { readonly kind: 'fx'; readonly id: string }
  | { readonly kind: 'event'; readonly id: string }
  | { readonly kind: 'notImplemented'; readonly state: LocomotionState | ActionState };

export interface PlayerTickContext {
  readonly timeMs: number;
  readonly dtSec: number;
  readonly body: BodySample;
  readonly input: InputBuffer;
  readonly world: WorldProbeResult;
}

/**
 * What the action machine imposes on locomotion this frame.
 *
 * The handshake is one-directional and single-pass: action *proposes*,
 * locomotion *decides*, then `reconcile` forces the action back into legality.
 * No loop, no negotiation, deterministic.
 */
export interface ActionConstraint {
  /** e.g. being hurt forces the body out of whatever it was doing. */
  readonly forcesLocomotion: LocomotionState | null;
  /** e.g. aiming reduces steering regardless of the locomotion state's own rule. */
  readonly forcesHorizontal: HorizontalControl | null;
  /** Carrying is slower; aiming is much slower. Multiplies run speed. */
  readonly speedScale: number;
}

export const NO_CONSTRAINT: ActionConstraint = {
  forcesLocomotion: null,
  forcesHorizontal: null,
  speedScale: 1,
};

/** The only mutable surface core exposes to a state's callbacks. Engine-free. */
export interface MachineIO {
  readonly ctx: PlayerTickContext;
  readonly draft: MotionDraft;
  /** Effective control after the action constraint has been folded in. */
  readonly control: HorizontalControl;
  readonly speedScale: number;
  /**
   * Vertical velocity **as decided this frame**, not as sampled.
   *
   * States must read this rather than `ctx.body.vy`. The sample is taken before
   * the brain applies a jump impulse, so on the launch frame `ctx.body.vy` is
   * still the small positive value from the previous frame's gravity — and a
   * `vy > -APEX_BAND` check against it sent a brand-new jump straight to
   * `JumpApex`, skipping `JumpRise` entirely.
   */
  vy(): number;
  /** Ask to transition. The machine arbitrates; a request is not a guarantee. */
  request(next: LocomotionState): void;
  emit(effect: PlayerEffect): void;
  /** ms since the current state was entered. */
  timeInState(): number;
}

export interface InterruptRule {
  /** A state cannot be left before this many ms have passed, except by an
   *  override. Prevents one-frame flicker between mutually-triggering states. */
  readonly minDurationMs: number;
  readonly by: 'any' | 'none' | readonly LocomotionState[];
  /** States that may always pre-empt, regardless of `minDurationMs`. Being hurt
   *  or disabled must never be delayed by an animation lock. */
  readonly overrides: readonly LocomotionState[];
}

export interface LocomotionStateDef {
  readonly id: LocomotionState;
  readonly category: LocomotionCategory;
  /** Inputs this state reads. Documentation and debug-overlay data, and the
   *  basis for "why did my input do nothing here". */
  readonly acceptsInputs: readonly GameAction[];
  readonly horizontalControl: HorizontalControl;
  readonly gravityScale: number;
  readonly allowedActions: readonly ActionCategory[];
  readonly interrupt: InterruptRule;
  readonly animationKey: string;
  readonly bodyHeight: 'standing' | 'crouched';
  /** Overrides the tuning default — a ground pound legitimately exceeds it. */
  readonly maxFall?: number;
  /** False = declared for completeness, behaviour not built yet. */
  readonly implemented: boolean;
  readonly onEnter?: (io: MachineIO) => void;
  readonly onExit?: (io: MachineIO) => void;
  readonly tick?: (io: MachineIO) => void;
}

export interface ActionStateDef {
  readonly id: ActionState;
  readonly category: ActionCategory;
  readonly speedScale: number;
  readonly forcesHorizontal: HorizontalControl | null;
  readonly forcesLocomotion: LocomotionState | null;
  /** Upper-body animation key, layered over the locomotion key when present. */
  readonly animationKey: string | null;
  readonly implemented: boolean;
}

/** Everything the debug overlay renders, and everything the tests assert on. */
export interface PlayerDebugFrame {
  readonly locomotion: LocomotionState;
  readonly action: ActionState;
  readonly timeInStateMs: number;
  readonly vx: number;
  readonly vy: number;
  readonly grounded: boolean;
  readonly coyoteRemainingMs: number;
  readonly jumpBufferRemainingMs: number;
  readonly gravityScale: number;
  readonly horizontalControl: HorizontalControl;
  readonly animationKey: string;
  readonly facing: 1 | -1;
}
