# WAYFARER ZERO

A 2D side-scrolling action-adventure. Rook, a stripped utility automaton, wakes
under a jungle scrapyard with almost everything removed and crosses a continent
rebuilding a legendary body ten pieces at a time.

> Every recovered part changes three things: the hero's silhouette, the player's
> verbs, and the meaning of the story.

**Status: milestone F0 — repository health.** The engine boots, the toolchain is
green, and the architectural boundary that the whole project rests on is
enforced by a test. There is no gameplay yet; the movement laboratory is F1.

## Commands

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5190. This is the development tool, not the play build. |
| `npm run build` | Typecheck, then produce `dist/`. **This is not a deploy.** |
| `npm run preview` | Serve the built `dist/` locally. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Vitest, watch mode. |
| `npm run test:run` | Vitest, once. |
| `npm run check` | typecheck → tests → build. **The gate. Nothing ships red.** |

## Architecture

```
content data  →  src/core  →  src/game  →  scenes
                    ↑
        never imports Phaser, Node, or anything downstream
```

`src/core` holds the rules: state machines, timing windows, save migrations,
economy, dialogue. It is pure TypeScript and is tested in a Node environment
with no DOM, so every test is a plain object literal — no mocks, no engine.

`src/game` holds the Phaser adapters. Exactly one file translates between the
two worlds per concern: the body adapter reads a `BodySample` and applies a
`MotionCommand`, and nothing else touches an Arcade body.

That boundary is enforced mechanically by `tests/guards/core-boundary.test.ts`,
which runs as part of `npm run check`. It catches Phaser imports, Node builtin
imports, upward imports into the game layer, and — the subtle one — a bare
`Phaser.Foo` type annotation with no import at all, which compiles because
`phaser.d.ts` declares a global namespace.

```
src/
  core/      pure rules — no Phaser, no Node, no DOM
    tuning/  every authored number, with the reasoning that produced it
  game/      Phaser adapters, scenes, rendering
tests/
  core/      pure-rule tests (Node environment)
  guards/    architectural boundary enforcement
  smoke/     toolchain version pins
docs/        the game bible, the handoff contract, the ten Rook renders
```

## Stack

Phaser 4.2.1 · TypeScript 7.0.2 (strict) · Vite 8.2.0 · Vitest 4.1.10 ·
Node ≥ 22.12 · Arcade Physics · 1280 × 720, `FIT` + centred, WebGL.

The bible names Phaser 4.1.0; 4.2.1 supersedes it on the same major line.
Deviations from the bible are recorded in `CLAUDE.md` rather than left implicit.

## Known limitations at F0

- No gameplay. `BootScene` draws Rook's body box at true scale (52 × 104) next
  to a marker at the analytic jump apex, so the bible's numbers and the canvas
  can be eyeballed against each other from the very first build.
- No assets of any kind. That is the point: the procedural placeholder system
  lands in F1 and the build must never depend on art.
- No deploy yet. It arrives with F1, along with live-hash verification.

## Art

`docs/character-states/` holds the approved ten-state visual progression, from
Bare Chassis to the Cinderbound Final Form. Treat those images as **identity and
equipment reference only** — never as collision geometry and never as
engine-ready animation sheets. Environment direction is **A — Living Gouache**.

The sprite contract, when real sheets arrive: 256 × 256 cells, foot pivot
`(128, 224)`, strict side view facing right, runtime flip for left, one motion
per sheet, animation key `rook.<armorState>.<motion>`.
