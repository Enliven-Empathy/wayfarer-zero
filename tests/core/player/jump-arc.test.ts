import { describe, expect, it } from 'vitest';
import { Sim, FIXED_DT_MS } from '../../fixtures/sim.ts';
import { MOVEMENT, JUMP_APEX_PX } from '@core/tuning/movement.ts';

/**
 * The jump arc, measured rather than asserted from theory.
 *
 * There is a real and permanent gap between the analytic apex and the one a
 * player gets, and it is worth pinning down here rather than discovering it as
 * "that platform looks reachable but isn't":
 *
 *   analytic  v²/2g            = 820² / 4400 = 152.82 px
 *   simulated semi-implicit Euler at 60 Hz  ≈ 146 px
 *
 * Semi-implicit Euler applies a full frame of gravity before the position step,
 * so it systematically undershoots by about g·dt²/2 per frame — roughly 4.4%
 * here. That is normal, and every commercial platformer lives with it. What is
 * *not* safe is validating level geometry against the analytic number: a
 * platform placed at 150 px would pass the check and be physically unreachable.
 */
describe('jump arc', () => {
  function measureJump(holdFrames: number): { rise: number; timeToApexMs: number; frames: number } {
    const sim = new Sim();
    sim.step(); // settle on the floor
    const startY = sim.y;

    sim.hold('jump');
    let best = startY;
    let apexFrame = 0;

    for (let i = 0; i < 120; i += 1) {
      if (i === holdFrames) sim.release('jump');
      sim.step();
      if (sim.y < best) {
        best = sim.y;
        apexFrame = i + 1;
      }
      if (i > holdFrames && sim.grounded) break;
    }

    return { rise: startY - best, timeToApexMs: apexFrame * FIXED_DT_MS, frames: apexFrame };
  }

  it('a full held jump rises close to, but below, the analytic apex', () => {
    const { rise } = measureJump(60);
    expect(rise).toBeGreaterThan(140);
    expect(rise).toBeLessThan(JUMP_APEX_PX);
    // Pinned tightly so a change to gravity, jump velocity or the integrator
    // shows up as a failure here rather than as a level that stops working.
    expect(rise).toBeCloseTo(146, 0);
  });

  it('discretisation costs about 4-5% of the analytic apex', () => {
    const { rise } = measureJump(60);
    const shortfall = (JUMP_APEX_PX - rise) / JUMP_APEX_PX;
    expect(shortfall).toBeGreaterThan(0.03);
    expect(shortfall).toBeLessThan(0.06);
  });

  it('reaches its apex at about |v| / g', () => {
    const { timeToApexMs } = measureJump(60);
    // 820 / 2200 = 372.7 ms. One frame of slack for the discrete sampling.
    expect(timeToApexMs).toBeGreaterThan(355);
    expect(timeToApexMs).toBeLessThan(390);
  });

  it('a tapped jump is markedly shorter than a held one', () => {
    const held = measureJump(60).rise;
    const tapped = measureJump(3).rise;
    expect(tapped).toBeLessThan(held * 0.75);
    expect(tapped).toBeGreaterThan(20); // still a real jump, not a stumble
  });

  it('longer holds produce monotonically higher jumps up to the full arc', () => {
    // The property players actually feel: more hold, more height, no dead zones.
    const heights = [1, 3, 6, 10, 20, 40].map((f) => measureJump(f).rise);
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThanOrEqual((heights[i - 1] ?? 0) - 0.001);
    }
  });

  it('lands back on the ground it left', () => {
    const sim = new Sim();
    sim.step();
    const startY = sim.y;
    sim.hold('jump');
    sim.step();
    sim.release('jump');
    const frames = sim.runUntil((s) => s.grounded && s.last.locomotion === 'Land');
    expect(frames).toBeGreaterThan(0);
    expect(sim.y).toBeCloseTo(startY, 6);
  });

  it('terminal velocity caps a long fall', () => {
    const sim = new Sim({ hasGround: false });
    sim.run(400);
    expect(sim.vy).toBe(MOVEMENT.maxFall);
  });
});
