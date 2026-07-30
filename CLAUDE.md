# WAYFARER ZERO — agent contract

`docs/WAYFARER-ZERO-game-bible-v0.2-claude-code.md` is the source of truth for
narrative, mechanics, architecture, content contracts, and milestone acceptance.
Read it before changing code. `docs/HANDOFF-CONTRACT.md` is the original handoff
brief. This file records what the bible does not: the decisions we have taken
since, and the traps that have already cost real debugging time.

## Mission

Build the engine foundation and a grey-box vertical slice. Work in small
verified milestones. **The game must remain fully playable with no final image
or audio asset present.**

## Locked stack — and where it deviates from the bible

| Concern | Bible | Here | Why |
|---|---|---|---|
| Phaser | 4.1.0 | **4.2.1** | 4.1.0 is superseded; 4.2.1 is current stable on the 4.x line |
| TypeScript | 7.x strict | **7.0.2** | as specified |
| Vite | "vanilla-ts" | **8.2.0** | current; Rolldown-based |
| Vitest | unversioned | **4.1.10** | current |
| Node | ≥ 22.12 | **25.9.0** (`.nvmrc`) | as specified |

Every version is pinned exactly and `package-lock.json` is committed.

Do not introduce React, Vue, Svelte, a paid editor, Spine, a custom renderer, a
server, authentication, a database, cloud saves, telemetry, or multiplayer.

## Architecture rules

- **`src/core` must never import Phaser, Node builtins, or the game/scene
  layers.** Enforced by `tests/guards/core-boundary.test.ts`, which runs inside
  `npm run check`. It makes four assertions because there are four ways to
  breach the boundary — including a bare `Phaser.Foo` type reference with *no
  import at all*, which is legal because `phaser.d.ts` declares a global
  namespace. Do not weaken it.
- Dependency direction: `content data → core rules → game adapters → scenes`.
- **Core is a pure function.** Adapters read the Phaser body into a plain
  `BodySample`, core returns a plain `MotionCommand`, adapters apply it. Core
  never holds an engine reference, so every core test is an object literal —
  no mocks, no fakes, no fixtures.
- The physics body is authoritative for position. Sprite art is a visual child
  and is **never** consulted for collision.
- Game systems consume named actions, never raw keys or button indices.
- Separate locomotion and action state machines. They cooperate through one
  `reconcile()` function, which gets its own tests.
- All tuning comes from typed content in `src/core/tuning/`, not scattered
  literals. Every number carries the reasoning that produced it.
- Scenes coordinate. They do not own economy, save migrations, quest logic, or
  dialogue condition parsing.
- Subscriptions are disposed on scene/entity shutdown.
- Missing optional assets resolve to procedural placeholders and warn once.

### `erasableSyntaxOnly` is on

No `enum`, no `namespace`, no constructor parameter properties. Both state
machines are `as const` tables plus string-literal unions. This is deliberate —
it keeps them data-drivable, JSON-serialisable and trivially testable — and it
is decided at F0 so it can never be discovered mid-milestone.

## Eight traps — verified against Phaser 4.2.1 source, not release notes

The sibling project `../lionn-night-prowler` paid for all of these. Six are
still live in Phaser 4.

1. **Arcade body auto-sync. STILL PRESENT** (`Body.js:1020`, `:1506`).
   `updateBounds()` recomputes `width/height = source × |scale|`, so
   `setSize()` combined with sprite scaling compounds. Cost four failed fix
   attempts in Lionn. **Structurally avoided here:** `MotionCommand.bodyHeight`
   is a `'standing' | 'crouched'` token, and only
   `ArcadeBodyAdapter.applyBodyHeight()` may ever touch body size.
2. **`tweens.killTweensOf(target)` destroys every tween on an object.** STILL
   PRESENT. Never call it. Keep per-effect tween handles with `cancel()`.
3. **Depth.** Lionn shipped its only readability cue at depth 1, behind
   everything; nobody saw it for months. Never pass a depth literal — read from
   `DEPTH` in `src/core/tuning/world.ts`. *New in Phaser 4:* filters are
   destroyed with their owners, so pooled objects now lose effects for the
   opposite reason.
4. **A throw in a scene shutdown kills the render loop. STILL PRESENT.**
   `RequestAnimationFrame.step` calls the frame callback *before* scheduling the
   next frame, and `Game.step` has no try/catch. One uncaught exception freezes
   the canvas forever with no visible error. `src/game/boot.ts` patches
   `Game.prototype.step` and adds a 2 s watchdog. Do not remove either.
5. **Gamepad idle-press. PARTIALLY FIXED.** Phaser 4 initialises buttons from
   their real pressed state, which fixes the scene-transition false positive.
   It does **not** fix DualSense-over-Bluetooth chatter mid-session, and Phaser
   4 still does not expose `pad.mapping` — keep the ≥12-button standard-pad
   heuristic, the 0.28 stick deadzone, and the 0.35/0.15 analog-trigger
   hysteresis latch.
6. **Keyboard capture is not optional.** Without an explicit `capture` list the
   browser eats SPACE and the arrows for page-scrolling and F3 for find-next.
   Those keys then look simply dead, with nothing in the console.
7. **Canvas focus.** Default `tabIndex` is -1, so clicking the canvas does not
   give it keyboard focus. `boot.ts` sets `tabindex=0` and focuses on
   `pointerdown`.
8. **Built ≠ deployed.** `npm run build` writes to local disk and nothing
   serves it. `./deploy-gh-pages.sh` pushes *and verifies the live hash*. Only
   a matching live hash justifies the word "shipped".

### Removed in Phaser 4 — do not reach for these

- `Create.GenerateTexture` and `TextureManager.generate` are **gone**. Use
  `Graphics#generateTexture(key, w, h)` or a `DynamicTexture`. This hits the
  procedural-placeholder system directly.
- `Geom.Point` is gone; Geom functions return `Vector2`.
- `Struct.Set` / `Struct.Map` are gone; use native `Set` / `Map`.
- `setTintFill()` is gone; use `setTint()` + `setTintMode()`.
- **`Math.TAU` changed meaning** from `PI/2` to `PI*2`. Any copied Lionn maths
  using it is now wrong by 4×, with no compile error.

## No linter, on purpose

`typescript-eslint` cannot run against TypeScript 7 — TS 7.0 ships no
programmatic API and the support request was closed as not-planned. Rather than
carry a second compiler in the lockfile, `tsc --strict` plus `noUnusedLocals` /
`noUnusedParameters` does the work. If a linter is wanted later, use `oxlint`
(Rust, no TS API) and keep it **out** of `npm run check` so a linter upgrade can
never block a build.

## Working method

1. Inspect existing files and `git status` first.
2. Implement one milestone. Keep `src/core` engine-free.
3. Add or update tests for every pure rule.
4. Before reporting anything complete: `npm run check`.
5. Report files changed, tests run, limitations, and the next milestone.

**Never claim completion when checks fail. Never claim "live" without a
verified production hash.**

## Isolation

This repo is standalone. It has its own git remote and shares nothing with the
parent `2026_Claude_Code_Enliven` tree.

- Commit only via `git -C <this repo>`.
- **Never** touch Revenue OS files, branches, or its deploy scripts.
- **Never** touch `../lionn-night-prowler`.
- After every commit, confirm both neighbours are unchanged.

## Stop and ask instead of guessing when

- a request conflicts with the bible's five design pillars;
- a dependency would need accounts, secrets, payment, or a remote service;
- a schema change would invalidate saves without a migration;
- an art dependency would block the placeholder build;
- a solution would couple collision geometry to sprite pixels;
- the change would expand the current milestone into the whole game.
