import { err, ok } from '../util/Result.ts';
import type { Result, ValidationError } from '../util/Result.ts';
import type {
  BreakableDef,
  CheckpointDef,
  InteractionDef,
  LevelDefinition,
  RectDef,
  SpawnDef,
} from './schema.ts';

/**
 * Validate untrusted level JSON into a `LevelDefinition`.
 *
 * Never throws. Bible §32 asks for *all* errors reported together with the JSON
 * path, the bad value, and the expected contract — an exception cannot do that,
 * because it stops at the first problem and turns a six-typo level into six
 * edit-run cycles.
 *
 * Deliberately hand-written rather than schema-library-driven: the bible's
 * non-goals forbid dependencies that are not pulling real weight, and the
 * error messages a bespoke validator produces are better than a generic
 * "expected number, received undefined at /solids/2/w".
 */
export function parseLevel(raw: unknown): Result<LevelDefinition, ValidationError> {
  const errors: ValidationError[] = [];

  if (!isRecord(raw)) {
    return err([{ path: '(root)', found: raw, expected: 'an object' }]);
  }

  const id = requireString(raw, 'id', errors);
  const width = requirePositive(raw, 'width', errors);
  const height = requirePositive(raw, 'height', errors);

  const solids = rectArray(raw, 'solids', errors);
  const oneWayPlatforms = rectArray(raw, 'oneWayPlatforms', errors);
  const climbSurfaces = rectArray(raw, 'climbSurfaces', errors);
  const breakables = breakableArray(raw, 'breakables', errors);
  const interactions = interactionArray(raw, 'interactions', errors);
  const spawns = spawnArray(raw, 'spawns', errors);
  const checkpoints = checkpointArray(raw, 'checkpoints', errors);

  // A level with no spawn loads fine and then strands the player at (0,0),
  // which looks like a physics bug rather than a content bug. Catch it here.
  if (spawns.length > 0 && !spawns.some((s) => s.id === 'start')) {
    errors.push({
      path: 'spawns',
      found: spawns.map((s) => s.id),
      expected: 'at least one spawn with id "start"',
    });
  }

  if (errors.length > 0) return err(errors);

  return ok({
    id,
    width,
    height,
    solids,
    oneWayPlatforms,
    climbSurfaces,
    breakables,
    interactions,
    spawns,
    checkpoints,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(source: Record<string, unknown>, key: string, errors: ValidationError[]): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    errors.push({ path: key, found: value, expected: 'a non-empty string' });
    return '';
  }
  return value;
}

function requirePositive(source: Record<string, unknown>, key: string, errors: ValidationError[]): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    errors.push({ path: key, found: value, expected: 'a positive finite number' });
    return 0;
  }
  return value;
}

/** Missing arrays are treated as empty, not as errors — a level with no
 *  breakables should not have to say so. Present-but-wrong is still an error. */
function arrayAt(source: Record<string, unknown>, key: string, errors: ValidationError[]): unknown[] {
  const value = source[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push({ path: key, found: value, expected: 'an array' });
    return [];
  }
  return value;
}

function readRect(entry: unknown, path: string, errors: ValidationError[]): RectDef | null {
  if (!isRecord(entry)) {
    errors.push({ path, found: entry, expected: 'an object with x, y, w, h' });
    return null;
  }
  const out = { x: 0, y: 0, w: 0, h: 0 };
  let valid = true;
  for (const field of ['x', 'y', 'w', 'h'] as const) {
    const value = entry[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push({ path: `${path}.${field}`, found: value, expected: 'a finite number' });
      valid = false;
      continue;
    }
    if ((field === 'w' || field === 'h') && value <= 0) {
      errors.push({ path: `${path}.${field}`, found: value, expected: 'a positive number' });
      valid = false;
      continue;
    }
    out[field] = value;
  }
  return valid ? out : null;
}

function rectArray(source: Record<string, unknown>, key: string, errors: ValidationError[]): RectDef[] {
  return arrayAt(source, key, errors)
    .map((entry, i) => readRect(entry, `${key}[${i}]`, errors))
    .filter((r): r is RectDef => r !== null);
}

