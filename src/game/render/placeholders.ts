import type { Scene } from 'phaser';
import { COLORS } from '@core/tuning/world.ts';
import { MOVEMENT } from '@core/tuning/movement.ts';

/**
 * Procedural placeholder textures.
 *
 * **`Create.GenerateTexture` and `TextureManager.generate` were removed in
 * Phaser 4.** The replacement is `Graphics#generateTexture`, which is what this
 * module wraps. Every placeholder in the game goes through here, so if that API
 * moves again there is exactly one file to change.
 *
 * The bible's hard rule is that the game must stay playable with the entire art
 * directory absent. That only holds if placeholders are a first-class system
 * rather than a stopgap, so this ships in F1 alongside the first level rather
 * than being retrofitted once real art exists.
 */

export const TEXTURE = {
  rookBare: 'placeholder.rook.bare',
  crate: 'placeholder.crate',
  dummy: 'placeholder.dummy',
  waybell: 'placeholder.waybell',
} as const;

export function createPlaceholderTextures(scene: Scene): void {
  rookCapsule(scene, TEXTURE.rookBare);
  crate(scene, TEXTURE.crate);
  dummy(scene, TEXTURE.dummy);
  waybell(scene, TEXTURE.waybell);
}

/**
 * Rook, as a readable block.
 *
 * Drawn at the *visual* height (128), not the body height (104), so the gap
 * between what you see and what collides is visible from day one rather than
 * being discovered when a jump clips a ceiling. The face light is the one
 * detail worth including: bible §7 rule 2 makes it the emotional focal point,
 * and it also tells you at a glance which way he is facing.
 */
function rookCapsule(scene: Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const w = MOVEMENT.bodyWidth;
  const h = MOVEMENT.visualHeight;
  const g = scene.add.graphics();

  g.fillStyle(COLORS.chassis, 1);
  g.fillRoundedRect(0, 0, w, h, 6);
  g.lineStyle(2, COLORS.faceLight, 0.55);
  g.strokeRoundedRect(1, 1, w - 2, h - 2, 6);

  // Head block — square, per the locked identity.
  g.fillStyle(0x22262e, 1);
  g.fillRect(6, 6, w - 12, 30);

  // Two cyan eyes and the short mouth line.
  g.fillStyle(COLORS.faceLight, 1);
  g.fillRect(13, 16, 6, 11);
  g.fillRect(w - 19, 16, 6, 11);
  g.fillRect(w / 2 - 7, 42, 14, 3);

  g.generateTexture(key, w, h);
  g.destroy();
}

function crate(scene: Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const size = 48;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.prop, 1);
  g.fillRect(0, 0, size, size);
  g.lineStyle(2, 0xa88a63, 0.9);
  g.strokeRect(1, 1, size - 2, size - 2);
  g.lineBetween(0, 0, size, size);
  g.lineBetween(size, 0, 0, size);
  g.generateTexture(key, size, size);
  g.destroy();
}

function dummy(scene: Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const w = 44;
  const h = 96;
  const g = scene.add.graphics();
  g.fillStyle(0x5a4a5e, 1);
  g.fillRoundedRect(0, 0, w, h, 4);
  g.lineStyle(2, COLORS.vermilion, 0.8);
  g.strokeRoundedRect(1, 1, w - 2, h - 2, 4);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** A Waybell: spatial landmark, checkpoint, and puzzle instrument (bible §16). */
function waybell(scene: Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const w = 40;
  const h = 88;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.machinery, 1);
  g.fillRect(w / 2 - 3, 0, 6, h);
  g.fillStyle(COLORS.amber, 1);
  g.fillEllipse(w / 2, 26, 30, 34);
  g.generateTexture(key, w, h);
  g.destroy();
}
