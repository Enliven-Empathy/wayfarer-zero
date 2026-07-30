/**
 * An immutable read of the physics body, taken at the top of a frame.
 *
 * This is one half of the core boundary. The adapter samples the engine into
 * this plain object; core never holds a body reference at all. That is a
 * stronger guarantee than "core talks to an abstracted body interface", and it
 * has a concrete payoff: every core test is an object literal. No mocks, no
 * fakes, no fixture harness, no engine boot.
 */

/**
 * Axis contacts.
 *
 * The adapter pre-ORs Arcade's `blocked` and `touching`. Core must never learn
 * that the distinction exists — it is an engine detail about whether the
 * obstruction was a static tile or another body, and no movement rule in this
 * game cares which.
 */
export interface Contacts {
  readonly down: boolean;
  readonly up: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export const NO_CONTACTS: Contacts = { down: false, up: false, left: false, right: false };

export interface BodySample {
  /** Body top-left in world space — Arcade's own convention, kept to avoid a
   *  centre/corner translation that would have to be right in two places. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly vx: number;
  readonly vy: number;
  readonly contacts: Contacts;
}

export function bodyBottom(body: BodySample): number {
  return body.y + body.height;
}

export function bodyCenterX(body: BodySample): number {
  return body.x + body.width / 2;
}