function readId(entry: Record<string, unknown>, path: string, errors: ValidationError[]): string | null {
  const id = entry['id'];
  if (typeof id !== 'string' || id.length === 0) {
    errors.push({ path: `${path}.id`, found: id, expected: 'a non-empty string' });
    return null;
  }
  return id;
}

function breakableArray(source: Record<string, unknown>, key: string, errors: ValidationError[]): BreakableDef[] {
  const out: BreakableDef[] = [];
  arrayAt(source, key, errors).forEach((entry, i) => {
    const path = `${key}[${i}]`;
    const rect = readRect(entry, path, errors);
    if (rect === null || !isRecord(entry)) return;
    const id = readId(entry, path, errors);
    const impact = entry['requiredImpact'];
    if (typeof impact !== 'number' || impact <= 0) {
      errors.push({ path: `${path}.requiredImpact`, found: impact, expected: 'a positive number' });
      return;
    }
    if (id === null) return;
    out.push({ ...rect, id, requiredImpact: impact });
  });
  return out;
}

const INTERACTION_KINDS = ['prop', 'lever', 'npc', 'waybell', 'wayhouse', 'dummy'] as const;
const WEIGHT_CLASSES = ['light', 'medium', 'heavy', 'immovable'] as const;

function interactionArray(source: Record<string, unknown>, key: string, errors: ValidationError[]): InteractionDef[] {
  const out: InteractionDef[] = [];
  arrayAt(source, key, errors).forEach((entry, i) => {
    const path = `${key}[${i}]`;
    const rect = readRect(entry, path, errors);
    if (rect === null || !isRecord(entry)) return;
    const id = readId(entry, path, errors);

    const kind = entry['kind'];
    if (typeof kind !== 'string' || !INTERACTION_KINDS.includes(kind as (typeof INTERACTION_KINDS)[number])) {
      errors.push({ path: `${path}.kind`, found: kind, expected: `one of ${INTERACTION_KINDS.join(', ')}` });
      return;
    }

    const weight = entry['weightClass'] ?? 'immovable';
    if (typeof weight !== 'string' || !WEIGHT_CLASSES.includes(weight as (typeof WEIGHT_CLASSES)[number])) {
      errors.push({ path: `${path}.weightClass`, found: weight, expected: `one of ${WEIGHT_CLASSES.join(', ')}` });
      return;
    }

    const priority = entry['contextPriority'] ?? 50;
    if (typeof priority !== 'number' || priority < 0 || priority > 100) {
      errors.push({ path: `${path}.contextPriority`, found: priority, expected: 'a number in 0..100' });
      return;
    }

    if (id === null) return;
    out.push({
      ...rect,
      id,
      kind: kind as InteractionDef['kind'],
      weightClass: weight as InteractionDef['weightClass'],
      contextPriority: priority,
    });
  });
  return out;
}

function pointArray<T extends { id: string; x: number; y: number }>(
  source: Record<string, unknown>,
  key: string,
  errors: ValidationError[],
): T[] {
  const out: T[] = [];
  arrayAt(source, key, errors).forEach((entry, i) => {
    const path = `${key}[${i}]`;
    if (!isRecord(entry)) {
      errors.push({ path, found: entry, expected: 'an object with id, x, y' });
      return;
    }
    const id = readId(entry, path, errors);
    const x = entry['x'];
    const y = entry['y'];
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push({ path: `${path}.x/y`, found: [x, y], expected: 'finite numbers' });
      return;
    }
    if (id === null) return;
    out.push({ id, x, y } as T);
  });
  return out;
}

function spawnArray(source: Record<string, unknown>, key: string, errors: ValidationError[]): SpawnDef[] {
  return pointArray<SpawnDef>(source, key, errors);
}

function checkpointArray(source: Record<string, unknown>, key: string, errors: ValidationError[]): CheckpointDef[] {
  return pointArray<CheckpointDef>(source, key, errors);
}
