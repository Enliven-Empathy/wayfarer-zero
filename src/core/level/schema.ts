import type { SurfaceKind } from '../player/probes.ts';

/**
 * Level definition — bible §28.
 *
 * Axis-aligned rectangles and explicit markers. No tilemap, no editor: the
 * bible's own reasoning is that the first levels should be authorable and
 * validatable without a visual tool, and rectangles are the format a validator
 * can actually reason about (is this platform reachable? is this gap jumpable?).
 *
 * All coordinates are world-space, top-left origin, pixels.
 */

export interface RectDef {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PointDef {
  readonly x: number;
  readonly y: number;
}

export interface SpawnDef extends PointDef {
  readonly id: string;
}

export interface CheckpointDef extends PointDef {
  readonly id: string;
}

export interface BreakableDef extends RectDef {
  readonly id: string;
  /** Minimum downward impact speed required to break it, px/s. */
  readonly requiredImpact: number;
}

export interface InteractionDef extends RectDef {
  readonly id: string;
  readonly kind: 'prop' | 'lever' | 'npc' | 'waybell' | 'wayhouse' | 'dummy';
  /** Bible §28: the grab resolver scores explicit context priority first. */
  readonly contextPriority: number;
  readonly weightClass: 'light' | 'medium' | 'heavy' | 'immovable';
}

export interface LevelDefinition {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly solids: readonly RectDef[];
  readonly oneWayPlatforms: readonly RectDef[];
  readonly climbSurfaces: readonly RectDef[];
  readonly breakables: readonly BreakableDef[];
  readonly interactions: readonly InteractionDef[];
  readonly spawns: readonly SpawnDef[];
  readonly checkpoints: readonly CheckpointDef[];
}

export function surfaceKindOf(level: LevelDefinition, rect: RectDef): SurfaceKind {
  if (level.oneWayPlatforms.includes(rect)) return 'oneWay';
  if (level.climbSurfaces.includes(rect)) return 'climbable';
  if (level.breakables.some((b) => b === rect)) return 'breakable';
  return 'solid';
}
