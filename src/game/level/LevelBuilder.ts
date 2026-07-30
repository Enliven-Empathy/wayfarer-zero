import type { GameObjects, Physics, Scene } from 'phaser';
import type { InteractionDef, LevelDefinition, RectDef } from '@core/level/schema.ts';
import { COLORS, DEPTH } from '@core/tuning/world.ts';
import { TEXTURE } from '../render/placeholders.ts';

export interface BuiltLevel {
  readonly solids: Physics.Arcade.StaticGroup;
  readonly oneWays: Physics.Arcade.StaticGroup;
  readonly breakables: Physics.Arcade.StaticGroup;
  /** Decoration and sensors — never collided with directly. */
  readonly decor: readonly GameObjects.GameObject[];
  readonly spawn: { readonly x: number; readonly y: number };
}

/**
 * Realises a validated `LevelDefinition` as Phaser objects.
 *
 * Generation and rendering are deliberately separate here: the definition is
 * plain data validated in core, and this file only draws it. Lionn fused the
 * two — its level classes constructed Phaser rectangles while generating — and
 * the cost was that no level could be reasoned about, or tested, without
 * booting a scene.
 */
export function buildLevel(scene: Scene, level: LevelDefinition): BuiltLevel {
  const solids = scene.physics.add.staticGroup();
  const oneWays = scene.physics.add.staticGroup();
  const breakables = scene.physics.add.staticGroup();
  const decor: GameObjects.GameObject[] = [];

  for (const r of level.solids) addStatic(scene, solids, r, COLORS.solid, COLORS.solidEdge, DEPTH.terrainBehind);

  for (const r of level.oneWayPlatforms) {
    const platform = addStatic(scene, oneWays, r, COLORS.oneWay, COLORS.solidEdge, DEPTH.terrainFront);
    const body = platform.body as Physics.Arcade.StaticBody;
    // Pass through from below and from the sides; land on it from above only.
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  for (const r of level.breakables) {
    addStatic(scene, breakables, r, COLORS.breakable, COLORS.vermilion, DEPTH.terrainBehind);
  }

  // Climb surfaces are not colliders — they are a material Rook can attach to,
  // which is F2's problem. Drawing them now keeps the level readable and makes
  // the eventual attach point obvious.
  for (const r of level.climbSurfaces) {
    decor.push(drawRect(scene, r, COLORS.climbable, DEPTH.terrainBehind, 0.9));
  }

  for (const item of level.interactions) decor.push(...drawInteraction(scene, item));

  const start = level.spawns.find((s) => s.id === 'start');
  return {
    solids,
    oneWays,
    breakables,
    decor,
    spawn: { x: start?.x ?? 100, y: start?.y ?? 100 },
  };
}

function addStatic(
  scene: Scene,
  group: Physics.Arcade.StaticGroup,
  r: RectDef,
  fill: number,
  edge: number,
  depth: number,
): GameObjects.Rectangle {
  const rect = scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, fill);
  rect.setStrokeStyle(2, edge, 0.85);
  rect.setDepth(depth);
  group.add(rect);
  return rect;
}

function drawRect(scene: Scene, r: RectDef, fill: number, depth: number, alpha = 1): GameObjects.Rectangle {
  const rect = scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, fill, alpha);
  rect.setDepth(depth);
  return rect;
}

function drawInteraction(scene: Scene, item: InteractionDef): GameObjects.GameObject[] {
  const cx = item.x + item.w / 2;
  const bottom = item.y + item.h;
  const made: GameObjects.GameObject[] = [];

  const textureFor: Partial<Record<InteractionDef['kind'], string>> = {
    prop: TEXTURE.crate,
    dummy: TEXTURE.dummy,
    waybell: TEXTURE.waybell,
  };

  const texture = textureFor[item.kind];
  if (texture !== undefined) {
    const image = scene.add.image(cx, bottom, texture).setOrigin(0.5, 1).setDepth(DEPTH.props);
    made.push(image);
  } else {
    // NPCs and buildings have no placeholder art yet. A tinted block plus a
    // label is more useful than a missing asset, and the AssetResolver rule
    // says a missing optional asset must degrade rather than break.
    const tint = item.kind === 'wayhouse' ? COLORS.amber : COLORS.machinery;
    made.push(drawRect(scene, item, tint, DEPTH.props, 0.75));
  }

  made.push(
    scene.add
      .text(cx, item.y - 8, item.id, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: `#${COLORS.debugText.toString(16)}`,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.overheadMarkers),
  );

  return made;
}
