import type { Rect } from '../util/Rect.ts';

/**
 * World queries, resolved by the adapter *before* the tick runs.
 *
 * Lionn abstracted the same queries behind callbacks (`LedgeQuery`,
 * `SlidePoleQuery`) so its movement code could stay world-agnostic — a good
 * instinct. Hoisting them from callbacks into a precomputed value goes one step
 * further and removes the last re-entrancy: core cannot call back into the
 * engine mid-decision, because there is nothing to call.
 */

export type SurfaceKind = 'solid' | 'oneWay' | 'breakable' | 'climbable';

export interface LedgeProbeHit {
  /** World Y of the ledge's top edge. */
  readonly topY: number;
  /** World X of the ledge's left edge. */
  readonly leftX: number;
  readonly width: number;
  /** Which side of the body the ledge is on. */
  readonly side: -1 | 1;
}

export type GrabKind = 'prop' | 'ledge' | 'lever' | 'npc' | 'mount';
export type WeightClass = 'light' | 'medium' | 'heavy' | 'immovable';

export interface GrabCandidate {
  readonly id: number;
  readonly kind: GrabKind;
  /** Authored 0..100. Bible §28 puts explicit context priority first, ahead of
   *  distance — a lever you are standing on should win over a crate that
   *  happens to be two pixels closer. */
  readonly contextPriority: number;
  readonly bounds: Rect;
  readonly weightClass: WeightClass;
  readonly requiresLineOfSight: boolean;
}

export interface WorldProbeResult {
  readonly ledge: LedgeProbeHit | null;
  readonly grabCandidates: readonly GrabCandidate[];
  /** Clear space above the body, px. Gates standing back up from a crouch. */
  readonly headroomAbove: number;
  readonly groundKindBelow: SurfaceKind | null;
}

export const EMPTY_PROBE: WorldProbeResult = {
  ledge: null,
  grabCandidates: [],
  headroomAbove: Number.POSITIVE_INFINITY,
  groundKindBelow: null,
};
