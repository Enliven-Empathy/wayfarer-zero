# CLAUDE.md — WAYFARER ZERO foundation

Read `WAYFARER-ZERO-game-bible-v0.2-claude-code.md` before changing code. It is the source of truth for narrative, mechanics, technical architecture, content contracts, and milestone acceptance.

The approved ten-state visual progression is documented in `character-states/README.md`. Treat those images as identity and equipment references only—not as collision geometry or engine-ready animation sheets.

## Mission

Build the Phaser/TypeScript game-engine foundation and grey-box vertical slice for **WAYFARER ZERO**. Work in small verified milestones. The game must remain playable with no final image or audio assets.

## Locked stack

- Phaser 4.1.x
- TypeScript 7.x in strict mode
- Vite, vanilla TypeScript template
- Phaser Arcade Physics
- Vitest
- npm with a committed `package-lock.json`
- Node.js 22.12+
- Offline-first IndexedDB saves with localStorage fallback

Do not introduce React, Vue, Svelte, a paid editor, Spine, a custom renderer, a server, authentication, a database, cloud saves, telemetry, or multiplayer.

## First commands

If the repository is empty:

```bash
npm create vite@latest . -- --template vanilla-ts --no-interactive
npm install phaser@4.1.0
npm install -D vitest
```

Do not run these scaffolding commands over an existing project without first inspecting and preserving its contents.

## Required working method

1. Inspect existing files and current git status.
2. Implement one milestone from Part II, Section 39 of the bible.
3. Keep `src/core` free of Phaser imports.
4. Add or update tests for every pure rule.
5. Run the smallest relevant tests during implementation.
6. Before reporting a milestone complete, run:

```bash
npm run check
```

7. Report files changed, tests run, limitations, and the next milestone.

Do not claim completion when checks fail.

## Architecture rules

- Player physics position is authoritative; sprite art is visual only.
- Game systems consume named actions, never raw keyboard keys.
- Use separate locomotion and action state machines.
- All tuning comes from typed content, not scattered numeric literals.
- Scene classes coordinate; they do not own economy, save migrations, quest logic, or dialogue condition parsing.
- Authored content uses stable IDs and is validated once during preload.
- Dialogue JSON never executes JavaScript.
- Store transactions are pure, atomic, and tested.
- Quest rewards are idempotent.
- Save migrations are pure functions.
- Subscriptions are disposed when scenes/entities shut down.
- Missing optional assets resolve to procedural placeholders and emit one warning.

## Initial playable scope

Create one movement-laboratory level with:

- flat ground;
- a gap;
- a one-way platform;
- two valid ledges and one blocked ledge;
- a climb surface;
- a light crate;
- a dummy enemy;
- a breakable floor;
- a placeholder NPC merchant;
- a Waybell checkpoint;
- a Wayhouse rest point.

Implement:

- run and variable jump;
- 120 ms coyote time;
- 140 ms jump buffer;
- ledge hang, climb, and drop;
- push, pull, carry, and throw;
- placeholder fist attack;
- Bare and Breaker armor states;
- airborne Down, Down ground-pound with a 350 ms window;
- dialogue, store, save/load, and home-rest slices;
- keyboard/gamepad input;
- developer overlay and controls defined in the bible.

Other regions, weapons, mounts, enemies, and armor behaviors are out of scope until the foundation passes.

## Required scripts

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit",
  "test": "vitest",
  "test:run": "vitest run",
  "check": "npm run typecheck && npm run test:run && npm run build"
}
```

## Stop conditions

Stop and report instead of guessing if:

- a request conflicts with the bible’s five design pillars;
- a dependency would require accounts, secrets, payment, or a remote service;
- a schema change would invalidate saves without a migration;
- an art dependency would block the placeholder build;
- the proposed solution couples collision geometry to sprite pixels;
- the requested change expands the current milestone into the full game.

## Definition of done

A milestone is done only when its acceptance criteria pass, its tests pass, and the result is documented. The foundation is done only when all criteria in Part II, Section 40 of the bible pass.
