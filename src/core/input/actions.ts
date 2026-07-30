/**
 * The complete action vocabulary — bible §27.
 *
 * Game logic consumes these and never a key code or a button index. That rule
 * is what makes remapping, gamepad hot-swap and replay possible at all, and it
 * is why the input layer is worth its own module rather than a few `isDown`
 * calls scattered through the player.
 */
export type GameAction =
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'jump'
  | 'lightAttack'
  | 'heavyAttack'
  | 'grabInteract'
  | 'aim'
  | 'fire'
  | 'evade'
  | 'pause'
  | 'journal'
  | 'quickSwap';

export const ALL_ACTIONS: readonly GameAction[] = [
  'moveLeft',
  'moveRight',
  'moveUp',
  'moveDown',
  'jump',
  'lightAttack',
  'heavyAttack',
  'grabInteract',
  'aim',
  'fire',
  'evade',
  'pause',
  'journal',
  'quickSwap',
] as const;
