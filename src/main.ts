import { createGame } from './game/boot.ts';

const game = createGame();

if (import.meta.env.DEV) {
  // Inspection hook for devtools and preview tooling. Dev-only.
  (globalThis as unknown as { __wayfarer: unknown }).__wayfarer = game;
}
