/**
 * World, camera and presentation constants — bible §21 (runtime baseline),
 * §3 (camera) and §14 (art-direction constants).
 */

export const VIEW = {
  /** Internal game canvas. Scaled to fit while preserving 16:9. */
  width: 1280,
  height: 720,
  /** Logic runs at a fixed 60 Hz; rendering follows the display refresh rate. */
  updateHz: 60,
} as const;

export const CAMERA = {
  /** How far ahead of Rook's facing the camera leads, px. */
  lookAhead: 120,
  /** Rook may move this far inside the frame before the camera follows, px. */
  deadzoneWidth: 320,
  deadzoneHeight: 180,
} as const;

/**
 * Grey-box palette.
 *
 * These are placeholder colours with a job, not decoration. Bible §14 fixes the
 * meanings and they hold for the real art too, so encoding them now means the
 * grey-box already reads correctly:
 *   - traversable foreground carries the strongest value contrast;
 *   - ancient machinery you can interact with carries restrained cyan;
 *   - settlements carry amber; furnace danger carries vermilion;
 *   - decoration must never impersonate a platform.
 */
export const COLORS = {
  background: 0x141821,
  /** Solid, standable geometry. Highest contrast against the background. */
  solid: 0x39445a,
  solidEdge: 0x5d6c8a,
  /** One-way platforms read as lighter and thinner than solids. */
  oneWay: 0x4a5772,
  /** Surfaces Rook can climb share a material rhythm, not a glowing decal. */
  climbable: 0x4d4436,
  /** Breakable floor — same family as solid, visibly fractured. */
  breakable: 0x4a3f4e,
  /** Interactable ancient machinery. Restrained cyan. */
  machinery: 0x2f7f8c,
  /** Rook's face display. The emotional focal point; never occluded. */
  faceLight: 0x4fd6e8,
  /** Rook's chassis. Dark iron. */
  chassis: 0x2b2f38,
  /** Settlements, warmth, safety. */
  amber: 0xd9a441,
  /** Furnace danger. */
  vermilion: 0xd94f3d,
  /** Carryable props. */
  prop: 0x7a6248,
  debugText: 0xd7dbe4,
} as const;

/**
 * Depth budget.
 *
 * Lionn shipped a telegraph ring at depth 1 — behind the terrain, behind the
 * health bars, behind everything. It was the only readability cue the game had
 * and it was never once visible in play. The fix is not vigilance, it is a
 * table: nothing calls `setDepth` with a literal, everything reads from here.
 */
export const DEPTH = {
  backgroundFar: -300,
  backgroundNear: -200,
  terrainBehind: -100,
  props: 0,
  actorsBehind: 50,
  player: 100,
  actorsFront: 150,
  terrainFront: 200,
  groundMarkers: 300,
  effects: 400,
  overheadMarkers: 500,
  foregroundOcclusion: 600,
  hud: 1000,
  dialogue: 1100,
  menu: 1200,
  debugOverlay: 1500,
} as const;
