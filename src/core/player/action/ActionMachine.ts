import type { ActionState } from './states.ts';
import { ACTION_CATEGORY } from './states.ts';
import type { ActionCategory } from './states.ts';
import { ACTION_DEFS, actionFallback } from './definitions.ts';
import type { ActionConstraint, ActionStateDef, PlayerTickContext } from '../types.ts';

/**
 * The action half of the player.
 *
 * At F1 it is almost inert — `Free`, or whatever a system has forced. That is
 * intentional: the machine and, more importantly, the *handshake* with
 * locomotion exist from the start, so F2's fists and grabs plug into a shape
 * that already has tests, rather than arriving alongside a new architecture.
 */
export class ActionMachine {
  private state: ActionState;
  private forced: ActionState | null = null;

  constructor(initial: ActionState = 'Free') {
    this.state = initial;
  }

  current(): ActionState {
    return this.state;
  }

  definition(): ActionStateDef {
    return ACTION_DEFS[this.state];
  }

  category(): ActionCategory {
    return ACTION_CATEGORY[this.state];
  }

  /** Imposed from outside — damage, dialogue, cutscene. Survives one tick. */
  force(next: ActionState): void {
    this.forced = next;
  }

  /**
   * Decide this tick's action and what it imposes on locomotion.
   *
   * `propose` rather than `set`: locomotion may refuse it, and `reconcile` in
   * PlayerBrain is what settles the disagreement. Naming it honestly keeps the
   * one-directional handshake obvious at the call site.
   */
  propose(_ctx: PlayerTickContext): ActionConstraint {
    if (this.forced !== null) {
      this.state = this.forced;
      this.forced = null;
    }

    const def = ACTION_DEFS[this.state];
    return {
      forcesLocomotion: def.forcesLocomotion,
      forcesHorizontal: def.forcesHorizontal,
      speedScale: def.speedScale,
    };
  }

  /**
   * Called by `reconcile` when locomotion forbids the proposed action.
   *
   * Falls back rather than blocking: refusing to change would leave the player
   * in an action their body cannot perform, which is how "my sword swings while
   * hanging off a ledge" bugs happen.
   */
  forceTo(next: ActionState): void {
    this.state = next;
  }

  fallback(): ActionState {
    return actionFallback(this.state);
  }
}
