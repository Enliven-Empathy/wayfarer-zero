/**
 * Default bindings — bible §27.
 *
 * **Data, not code.** Lionn hard-wired its key→action map in an imperative
 * constructor, which meant remapping was impossible without editing the input
 * class, and the bible requires fully remappable controls. Expressing bindings
 * as a table makes remapping a matter of replacing this object at runtime, and
 * makes "every action is bound" and "no key does two jobs" testable.
 */

/** `KeyboardEvent.code` values. Codes, not `key`, so bindings are
 *  layout-independent — a French AZERTY player still gets WASD under the same
 *  fingers, which `key` would not give them. */
export interface KeyboardBindings {
  readonly [action: string]: readonly string[];
}

/**
 * W3C Standard Gamepad button indices.
 *
 * Phaser 4 still does not expose `pad.mapping`, so the adapter must decide for
 * itself whether a pad is standard-layout; the ≥12-button heuristic carried
 * over from Lionn is what it uses.
 */
export const GAMEPAD_BUTTON = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  leftBumper: 4,
  rightBumper: 5,
  leftTrigger: 6,
  rightTrigger: 7,
  select: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

export interface GamepadBindings {
  readonly [action: string]: readonly number[];
}

export const DEFAULT_KEYBOARD: KeyboardBindings = {
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  lightAttack: ['KeyJ'],
  heavyAttack: ['KeyK'],
  grabInteract: ['KeyL'],
  aim: ['KeyU'],
  fire: ['KeyI'],
  evade: ['ShiftLeft'],
  pause: ['Escape'],
  journal: ['Tab'],
  quickSwap: ['KeyQ'],
};

export const DEFAULT_GAMEPAD: GamepadBindings = {
  moveLeft: [GAMEPAD_BUTTON.dpadLeft],
  moveRight: [GAMEPAD_BUTTON.dpadRight],
  moveUp: [GAMEPAD_BUTTON.dpadUp],
  moveDown: [GAMEPAD_BUTTON.dpadDown],
  jump: [GAMEPAD_BUTTON.south],
  lightAttack: [GAMEPAD_BUTTON.west],
  heavyAttack: [GAMEPAD_BUTTON.north],
  grabInteract: [GAMEPAD_BUTTON.east],
  aim: [GAMEPAD_BUTTON.leftTrigger],
  fire: [GAMEPAD_BUTTON.rightTrigger],
  evade: [GAMEPAD_BUTTON.leftBumper],
  pause: [GAMEPAD_BUTTON.start],
  journal: [GAMEPAD_BUTTON.select],
  quickSwap: [GAMEPAD_BUTTON.rightBumper],
};

/**
 * Gamepad hardware constants, carried over from Lionn where each one was paid
 * for with a real bug.
 */
export const GAMEPAD_TUNING = {
  /** Below this, the stick reads as centred. A DualSense at rest routinely
   *  reports 0.1–0.2 on a worn stick; 0.28 clears that without feeling numb. */
  stickDeadzone: 0.28,

  /**
   * Analog triggers report a continuous value, and a DualSense over Bluetooth
   * dips below a single threshold repeatedly while held — which chattered
   * Lionn's crouch on and off several times a second. A hysteresis latch fixes
   * it: cross `triggerEnter` to engage, fall below `triggerExit` to release.
   */
  triggerEnter: 0.35,
  triggerExit: 0.15,

  /** Phaser 4 still does not surface `pad.mapping`, so a standard layout is
   *  inferred from button count. */
  standardPadMinButtons: 12,
} as const;
