/**
 * A result that carries its failures instead of throwing them.
 *
 * Content validation is the main consumer. The bible (§32) asks for *all*
 * errors reported together with JSON path, bad value and expected contract —
 * which an exception cannot do, because it stops at the first problem. A level
 * with six typos should tell you about six typos once, not six times across six
 * edit-run cycles.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly E[] };

export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<E, T = never>(errors: readonly E[]): Result<T, E> {
  return { ok: false, errors };
}

/** Describes one validation failure precisely enough to fix it without guessing. */
export interface ValidationError {
  /** Dotted path to the offending field, e.g. `solids[2].w`. */
  readonly path: string;
  /** What was found. */
  readonly found: unknown;
  /** What the contract requires. */
  readonly expected: string;
}

export function formatErrors(errors: readonly ValidationError[]): string {
  return errors
    .map((e) => `  ${e.path}: expected ${e.expected}, found ${JSON.stringify(e.found)}`)
    .join('\n');
}
