import { Scene } from 'phaser';
import { parseLevel } from '@core/level/parse.ts';
import type { LevelDefinition } from '@core/level/schema.ts';
import { formatErrors } from '@core/util/Result.ts';
import { CAMERA, COLORS, DEPTH, VIEW } from '@core/tuning/world.ts';
import { MOVEMENT } from '@core/tuning/movement.ts';
import { createPlaceholderTextures } from '../render/placeholders.ts';
import { buildLevel } from '../level/LevelBuilder.ts';
import type { BuiltLevel } from '../level/LevelBuilder.ts';
import { PlayerActor } from '../actors/PlayerActor.ts';
import { DebugOverlay } from '../debug/DebugOverlay.ts';

const LEVEL_KEY = 'level.lab';

/**
 * The movement laboratory — bible F1.
 *
 * One scene, one validated `LevelDefinition`. There is deliberately no
 * scene-per-room: the bible is explicit that `WorldScene` consumes a level
 * definition, and Lionn's eleven bespoke scenes (4,163 lines, every button
 * hand-built) are the cautionary tale.
 */
export class LabScene extends Scene {
  private level!: LevelDefinition;
  private built!: BuiltLevel;
  private player!: PlayerActor;
  private overlay!: DebugOverlay;
  /**
   * Debug toggle, requested via a DOM listener rather than a Phaser `Key`.
   *
   * Phaser resolves key names through its own `KeyCodes` map and dispatches on
   * `event.keyCode`, while every binding in this project is written in
   * `KeyboardEvent.code`. Mixing the two vocabularies already cost one silent
   * failure — `'ArrowRight'` and `'KeyD'` do not exist in Phaser's map, so
   * movement bound through `addKey` simply never fired while `'Space'` did.
   * One vocabulary everywhere removes the whole class of bug.
   */
  private debugTogglePending = false;
  private readonly onDebugKey = (event: KeyboardEvent): void => {
    if (event.code === 'Backquote') this.debugTogglePending = true;
  };

  constructor() {
    super('Lab');
  }

  preload(): void {
    this.load.json(LEVEL_KEY, 'levels/lab.json');
  }

  create(): void {
    createPlaceholderTextures(this);

    const parsed = parseLevel(this.cache.json.get(LEVEL_KEY));
    if (!parsed.ok) {
      // Bible §32: a readable error screen, never a blank canvas. Every problem
      // at once, with the JSON path and what was expected.
      this.showContentError(parsed.errors.map((e) => `${e.path}: expected ${e.expected}`));
      console.error(`[level] lab.json failed validation:\n${formatErrors(parsed.errors)}`);
      return;
    }
    this.level = parsed.value;
    this.built = buildLevel(this, this.level);

    // Spawn coordinates are authored as the point Rook's FEET stand on, which
    // is how a level designer thinks about it. The body is centre-anchored.
    this.player = new PlayerActor(this, this.built.spawn.x, this.built.spawn.y - MOVEMENT.bodyHeight / 2);

    this.physics.add.collider(this.player.physics, this.built.solids);
    this.physics.add.collider(this.player.physics, this.built.oneWays);
    this.physics.add.collider(this.player.physics, this.built.breakables);

    this.physics.world.setBounds(0, 0, this.level.width, this.level.height);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.level.width, this.level.height);
    camera.startFollow(this.player.physics, true, 0.12, 0.12);
    camera.setDeadzone(CAMERA.deadzoneWidth, CAMERA.deadzoneHeight);
    camera.setFollowOffset(0, 40);

    this.overlay = new DebugOverlay(this);
    DebugOverlay.hint(this);

    // Reset explicitly: Phaser caches and reuses scene instances, so a field
    // left set from a previous run survives a restart.
    this.debugTogglePending = false;
    window.addEventListener('keydown', this.onDebugKey);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.onDebugKey);
      this.player?.destroy();
    });

    this.drawGuides();
  }

  override update(time: number, delta: number): void {
    if (this.player === undefined) return;

    if (this.debugTogglePending) {
      this.debugTogglePending = false;
      const visible = this.overlay.toggle();
      this.player.showBody = visible;
    }

    const result = this.player.update(time, delta);
    this.overlay.noteEffects(result.effects);
    this.overlay.update(
      result.debug,
      this.game.loop.actualFps,
      this.level.id,
      this.player.x,
      this.player.y,
    );

    // Falling out of the world is a level bug, not a game-over — there is no
    // death in the laboratory. Put him back at the start rather than letting
    // him accelerate into the void.
    if (this.player.y > this.level.height + 400) {
      this.scene.restart();
    }
  }

  /**
   * A measured reference line at the height a full jump actually reaches.
   *
   * Drawn from the same constant the physics uses, so it cannot drift. It makes
   * "is this platform reachable" answerable by looking rather than by testing,
   * which is the difference between a laboratory and a level.
   */
  private drawGuides(): void {
    for (const solid of this.level.solids) {
      if (solid.w < 300) continue; // ground segments only
      const reach = solid.y - 146;
      this.add
        .rectangle(solid.x + solid.w / 2, reach, solid.w, 1, COLORS.amber, 0.22)
        .setDepth(DEPTH.groundMarkers);
    }
  }

  private showContentError(messages: readonly string[]): void {
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x1a0e12).setOrigin(0, 0).setDepth(DEPTH.menu);
    this.add
      .text(48, 48, ['Level content failed validation', '', ...messages].join('\n'), {
        fontFamily: 'monospace',
        fontSize: '15px',
        lineSpacing: 6,
        color: `#${COLORS.vermilion.toString(16)}`,
        wordWrap: { width: VIEW.width - 96 },
      })
      .setDepth(DEPTH.menu);
  }
}
