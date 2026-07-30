import type { GameObjects, Scene } from 'phaser';
import { COLORS, DEPTH, VIEW } from '@core/tuning/world.ts';
import type { PlayerDebugFrame, PlayerEffect } from '@core/player/types.ts';

const RECENT_EVENT_LIMIT = 5;

/**
 * The developer overlay — bible §37. Backquote toggles it.
 *
 * It reads `PlayerDebugFrame` and nothing else. That constraint matters: an
 * overlay that queries physics directly can disagree with the brain, and then
 * you are debugging the debugger. Here, if the overlay says `coyote 84 ms`,
 * that is the number the jump logic actually used.
 */
export class DebugOverlay {
  private readonly panel: GameObjects.Rectangle;
  private readonly text: GameObjects.Text;
  private readonly recent: string[] = [];
  private visible = false;

  constructor(scene: Scene) {
    this.panel = scene.add
      .rectangle(10, 10, 380, 250, 0x000000, 0.62)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.debugOverlay);

    this.text = scene.add
      .text(20, 18, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        lineSpacing: 3,
        color: `#${COLORS.debugText.toString(16)}`,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.debugOverlay);

    this.setVisible(false);
  }

  toggle(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.panel.setVisible(visible);
    this.text.setVisible(visible);
  }

  noteEffects(effects: readonly PlayerEffect[]): void {
    for (const effect of effects) {
      const label = effect.kind === 'notImplemented' ? `notImplemented:${effect.state}` : `${effect.kind}:${effect.id}`;
      this.recent.push(label);
    }
    while (this.recent.length > RECENT_EVENT_LIMIT) this.recent.shift();
  }

  update(frame: PlayerDebugFrame, fps: number, levelId: string, worldX: number, worldY: number): void {
    if (!this.visible) return;

    const lines = [
      `fps        ${Math.round(fps)}          level  ${levelId}`,
      `pos        ${worldX.toFixed(1)}, ${worldY.toFixed(1)}`,
      `vel        ${frame.vx.toFixed(1)}, ${frame.vy.toFixed(1)}`,
      '',
      `locomotion ${frame.locomotion}  (${frame.timeInStateMs.toFixed(0)} ms)`,
      `action     ${frame.action}`,
      `anim       ${frame.animationKey}`,
      `facing     ${frame.facing === 1 ? 'right' : 'left'}`,
      '',
      `grounded   ${frame.grounded ? 'yes' : 'no'}`,
      `coyote     ${frame.coyoteRemainingMs.toFixed(0)} ms`,
      `jump buf   ${frame.jumpBufferRemainingMs.toFixed(0)} ms`,
      `gravity x  ${frame.gravityScale.toFixed(2)}`,
      `control    ${frame.horizontalControl}`,
      '',
      `events     ${this.recent.length === 0 ? '-' : this.recent.join('  ')}`,
    ];

    this.text.setText(lines);
  }

  /** Legend shown even when the panel is hidden, so the key is discoverable. */
  static hint(scene: Scene): GameObjects.Text {
    return scene.add
      .text(16, VIEW.height - 26, '`  debug overlay      WASD / arrows  move      Space  jump', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: `#${COLORS.debugText.toString(16)}`,
      })
      .setAlpha(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
  }
}
