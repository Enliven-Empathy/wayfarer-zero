import { describe, expect, it } from 'vitest';
import { InputBuffer } from '@core/input/InputBuffer.ts';
import type { GameAction } from '@core/input/actions.ts';
import { ALL_ACTIONS } from '@core/input/actions.ts';
import { DEFAULT_KEYBOARD, DEFAULT_GAMEPAD } from '@core/input/bindings.ts';

function frame(input: InputBuffer, timeMs: number, held: GameAction[] = [], axisX = 0): void {
  input.update({ held: new Set(held), axisX, timeMs });
}

describe('InputBuffer edges', () => {
  it('tracks held state', () => {
    const input = new InputBuffer();
    frame(input, 0);
    expect(input.held('jump')).toBe(false);
    frame(input, 16, ['jump']);
    expect(input.held('jump')).toBe(true);
    frame(input, 32);
    expect(input.held('jump')).toBe(false);
  });

  it('timestamps presses and releases', () => {
    const input = new InputBuffer();
    frame(input, 0);
    frame(input, 100, ['jump']);
    frame(input, 150, ['jump']);
    expect(input.sincePress('jump')).toBe(50);
    frame(input, 200);
    expect(input.sinceRelease('jump')).toBe(0);
  });

  it('reports an unpressed action as infinitely stale', () => {
    const input = new InputBuffer();
    frame(input, 1000);
    expect(input.sincePress('fire')).toBe(Number.POSITIVE_INFINITY);
    expect(input.pressedWithin('fire', 10_000)).toBe(false);
  });
});

describe('consumePress — the double-spend guard', () => {
  it('yields exactly one press no matter how long the button is held', () => {
    // This is the whole point of the class. In Lionn a held jump button
    // refreshed its "pressed recently" answer every frame, so the ground jump
    // fired and then the air jump fired off the same physical press, burning
    // the double jump instantly.
    const input = new InputBuffer();
    frame(input, 0);

    let consumed = 0;
    for (let i = 1; i <= 10; i += 1) {
      frame(input, i * 16, ['jump']);
      if (input.consumePress('jump', 140)) consumed += 1;
    }
    expect(consumed).toBe(1);
  });

  it('re-arms only after a genuine release and press', () => {
    const input = new InputBuffer();
    frame(input, 0);

    frame(input, 16, ['jump']);
    expect(input.consumePress('jump', 140)).toBe(true);

    frame(input, 32, ['jump']);
    expect(input.consumePress('jump', 140)).toBe(false);

    frame(input, 48); // released
    frame(input, 64, ['jump']); // pressed again
    expect(input.consumePress('jump', 140)).toBe(true);
  });

  it('refuses a press older than the window', () => {
    const input = new InputBuffer();
    frame(input, 0);
    frame(input, 100, ['jump']);
    frame(input, 300, ['jump']);
    expect(input.consumePress('jump', 140)).toBe(false);
  });

  it('clearPress discards a pending press without acting on it', () => {
    const input = new InputBuffer();
    frame(input, 0);
    frame(input, 16, ['jump']);
    input.clearPress('jump');
    expect(input.consumePress('jump', 140)).toBe(false);
  });

  it('keeps actions independent', () => {
    const input = new InputBuffer();
    frame(input, 0);
    frame(input, 16, ['jump', 'lightAttack']);
    expect(input.consumePress('jump', 140)).toBe(true);
    expect(input.consumePress('lightAttack', 140)).toBe(true);
  });
});

describe('binding tables', () => {
  it('binds every action on the keyboard', () => {
    const unbound = ALL_ACTIONS.filter((a) => (DEFAULT_KEYBOARD[a] ?? []).length === 0);
    expect(unbound, `unbound keyboard actions: ${unbound.join(', ')}`).toEqual([]);
  });

  it('binds every action on the gamepad', () => {
    const unbound = ALL_ACTIONS.filter((a) => (DEFAULT_GAMEPAD[a] ?? []).length === 0);
    expect(unbound, `unbound gamepad actions: ${unbound.join(', ')}`).toEqual([]);
  });

  it('never maps one physical key to two actions', () => {
    // A collision here means one of the two actions silently never fires, which
    // is close to impossible to diagnose from inside the game.
    const seen = new Map<string, GameAction>();
    const clashes: string[] = [];
    for (const action of ALL_ACTIONS) {
      for (const code of DEFAULT_KEYBOARD[action] ?? []) {
        const owner = seen.get(code);
        if (owner !== undefined) clashes.push(`${code}: ${owner} and ${action}`);
        else seen.set(code, action);
      }
    }
    expect(clashes, clashes.join('; ')).toEqual([]);
  });

  it('never maps one gamepad button to two actions', () => {
    const seen = new Map<number, GameAction>();
    const clashes: string[] = [];
    for (const action of ALL_ACTIONS) {
      for (const button of DEFAULT_GAMEPAD[action] ?? []) {
        const owner = seen.get(button);
        if (owner !== undefined) clashes.push(`button ${button}: ${owner} and ${action}`);
        else seen.set(button, action);
      }
    }
    expect(clashes, clashes.join('; ')).toEqual([]);
  });

  it('binds no action that is not in the action union', () => {
    const known = new Set<string>(ALL_ACTIONS);
    expect(Object.keys(DEFAULT_KEYBOARD).filter((k) => !known.has(k))).toEqual([]);
    expect(Object.keys(DEFAULT_GAMEPAD).filter((k) => !known.has(k))).toEqual([]);
  });
});
