import { Scene, VERSION as PHASER_VERSION } from 'phaser';
import type { GameObjects } from 'phaser';
import { VIEW, COLORS, DEPTH } from '@core/tuning/world.ts';
import { MOVEMENT, JUMP_APEX_PX } from '@core/tuning/movement.ts';

/**
 * F0 boot scene.
 *
 * Its only job at this milestone is to prove the loop runs and the toolchain
 * is wired: a cleared canvas at the authored resolution, live fps, and the
 * resolved engine version. It deliberately renders nothing gameplay-related —
 * the movement laboratory arrives in F1.
 *
 * It does draw one thing on purpose: Rook's standing body box at true scale,
 * next to a marker at the analytic jump apex. Seeing 52×104 against a 152 px
 * apex from the very first build is a cheap, permanent sanity check that the
 * bible's numbers and the canvas agree.
 */
export class BootScene extends Scene {
  private fpsText!: GameObjects.Text;

  constructor() {
    super('Boot');
  }

  create(): void {
    const cx = VIEW.width / 2;
    const groundY = VIEW.height - 120;

    this.add
      .rectangle(cx, groundY + 20, VIEW.width, 40, COLORS.solid)
      .setDepth(DEPTH.terrainBehind);
    this.add
      .rectangle(cx, groundY, VIEW.width, 2, COLORS.solidEdge)
      .setDepth(DEPTH.terrainFront);

    // Rook's standing body at true scale — 52 × 104, feet on the ground line.
    const body = this.add
      .rectangle(cx, groundY - MOVEMENT.bodyHeight / 2, MOVEMENT.bodyWidth, MOVEMENT.bodyHeight, COLORS.chassis)
      .setDepth(DEPTH.player);
    body.setStrokeStyle(2, COLORS.faceLight, 0.7);

    // The face display: bible §7 rule 2 — never covered, carries the emotion.
    this.add
      .rectangle(cx - 8, groundY - MOVEMENT.bodyHeight + 22, 6, 12, COLORS.faceLight)
      .setDepth(DEPTH.player);
    this.add
      .rectangle(cx + 8, groundY - MOVEMENT.bodyHeight + 22, 6, 12, COLORS.faceLight)
      .setDepth(DEPTH.player);

    // Analytic jump apex, drawn where Rook's feet would reach.
    const apexY = groundY - JUMP_APEX_PX;
    this.add.rectangle(cx, apexY, 220, 1, COLORS.amber, 0.5).setDepth(DEPTH.groundMarkers);
    this.add
      .text(cx + 118, apexY, `jump apex ${JUMP_APEX_PX.toFixed(1)} px`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: hex(COLORS.amber),
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.groundMarkers);

    this.add
      .text(40, 36, 'WAYFARER ZERO', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: hex(COLORS.faceLight),
      })
      .setDepth(DEPTH.hud);

    this.add
      .text(40, 74, 'foundation — milestone F0', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: hex(COLORS.debugText),
      })
      .setDepth(DEPTH.hud);

    this.fpsText = this.add
      .text(40, VIEW.height - 44, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: hex(COLORS.debugText),
      })
      .setDepth(DEPTH.debugOverlay);
  }

  override update(): void {
    this.fpsText.setText(
      `phaser ${PHASER_VERSION}   ${VIEW.width}x${VIEW.height}   ${Math.round(this.game.loop.actualFps)} fps`,
    );
  }
}

/** 0xRRGGBB → '#rrggbb', for the Text style API which wants a CSS string. */
function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
