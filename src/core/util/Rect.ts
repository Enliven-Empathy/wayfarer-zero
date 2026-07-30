/**
 * Axis-aligned rectangle in world space, top-left origin.
 *
 * Core's own geometry type. Deliberately not `Phaser.Geom.Rectangle`: the
 * combat and probe code is the exact place a Phaser type would sneak across the
 * boundary, because it is the only place in the rules layer that thinks in
 * shapes at all. Four numbers cost nothing and keep core testable in Node.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function right(r: Rect): number {
  return r.x + r.w;
}

export function bottom(r: Rect): number {
  return r.y + r.h;
}

export function center(r: Rect): Vec2 {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Touching edges do NOT count as overlapping — a body resting exactly on a
 *  floor is not "inside" it, and treating it as such makes every landing
 *  register a collision the frame before it happens. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < right(b) && right(a) > b.x && a.y < bottom(b) && bottom(a) > b.y;
}

export function containsPoint(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x <= right(r) && p.y >= r.y && p.y <= bottom(r);
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
