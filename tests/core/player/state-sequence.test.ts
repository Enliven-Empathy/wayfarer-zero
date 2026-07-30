import { describe, expect, it } from 'vitest';
import { Sim } from '../../fixtures/sim.ts';
import type { LocomotionState } from '@core/player/locomotion/states.ts';

/**
 * The order states are actually visited in.
 *
 * Individual state definitions can each be correct while the *sequence* is
 * wrong, and the sequence is what the player and the animation system see. The
 * first bug this suite caught: `contacts` is resolved at the end of a physics
 * step and read at the start of the next one, so on the frame a jump launches
 * it still reports `down: true`. `JumpRise` checked contacts alone and
 * immediately requested `Land`, so every jump ran
 * `Idle → JumpRise → Land → JumpFall` — the rise state existed for one tick and
 * was never observable. The arc was perfect, which is exactly why nothing else
 * noticed.
 */
function sequenceOf(results: readonly { locomotion: LocomotionState }[]): LocomotionState[] {
  const out: LocomotionState[] = [];
  for (const r of results) {
    if (out[out.length - 1] !== r.locomotion) out.push(r.locomotion);
  }
  return out;
}

describe('jump state sequence', () => {
  it('passes through rise, apex and fall in order', () => {
    const sim = new Sim();
    // The warm-up frames are recorded too, so the sequence includes the state
    // he started from rather than beginning mid-jump.
    const settle = sim.run(3);
    sim.hold('jump');
    const results = sim.run(60);
    sim.release('jump');

    const seq = sequenceOf([...settle, ...results]);
    expect(seq).toEqual(['Idle', 'JumpRise', 'JumpApex', 'JumpFall', 'Land', 'Idle']);
  });

  it('never enters Land while still moving upward', () => {
    // The general invariant behind the fix. A stale contact flag must not be
    // able to land him mid-rise.
    const sim = new Sim();
    sim.run(3);
    sim.hold('jump');
    for (let i = 0; i < 60; i += 1) {
      const r = sim.step();
      if (r.locomotion === 'Land') {
        expect(sim.vy).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('holds JumpRise for a meaningful stretch, not one frame', () => {
    // 820 px/s down to the 140 px/s apex band at 2200 px/s² is ~309 ms — about
    // 18 frames. If this collapses to 1 the stale-contact bug is back.
    const sim = new Sim();
    sim.run(3);
    sim.hold('jump');
    const results = sim.run(60);
    const riseFrames = results.filter((r) => r.locomotion === 'JumpRise').length;
    expect(riseFrames).toBeGreaterThan(12);
  });

  it('walking off a ledge goes straight to JumpFall, with no rise', () => {
    const sim = new Sim();
    sim.axisX = 1;
    sim.run(5);
    sim.removeGround();
    const results = sim.run(20);
    const seq = sequenceOf(results);
    expect(seq).toContain('JumpFall');
    expect(seq).not.toContain('JumpRise');
    expect(seq).not.toContain('JumpApex');
  });
});

describe('ground state sequence', () => {
  it('idle to run and back', () => {
    const sim = new Sim();
    const settle = sim.run(3);
    sim.axisX = 1;
    const running = sim.run(20);
    sim.axisX = 0;
    const stopping = sim.run(30);

    expect(sequenceOf([...settle, ...running, ...stopping])).toEqual(['Idle', 'Run', 'Idle']);
  });

  it('emits a landing effect exactly once per landing', () => {
    const sim = new Sim();
    sim.run(3);
    sim.hold('jump');
    const results = sim.run(80);
    const landings = results.flatMap((r) => r.effects).filter((e) => e.kind === 'sfx' && e.id === 'land');
    expect(landings).toHaveLength(1);
  });

  it('reports the animation key of the state it is in', () => {
    const sim = new Sim();
    sim.run(3);
    expect(sim.last.animationKey).toBe('idle');
    sim.axisX = 1;
    sim.run(10);
    expect(sim.last.animationKey).toBe('run');
    sim.hold('jump');
    sim.run(2);
    expect(sim.last.animationKey).toBe('jump');
  });
});
