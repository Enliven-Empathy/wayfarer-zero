import { describe, expect, it } from 'vitest';
import { JumpController } from '@core/player/jump.ts';
import { InputBuffer } from '@core/input/InputBuffer.ts';
import { MOVEMENT } from '@core/tuning/movement.ts';
import { Sim } from '../../fixtures/sim.ts';

/**
 * Coyote time and jump buffering, asserted at millisecond precision.
 *
 * These run against `JumpController` directly rather than through the sim,
 * because a 60 Hz sim can only resolve to 16.7 ms and the windows are 120 and
 * 140 ms — the boundary cases that matter (119 vs 121) fall inside a single
 * frame. The integration tests at the bottom then confirm the same behaviour
 * survives the full brain.
 */

/** Drive an InputBuffer directly with a held/not-held timeline. */
function press(input: InputBuffer, timeMs: number): void {
  input.update({ held: new Set(['jump' as const]), axisX: 0, timeMs });
}
function release(input: InputBuffer, timeMs: number): void {
  input.update({ held: new Set(), axisX: 0, timeMs });
}

describe('coyote time', () => {
  it('allows a jump inside the window after leaving the ground', () => {
    const jump = new JumpController();
    const input = new InputBuffer();

    jump.noteGrounded(0, true);
    release(input, 0);
    // Airborne from t=0. Press at 119 ms — 1 ms inside the 120 ms window.
    press(input, 119);
    expect(jump.tryJump(input, 119, false)).toBe(true);
  });

  it('refuses a jump past the window', () => {
    const jump = new JumpController();
    const input = new InputBuffer();

    jump.noteGrounded(0, true);
    release(input, 0);
    press(input, 121);
    expect(jump.tryJump(input, 121, false)).toBe(false);
  });

  it('is exactly inclusive at the boundary', () => {
    const jump = new JumpController();
    const input = new InputBuffer();
    jump.noteGrounded(0, true);
    release(input, 0);
    press(input, MOVEMENT.coyoteMs);
    expect(jump.tryJump(input, MOVEMENT.coyoteMs, false)).toBe(true);
  });

  it('one walk-off supplies only one jump', () => {
    // Without spending the coyote window on use, a fast double-tap inside
    // 120 ms would produce two jumps from a single ledge — a free double jump
    // Rook is not supposed to have.
    const jump = new JumpController();
    const input = new InputBuffer();

    jump.noteGrounded(0, true);
    release(input, 0);
    press(input, 20);
    expect(jump.tryJump(input, 20, false)).toBe(true);

    release(input, 30);
    press(input, 40);
    expect(jump.tryJump(input, 40, false)).toBe(false);
  });

  it('is cancelled by a deliberate drop-through', () => {
    // Bible §26. Otherwise Down-to-drop then Jump hands back the platform you
    // just chose to leave, which reads as the game ignoring your input.
    const jump = new JumpController();
    const input = new InputBuffer();

    jump.noteGrounded(0, true);
    release(input, 0);
    jump.noteDropThrough();
    press(input, 20);
    expect(jump.tryJump(input, 20, false)).toBe(false);
    expect(jump.coyoteRemainingMs(20)).toBe(0);
  });

  it('reports remaining grace for the debug overlay', () => {
    const jump = new JumpController();
    jump.noteGrounded(0, true);
    expect(jump.coyoteRemainingMs(0)).toBe(MOVEMENT.coyoteMs);
    expect(jump.coyoteRemainingMs(100)).toBe(20);
    expect(jump.coyoteRemainingMs(500)).toBe(0);
  });
});

