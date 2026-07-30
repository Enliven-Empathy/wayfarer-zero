import { describe, expect, it } from 'vitest';
import { MOVEMENT, JUMP_APEX_PX, JUMP_TIME_TO_APEX_MS } from '@core/tuning/movement.ts';
import { VIEW, CAMERA, DEPTH } from '@core/tuning/world.ts';

/**
 * A fence, not a tautology.
 *
 * These assertions restate the bible's §26 table literally. That looks
 * redundant until you remember the sibling project: Lionn runs gravity 1700,
 * run speed 290 and jump -570, and several of us have those numbers in muscle
 * memory. Anyone who "corrects" gravity here gets a red test naming the source
 * of truth instead of a jump arc that is quietly 30% wrong.
 *
 * Changing a value deliberately means changing it in two places, which is
 * exactly the friction a spec constant deserves.
 */
describe('movement tuning matches the bible §26 table', () => {
  it('body and world', () => {
    expect(MOVEMENT.tileSize).toBe(64);
    expect(MOVEMENT.visualHeight).toBe(128);
    expect(MOVEMENT.bodyWidth).toBe(52);
    expect(MOVEMENT.bodyHeight).toBe(104);
    expect(MOVEMENT.gravity).toBe(2200);
  });

  it('horizontal motion', () => {
    expect(MOVEMENT.runSpeed).toBe(320);
    expect(MOVEMENT.groundAccel).toBe(2400);
    expect(MOVEMENT.groundDecel).toBe(2800);
    expect(MOVEMENT.airAccel).toBe(1500);
  });

  it('vertical motion', () => {
    expect(MOVEMENT.jumpVelocity).toBe(-820);
    expect(MOVEMENT.maxFall).toBe(1200);
    expect(MOVEMENT.variableJumpCut).toBe(0.48);
  });

  it('timing windows', () => {
    expect(MOVEMENT.coyoteMs).toBe(120);
    expect(MOVEMENT.jumpBufferMs).toBe(140);
    expect(MOVEMENT.groundPoundWindowMs).toBe(350);
  });

  it('ledge probes', () => {
    expect(MOVEMENT.ledgeProbeX).toBe(20);
    expect(MOVEMENT.ledgeProbeY).toBe(40);
  });

  it('camera', () => {
    expect(CAMERA.lookAhead).toBe(120);
    expect(CAMERA.deadzoneWidth).toBe(320);
    expect(CAMERA.deadzoneHeight).toBe(180);
  });

  it('canvas', () => {
    expect(VIEW.width).toBe(1280);
    expect(VIEW.height).toBe(720);
    expect(VIEW.width / VIEW.height).toBeCloseTo(16 / 9, 5);
  });
});

describe('derived jump geometry', () => {
  it('apex is v^2 / 2g', () => {
    // 820^2 / (2 * 2200) = 672400 / 4400 = 152.82 px. Level design leans on
    // this number, so it is derived from the two constants rather than typed
    // anywhere — which is how this test caught a hand-computed 152.7 in the
    // first place.
    expect(JUMP_APEX_PX).toBeCloseTo(152.82, 1);
  });

  it('time to apex is |v| / g', () => {
    expect(JUMP_TIME_TO_APEX_MS).toBeCloseTo(372.7, 1);
  });

  it('a full jump clears more than two tiles but fewer than three', () => {
    // Sanity on the relationship between the jump and the authoring grid: a
    // level built on 64 px tiles gets a 2-tile vertical reach, not 1 and not 3.
    expect(JUMP_APEX_PX / MOVEMENT.tileSize).toBeGreaterThan(2);
    expect(JUMP_APEX_PX / MOVEMENT.tileSize).toBeLessThan(3);
  });
});

describe('tuning self-consistency', () => {
  it('crouching is shorter than standing', () => {
    expect(MOVEMENT.crouchBodyHeight).toBeLessThan(MOVEMENT.bodyHeight);
  });

  it('the physics body is narrower and shorter than the art', () => {
    // Bible §25: the body is authoritative for collision, the sprite is
    // decoration. A body larger than the art would make Rook collide with
    // things he visibly is not touching.
    expect(MOVEMENT.bodyHeight).toBeLessThan(MOVEMENT.visualHeight);
    expect(MOVEMENT.bodyWidth).toBeLessThan(MOVEMENT.visualHeight);
  });

  it('deceleration is brisker than acceleration on the ground', () => {
    // Bible §8: "responsive acceleration with immediate reversal at low speed".
    expect(MOVEMENT.groundDecel).toBeGreaterThan(MOVEMENT.groundAccel);
  });

  it('air control is weaker than ground control', () => {
    expect(MOVEMENT.airAccel).toBeLessThan(MOVEMENT.groundAccel);
  });

  it('terminal velocity is above the jump impulse', () => {
    // Otherwise Rook would fall faster than he can launch, which reads as the
    // world dragging him down and makes long drops unrecoverable.
    expect(MOVEMENT.maxFall).toBeGreaterThan(Math.abs(MOVEMENT.jumpVelocity));
  });

  it('the jump buffer is more forgiving than the coyote window', () => {
    // Both are generosity, but a late press should be forgiven more readily
    // than a late floor: buffering costs the player nothing, coyote time can
    // create a jump out of thin air.
    expect(MOVEMENT.jumpBufferMs).toBeGreaterThan(MOVEMENT.coyoteMs);
  });
});

describe('depth budget', () => {
  it('is strictly ordered back to front', () => {
    // Lionn shipped its only readability cue at depth 1, behind everything,
    // and nobody saw it for months. An ordered table plus this test means a
    // new layer inserted in the wrong place fails immediately.
    const values = Object.values(DEPTH);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it('has no duplicate layers', () => {
    const values = Object.values(DEPTH);
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps the debug overlay above every gameplay layer', () => {
    const gameplayMax = Math.max(
      DEPTH.player,
      DEPTH.effects,
      DEPTH.overheadMarkers,
      DEPTH.foregroundOcclusion,
      DEPTH.hud,
    );
    expect(DEPTH.debugOverlay).toBeGreaterThan(gameplayMax);
  });
});
