import type { ActionState } from './states.ts';
import type { ActionStateDef } from '../types.ts';

/**
 * Action state table.
 *
 * F1 implements `Free` and `DialogueLocked`; the rest are declared so the union
 * is complete, the reconcile function is total, and the debug overlay can
 * report "declared, not implemented" rather than shrugging.
 *
 * `speedScale` is the main lever these states pull on locomotion. It is
 * multiplicative on run speed rather than a separate max, so a state that slows
 * Rook also slows his acceleration proportionally — which is what stops
 * "carrying a crate" from feeling like normal running that simply stops sooner.
 */
export const ACTION_DEFS: Readonly<Record<ActionState, ActionStateDef>> = {
  Free: {
    id: 'Free',
    category: 'none',
    speedScale: 1,
    forcesHorizontal: null,
    forcesLocomotion: null,
    animationKey: null,
    implemented: true,
  },

  FistLight: {
    id: 'FistLight',
    category: 'unarmed',
    speedScale: 0.8,
    forcesHorizontal: null,
    forcesLocomotion: null,
    animationKey: 'fistLight',
    implemented: false,
  },

  FistHeavy: {
    id: 'FistHeavy',
    category: 'unarmed',
    speedScale: 0.5,
    forcesHorizontal: 'reduced',
    forcesLocomotion: null,
    animationKey: 'fistHeavy',
    implemented: false,
  },

  Grab: {
    id: 'Grab',
    category: 'handling',
    speedScale: 0.85,
    forcesHorizontal: null,
    forcesLocomotion: null,
    animationKey: 'grab',
    implemented: false,
  },

  Carry: {
    id: 'Carry',
    category: 'handling',
    // Bible §2.2: hands are the connective verb, and carrying should read as a
    // real commitment. Slow enough to feel the weight, fast enough to cross a
    // room without tedium.
    speedScale: 0.7,
    forcesHorizontal: null,
    forcesLocomotion: null,
    animationKey: 'carry',
    implemented: false,
  },

  Sword: {
    id: 'Sword',
    category: 'weapon',
    speedScale: 0.6,
    forcesHorizontal: 'reduced',
    forcesLocomotion: null,
    animationKey: 'sword',
    implemented: false,
  },

  Aim: {
    id: 'Aim',
    category: 'ranged',
    // Deliberate aim, per bible §9. Slow enough that shooting is a decision.
    speedScale: 0.35,
    forcesHorizontal: 'reduced',
    forcesLocomotion: null,
    animationKey: 'aim',
    implemented: false,
  },

  Shoot: {
    id: 'Shoot',
    category: 'ranged',
    speedScale: 0.35,
    forcesHorizontal: 'reduced',
    forcesLocomotion: null,
    animationKey: 'shoot',
    implemented: false,
  },

  Hurt: {
    id: 'Hurt',
    category: 'forced',
    speedScale: 0,
    forcesHorizontal: 'scripted',
    forcesLocomotion: null,
    animationKey: 'hurt',
    implemented: false,
  },

  DialogueLocked: {
    id: 'DialogueLocked',
    category: 'forced',
    speedScale: 0,
    forcesHorizontal: 'locked',
    // Talking stops the body. Without this a conversation can be had mid-sprint.
    forcesLocomotion: 'Idle',
    animationKey: null,
    implemented: true,
  },
};

/**
 * What an action falls back to when the current locomotion state forbids it.
 *
 * Total by construction: `reconcile` must always have somewhere legal to land,
 * and "somewhere legal" is almost always `Free`. The two forced states are
 * their own fallback because they are imposed rather than chosen — if a
 * locomotion state could bounce `Hurt`, taking damage mid-climb would silently
 * do nothing.
 */
export function actionFallback(action: ActionState): ActionState {
  return action === 'Hurt' || action === 'DialogueLocked' ? action : 'Free';
}
