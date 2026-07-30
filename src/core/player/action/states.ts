/**
 * Action states — bible §25.
 *
 * The second of the two cooperating machines. Locomotion answers "where is his
 * body going"; action answers "what are his hands doing". Keeping them separate
 * is what stops `RunWhileCarryingAndAiming` from needing to exist.
 */
export type ActionState =
  | 'Free'
  | 'FistLight'
  | 'FistHeavy'
  | 'Grab'
  | 'Carry'
  | 'Sword'
  | 'Aim'
  | 'Shoot'
  | 'Hurt'
  | 'DialogueLocked';

export const ALL_ACTION_STATES: readonly ActionState[] = [
  'Free',
  'FistLight',
  'FistHeavy',
  'Grab',
  'Carry',
  'Sword',
  'Aim',
  'Shoot',
  'Hurt',
  'DialogueLocked',
] as const;

/**
 * What a locomotion state permits.
 *
 * Categories rather than a list of action ids, so adding `SwordHeavy` later
 * does not mean revisiting all seventeen locomotion definitions — it just joins
 * the `weapon` category and inherits every existing permission.
 */
export type ActionCategory = 'none' | 'unarmed' | 'weapon' | 'ranged' | 'handling' | 'forced';

export const ACTION_CATEGORY: Readonly<Record<ActionState, ActionCategory>> = {
  Free: 'none',
  FistLight: 'unarmed',
  FistHeavy: 'unarmed',
  Grab: 'handling',
  Carry: 'handling',
  Sword: 'weapon',
  Aim: 'ranged',
  Shoot: 'ranged',
  // `forced` is never *chosen*; it is imposed. Listing it as a category means
  // no locomotion state can accidentally permit or forbid being hurt.
  Hurt: 'forced',
  DialogueLocked: 'forced',
};
