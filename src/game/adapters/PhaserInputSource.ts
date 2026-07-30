import type { Input, Scene } from 'phaser';
import type { GameAction } from '@core/input/actions.ts';
import { ALL_ACTIONS } from '@core/input/actions.ts';
import { DEFAULT_GAMEPAD, DEFAULT_KEYBOARD, GAMEPAD_TUNING } from '@core/input/bindings.ts';
import type { RawInputFrame } from '@core/input/InputBuffer.ts';

/** Standard-gamepad indices for the analog triggers. */
const LEFT_TRIGGER = 6;
const RIGHT_TRIGGER = 7;

/**
 * Turns keyboard and gamepad hardware into a `RawInputFrame`.
 *
 * **Keyboard state is read from raw DOM events, not from Phaser `Key` objects.**
 * That is deliberate. The binding table is written in `KeyboardEvent.code`
 * values (`KeyD`, `ArrowRight`, `ShiftLeft`) because `code` is physical-position
 * based, so a French AZERTY player gets WASD under the same fingers — which
 * `key` would not give them. Phaser's `addKey()` does not speak that vocabulary:
 * it resolves strings through its own `KeyCodes` map, where `'Space'` happens to
 * match but `'ArrowRight'` and `'KeyD'` silently do not. Passing `code` values to
 * `addKey` produced a build where jump worked and nothing else did, with no
 * error anywhere.
 *
 * Listening directly also avoids Phaser's per-key plugin bookkeeping, which is
 * what accumulated listeners and eventually killed the render loop in the
 * sibling project.
 *
 * `boot.ts` still declares Phaser's `capture` list, which is what calls
 * `preventDefault` so the browser stops scrolling on SPACE and the arrows.
 *
 * The gamepad path stays on Phaser's plugin, which is a good fit there.
 */
export class PhaserInputSource {
  private readonly pressedCodes = new Set<string>();
  /** Latched trigger state, per action. See `readTrigger`. */
  private readonly triggerLatched = new Map<GameAction, boolean>();
  private readonly scene: Scene;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressedCodes.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedCodes.delete(event.code);
  };
  /**
   * Alt-tabbing away while holding a key never delivers the keyup, so the key
   * stays "held" forever and Rook runs into a wall until you press and release
   * it again. Clearing on blur is the standard fix.
   */
  private readonly onBlur = (): void => {
    this.pressedCodes.clear();
  };

  constructor(scene: Scene) {
    this.scene = scene;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  read(timeMs: number): RawInputFrame {
    const held = new Set<GameAction>();
    for (const action of ALL_ACTIONS) {
      if (this.keyboardHeld(action) || this.gamepadHeld(action)) held.add(action);
    }
    return { held, axisX: this.axisX(held), timeMs };
  }

  private keyboardHeld(action: GameAction): boolean {
    for (const code of DEFAULT_KEYBOARD[action] ?? []) {
      if (this.pressedCodes.has(code)) return true;
    }
    return false;
  }

  private pad(): Input.Gamepad.Gamepad | null {
    const plugin = this.scene.input.gamepad;
    if (!plugin || plugin.total === 0) return null;
    const pad = plugin.getPad(0);
    if (!pad) return null;
    // Phaser 4 still does not expose `pad.mapping`, so a standard layout has to
    // be inferred. Below this count the button indices in our binding table are
    // meaningless and would map to arbitrary hardware.
    if (pad.buttons.length < GAMEPAD_TUNING.standardPadMinButtons) return null;
    return pad;
  }

  private gamepadHeld(action: GameAction): boolean {
    const pad = this.pad();
    if (pad === null) return false;

    for (const index of DEFAULT_GAMEPAD[action] ?? []) {
      const button = pad.buttons[index];
      if (button === undefined) continue;

      // Analog triggers report a continuous value and Phaser's default
      // `threshold` is 1, so `pressed` is effectively never true for them.
      if (index === LEFT_TRIGGER || index === RIGHT_TRIGGER) {
        if (this.readTrigger(action, button.value)) return true;
        continue;
      }

      if (button.pressed) return true;
    }
    return false;
  }

  /**
   * Hysteresis latch for analog triggers.
   *
   * A DualSense over Bluetooth dips below any single threshold repeatedly while
   * the trigger is held, which chattered Lionn's crouch on and off several
   * times a second. Two thresholds — cross 0.35 to engage, fall under 0.15 to
   * release — turn that noise into a stable signal.
   */
  private readTrigger(action: GameAction, value: number): boolean {
    const latched = this.triggerLatched.get(action) ?? false;
    const next = latched ? value > GAMEPAD_TUNING.triggerExit : value >= GAMEPAD_TUNING.triggerEnter;
    this.triggerLatched.set(action, next);
    return next;
  }

  /**
   * Horizontal axis, quantised to −1 / 0 / +1.
   *
   * The stick's analog magnitude is deliberately discarded: two ground speeds
   * in a side-scroller read as an input bug, not as nuance. Keyboard and stick
   * therefore produce identical movement, which also keeps the two control
   * schemes honestly comparable during tuning.
   */
  private axisX(held: ReadonlySet<GameAction>): number {
    const pad = this.pad();
    if (pad !== null) {
      const raw = pad.leftStick.x;
      if (Math.abs(raw) >= GAMEPAD_TUNING.stickDeadzone) return raw > 0 ? 1 : -1;
    }
    const left = held.has('moveLeft');
    const right = held.has('moveRight');
    // Both directions at once resolves to neutral rather than to whichever was
    // checked last — arbitrary tie-breaking here feels like a stuck key.
    if (left === right) return 0;
    return right ? 1 : -1;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.pressedCodes.clear();
    this.triggerLatched.clear();
  }
}
