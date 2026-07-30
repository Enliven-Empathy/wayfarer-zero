import { describe, expect, it } from 'vitest';
import { integrateHorizontal, integrateVertical } from '@core/physics/integrate.ts';
import type { HorizontalControl } from '@core/physics/integrate.ts';
import { MOVEMENT } from '@core/tuning/movement.ts';

const DT = 1 / 60;

function accelerate(args: {
  from: number;
  axisX: number;
  grounded: boolean;
  control?: HorizontalControl;
  speedScale?: number;
  frames: number;
}): number {
  let vx = args.from;
  for (let i = 0; i < args.frames; i += 1) {
    vx = integrateHorizontal({
      vx,
      axisX: args.axisX,
      dtSec: DT,
      control: args.control ?? 'full',
      grounded: args.grounded,
      speedScale: args.speedScale ?? 1,
    });
  }
  return vx;
}

/**
 * Frames needed to reach `target`, or -1.
 *
 * The comparison direction is driven by whether we start above or below the
 * target, NOT by the input axis — a decelerating body has `axisX === 0` while
 * still needing a downward comparison, and keying off the axis made
 * "stop from full speed" report 1 frame because 320 is already `>= 0`.
 */
function framesTo(args: { axisX: number; grounded: boolean; target: number; from?: number }): number {
  const start = args.from ?? 0;
  const rising = args.target > start;
  let vx = start;
  for (let i = 1; i <= 600; i += 1) {
    vx = integrateHorizontal({
      vx,
      axisX: args.axisX,
      dtSec: DT,
      control: 'full',
      grounded: args.grounded,
      speedScale: 1,
    });
    if (rising ? vx >= args.target : vx <= args.target) return i;
  }
  return -1;
}

describe('horizontal integration', () => {
  it('reaches run speed on the ground in the time the tuning implies', () => {
    // 320 / 2400 = 0.1333 s = 8 frames at 60 Hz.
    expect(framesTo({ axisX: 1, grounded: true, target: MOVEMENT.runSpeed })).toBe(8);
  });

  it('stops from full speed using the deceleration magnitude, not the acceleration one', () => {
    // 320 / 2800 = 0.1143 s ≈ 7 frames. If decel were wrongly reading accel it
    // would take 8, so this genuinely distinguishes the two paths.
    expect(framesTo({ axisX: 0, grounded: true, target: 0, from: MOVEMENT.runSpeed })).toBe(7);
  });

  it('accelerates more slowly in the air', () => {
    // 320 / 1500 = 0.2133 s ≈ 13 frames.
    expect(framesTo({ axisX: 1, grounded: false, target: MOVEMENT.runSpeed })).toBe(13);
  });

  it('never overshoots the target, even with an absurd timestep', () => {
    // A stalled frame or a backgrounded tab produces a huge dt. Without the
    // target clamp this overshoots and the next frame steps back — a visible
    // jitter at exactly the moment the game is already struggling.
    const vx = integrateHorizontal({
      vx: 0,
      axisX: 1,
      dtSec: 5,
      control: 'full',
      grounded: true,
      speedScale: 1,
    });
    expect(vx).toBe(MOVEMENT.runSpeed);
  });

  it('reverses direction without a dead spot', () => {
    const vx = accelerate({ from: MOVEMENT.runSpeed, axisX: -1, grounded: true, frames: 20 });
    expect(vx).toBe(-MOVEMENT.runSpeed);
  });

  it('scales the target by speedScale', () => {
    const vx = accelerate({ from: 0, axisX: 1, grounded: true, frames: 60, speedScale: 0.5 });
    expect(vx).toBeCloseTo(MOVEMENT.runSpeed * 0.5, 6);
  });

  it('reduced control tops out below full control', () => {
    const full = accelerate({ from: 0, axisX: 1, grounded: true, frames: 60, control: 'full' });
    const reduced = accelerate({ from: 0, axisX: 1, grounded: true, frames: 60, control: 'reduced' });
    expect(reduced).toBeLessThan(full);
    expect(reduced).toBeCloseTo(MOVEMENT.runSpeed * MOVEMENT.reducedControlFactor, 6);
  });

  it('locked control decays to a stop regardless of input', () => {
    const vx = accelerate({ from: MOVEMENT.runSpeed, axisX: 1, grounded: true, frames: 60, control: 'locked' });
    expect(vx).toBe(0);
  });

  it('scripted control returns the velocity untouched', () => {
    // The distinction that matters: `locked` bleeds to zero, `scripted` holds.
    // A dash implemented on `locked` would decelerate mid-dash.
    const vx = accelerate({ from: 999, axisX: -1, grounded: false, frames: 60, control: 'scripted' });
    expect(vx).toBe(999);
  });
});

describe('vertical integration', () => {
  it('converges exactly on terminal velocity and never exceeds it', () => {
    let vy = 0;
    for (let i = 0; i < 600; i += 1) {
      vy = integrateVertical(vy, 1, MOVEMENT.maxFall, DT);
      expect(vy).toBeLessThanOrEqual(MOVEMENT.maxFall);
    }
    expect(vy).toBe(MOVEMENT.maxFall);
  });

  it('gravityScale 0 freezes vertical motion completely', () => {
    // Only true because world gravity is configured to zero and all gravity is
    // per-body. With a non-zero world value this would still fall, and every
    // anchored state (ledge hang, climb, pound prime) would quietly slide.
    expect(integrateVertical(-100, 0, MOVEMENT.maxFall, DT)).toBe(-100);
  });

  it('honours a raised per-frame fall cap', () => {
    let vy = 0;
    for (let i = 0; i < 600; i += 1) vy = integrateVertical(vy, 1, 1800, DT);
    expect(vy).toBe(1800);
  });
});