describe('jump buffering', () => {
  it('fires a jump pressed shortly before landing', () => {
    const jump = new JumpController();
    const input = new InputBuffer();

    release(input, 0);
    press(input, 0); // pressed while still airborne
    expect(jump.tryJump(input, 0, false)).toBe(false); // no coyote, no ground

    // Land 139 ms later — 1 ms inside the 140 ms buffer.
    jump.noteGrounded(139, true);
    input.update({ held: new Set(['jump' as const]), axisX: 0, timeMs: 139 });
    expect(jump.tryJump(input, 139, true)).toBe(true);
  });

  it('drops a press that is too old', () => {
    const jump = new JumpController();
    const input = new InputBuffer();

    release(input, 0);
    press(input, 0);
    jump.noteGrounded(141, true);
    input.update({ held: new Set(['jump' as const]), axisX: 0, timeMs: 141 });
    expect(jump.tryJump(input, 141, true)).toBe(false);
  });
});

describe('variable-height cut', () => {
  it('trims upward velocity once when the button is released', () => {
    const jump = new JumpController();
    const input = new InputBuffer();
    jump.noteGrounded(0, true);
    press(input, 0);
    expect(jump.tryJump(input, 0, true)).toBe(true);

    const cut = jump.applyVariableCut(-800, false);
    expect(cut).toBeCloseTo(-800 * MOVEMENT.variableJumpCut, 6);
  });

  it('applies at most once per jump', () => {
    // The latch. Without it the cut re-applies every frame the button is up and
    // the jump does not shorten, it collapses — which looks like a tuning
    // problem and is not one.
    const jump = new JumpController();
    const input = new InputBuffer();
    jump.noteGrounded(0, true);
    press(input, 0);
    jump.tryJump(input, 0, true);

    expect(jump.applyVariableCut(-800, false)).not.toBeNull();
    expect(jump.applyVariableCut(-380, false)).toBeNull();
    expect(jump.applyVariableCut(-200, false)).toBeNull();
  });

  it('does nothing while the button is still held', () => {
    const jump = new JumpController();
    const input = new InputBuffer();
    jump.noteGrounded(0, true);
    press(input, 0);
    jump.tryJump(input, 0, true);
    expect(jump.applyVariableCut(-800, true)).toBeNull();
  });

  it('does nothing once already falling', () => {
    // Cutting a positive vy would *slow the descent* — a jump that hangs in the
    // air when you let go, the exact opposite of the intended feel.
    const jump = new JumpController();
    const input = new InputBuffer();
    jump.noteGrounded(0, true);
    press(input, 0);
    jump.tryJump(input, 0, true);
    expect(jump.applyVariableCut(300, false)).toBeNull();
  });

  it('re-arms for the next jump', () => {
    const jump = new JumpController();
    const input = new InputBuffer();

    jump.noteGrounded(0, true);
    press(input, 0);
    jump.tryJump(input, 0, true);
    expect(jump.applyVariableCut(-800, false)).not.toBeNull();

    release(input, 100);
    jump.noteGrounded(200, true);
    press(input, 200);
    jump.tryJump(input, 200, true);
    expect(jump.applyVariableCut(-800, false)).not.toBeNull();
  });
});

describe('through the full brain', () => {
  it('a coyote jump off a removed floor still launches', () => {
    const sim = new Sim();
    sim.step();
    sim.removeGround();
    sim.step(); // now airborne, coyote clock running
    expect(sim.grounded).toBe(false);

    sim.hold('jump');
    const result = sim.step();
    expect(result.locomotion).toBe('JumpRise');
    expect(sim.vy).toBeLessThan(0);
  });

  it('a stale coyote window does not launch', () => {
    const sim = new Sim();
    sim.step();
    sim.removeGround();
    sim.run(20); // ~333 ms, far past the 120 ms window
    sim.hold('jump');
    const result = sim.step();
    expect(result.locomotion).toBe('JumpFall');
  });

  it('holding jump does not chain a second jump in mid-air', () => {
    // The `consumePress` double-spend guard, end to end. In Lionn a held button
    // refreshed the press timestamp every frame and burned the air jump the
    // instant one existed.
    const sim = new Sim();
    sim.step();
    sim.hold('jump');
    sim.run(30); // held throughout the whole arc
    const peak = sim.y;
    sim.run(30);
    // One arc only: he comes back down rather than climbing repeatedly.
    expect(sim.y).toBeGreaterThan(peak);
  });
});
