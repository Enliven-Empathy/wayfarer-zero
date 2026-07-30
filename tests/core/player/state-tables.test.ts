import { describe, expect, it } from 'vitest';
import { ALL_LOCOMOTION_STATES } from '@core/player/locomotion/states.ts';
import type { LocomotionState } from '@core/player/locomotion/states.ts';
import { LOCOMOTION_DEFS } from '@core/player/locomotion/definitions.ts';
import { ALL_ACTION_STATES, ACTION_CATEGORY } from '@core/player/action/states.ts';
import { ACTION_DEFS, actionFallback } from '@core/player/action/definitions.ts';
import { ALL_ACTIONS } from '@core/input/actions.ts';

/**
 * Structural integrity of the two state tables.
 *
 * These are the tests that make a *complete* union with an `implemented` flag
 * safer than a partial union: they prove nothing is missing, nothing is
 * malformed, and — most importantly — that `reconcile` is total, so no
 * combination of locomotion and action can leave the player in a state its own
 * body forbids.
 */
describe('locomotion table', () => {
  it('defines every state exactly once', () => {
    expect(Object.keys(LOCOMOTION_DEFS).sort()).toEqual([...ALL_LOCOMOTION_STATES].sort());
  });

  it('gives each definition the id it is filed under', () => {
    for (const state of ALL_LOCOMOTION_STATES) {
      expect(LOCOMOTION_DEFS[state].id).toBe(state);
    }
  });

  it('declares all seventeen states from the bible', () => {
    expect(ALL_LOCOMOTION_STATES).toHaveLength(17);
  });

  it('uses a non-negative gravity scale everywhere', () => {
    for (const state of ALL_LOCOMOTION_STATES) {
      expect(LOCOMOTION_DEFS[state].gravityScale).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every state a non-empty animation key', () => {
    for (const state of ALL_LOCOMOTION_STATES) {
      expect(LOCOMOTION_DEFS[state].animationKey.length).toBeGreaterThan(0);
    }
  });

  it('uses distinct animation keys', () => {
    const keys = ALL_LOCOMOTION_STATES.map((s) => LOCOMOTION_DEFS[s].animationKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('references only real states in interrupt rules', () => {
    const known = new Set<LocomotionState>(ALL_LOCOMOTION_STATES);
    for (const state of ALL_LOCOMOTION_STATES) {
      const rule = LOCOMOTION_DEFS[state].interrupt;
      if (rule.by !== 'any' && rule.by !== 'none') {
        for (const target of rule.by) expect(known.has(target)).toBe(true);
      }
      for (const target of rule.overrides) expect(known.has(target)).toBe(true);
    }
  });

  it('binds only real actions in acceptsInputs', () => {
    const known = new Set<string>(ALL_ACTIONS);
    for (const state of ALL_LOCOMOTION_STATES) {
      for (const action of LOCOMOTION_DEFS[state].acceptsInputs) {
        expect(known.has(action), `${state} accepts unknown action ${action}`).toBe(true);
      }
    }
  });

  it('gives every implemented state a way to leave, or a reason not to', () => {
    // A state with no tick and no external force is a trap: enter it and the
    // player is stuck. `Disabled` is the one legitimate exception — leaving it
    // is always someone else's decision.
    for (const state of ALL_LOCOMOTION_STATES) {
      const def = LOCOMOTION_DEFS[state];
      if (!def.implemented) continue;
      if (state === 'Disabled') continue;
      expect(def.tick, `${state} is implemented but has no tick`).toBeDefined();
    }
  });

  it('implements exactly the F1 slice', () => {
    const implemented = ALL_LOCOMOTION_STATES.filter((s) => LOCOMOTION_DEFS[s].implemented).sort();
    expect(implemented).toEqual(
      ['Disabled', 'Idle', 'JumpApex', 'JumpFall', 'JumpRise', 'Land', 'Run'].sort(),
    );
  });

  it('never lets an anchored state wield a weapon', () => {
    // Swinging a sword while hanging off a ledge is the class of bug the two
    // machines exist to prevent, so it is worth asserting directly.
    //
    // Scoped to `anchored` — hanging and climbing — rather than to scripted
    // states as well, because `Mounted` deliberately permits `weapon`: the
    // bible's Rider Rig grants a mounted slash. That is a real exception, not
    // an oversight, and a blanket rule here would have quietly forbidden it.
    for (const state of ALL_LOCOMOTION_STATES) {
      const def = LOCOMOTION_DEFS[state];
      if (def.category !== 'anchored') continue;
      expect(def.allowedActions, `${state} allows a weapon`).not.toContain('weapon');
      expect(def.allowedActions, `${state} allows aiming`).not.toContain('ranged');
    }
  });

  it('lets Mounted swing a weapon but not aim a firearm', () => {
    // Bible §7 Rider Rig: "perform mounted slash". No mounted shooting.
    expect(LOCOMOTION_DEFS.Mounted.allowedActions).toContain('weapon');
    expect(LOCOMOTION_DEFS.Mounted.allowedActions).not.toContain('ranged');
  });

  it('always permits forced actions', () => {
    // Being hurt or pulled into dialogue must never be refused by a locomotion
    // state; that is what makes those two categories `forced` in the first place.
    for (const state of ALL_LOCOMOTION_STATES) {
      expect(LOCOMOTION_DEFS[state].allowedActions, `${state} can refuse being hurt`).toContain('forced');
    }
  });

  it('always permits the empty action', () => {
    // `Free` is category 'none' — the *absence* of an action, not an action.
    // No body state can coherently forbid doing nothing with your hands, and
    // because Free is also the universal reconcile fallback, a state that
    // forbade it would leave the player wedged in an illegal action forever.
    // Ten states got this wrong on the first pass; the totality test below is
    // what found it.
    for (const state of ALL_LOCOMOTION_STATES) {
      expect(LOCOMOTION_DEFS[state].allowedActions, `${state} forbids doing nothing`).toContain('none');
    }
  });
});

describe('action table', () => {
  it('defines every state exactly once', () => {
    expect(Object.keys(ACTION_DEFS).sort()).toEqual([...ALL_ACTION_STATES].sort());
  });

  it('declares all ten states from the bible', () => {
    expect(ALL_ACTION_STATES).toHaveLength(10);
  });

  it('categorises every state', () => {
    for (const state of ALL_ACTION_STATES) {
      expect(ACTION_CATEGORY[state]).toBeDefined();
      expect(ACTION_DEFS[state].category).toBe(ACTION_CATEGORY[state]);
    }
  });

  it('keeps speed scales within a sane range', () => {
    for (const state of ALL_ACTION_STATES) {
      const scale = ACTION_DEFS[state].speedScale;
      expect(scale).toBeGreaterThanOrEqual(0);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });

  it('makes aiming slower than carrying, and carrying slower than free', () => {
    // Bible §9: aim is deliberate. If this ever inverts, ranged combat stops
    // being a commitment and becomes the default way to move.
    expect(ACTION_DEFS.Aim.speedScale).toBeLessThan(ACTION_DEFS.Carry.speedScale);
    expect(ACTION_DEFS.Carry.speedScale).toBeLessThan(ACTION_DEFS.Free.speedScale);
  });
});

describe('reconcile is total', () => {
  it('has a legal fallback for every (locomotion, action) pair', () => {
    // The property that makes the two-machine design safe: whatever the body is
    // doing, there is always somewhere legal for the hands to land. If this
    // fails, some combination leaves the player wedged in an illegal action.
    const failures: string[] = [];
    for (const loco of ALL_LOCOMOTION_STATES) {
      const allowed = LOCOMOTION_DEFS[loco].allowedActions;
      for (const action of ALL_ACTION_STATES) {
        if (allowed.includes(ACTION_CATEGORY[action])) continue;
        const fallback = actionFallback(action);
        if (!allowed.includes(ACTION_CATEGORY[fallback])) {
          failures.push(`${loco} forbids ${action}, and its fallback ${fallback} too`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('leaves forced actions alone', () => {
    expect(actionFallback('Hurt')).toBe('Hurt');
    expect(actionFallback('DialogueLocked')).toBe('DialogueLocked');
  });

  it('sends everything else to Free', () => {
    expect(actionFallback('Sword')).toBe('Free');
    expect(actionFallback('Carry')).toBe('Free');
    expect(actionFallback('Aim')).toBe('Free');
  });
});
