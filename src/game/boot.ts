import { AUTO, Game, Scale } from 'phaser';
import type { Types } from 'phaser';
import { VIEW, COLORS } from '@core/tuning/world.ts';
import { BootScene } from './scenes/BootScene.ts';
import { LabScene } from './scenes/LabScene.ts';

/**
 * Milliseconds without a completed engine step, while the page is visible,
 * before the watchdog concludes the loop is dead and reloads.
 */
const WATCHDOG_STALL_MS = 2000;
const WATCHDOG_POLL_MS = 500;

export function createGame(): Game {
  patchStepGuard();

  const config: Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game',
    width: VIEW.width,
    height: VIEW.height,
    backgroundColor: COLORS.background,

    // Bible §21: this is not a pixel-art game. Both stay false.
    pixelArt: false,
    roundPixels: false,

    scale: {
      mode: Scale.FIT,
      autoCenter: Scale.CENTER_BOTH,
    },

    physics: {
      default: 'arcade',
      arcade: {
        /**
         * World gravity is ZERO on purpose. All gravity is applied per-body
         * from `MotionCommand.gravityScale`, because Arcade adds body gravity
         * to world gravity rather than replacing it. With a non-zero world
         * value, `gravityScale: 0` would mean "fall at world gravity" instead
         * of "frozen" — which is exactly what a ledge hang needs it not to mean.
         */
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },

    input: {
      gamepad: true,
      keyboard: {
        /**
         * Capture is not optional. Without it the browser eats SPACE and the
         * arrow keys for page-scrolling, and F3 for find-next — those keys then
         * look simply dead, with no error anywhere to explain it.
         */
        capture: [
          32, // SPACE
          37, 38, 39, 40, // LEFT UP RIGHT DOWN
          87, 65, 83, 68, // W A S D
          74, 75, 76, // J K L  — light attack, heavy attack, grab/interact
          85, 73, // U I      — aim, fire
          16, // SHIFT     — evade
          81, // Q         — quick swap
          9, // TAB       — journal
          27, // ESC       — pause
          192, // `         — debug overlay
          114, // F3        — legacy debug toggle
        ],
      },
    },

    render: import.meta.env.DEV ? { preserveDrawingBuffer: true } : {},

    scene: [BootScene, LabScene],
  };

  const game = new Game(config);
  installWatchdog(game);
  installCanvasFocus(game);
  return game;
}

/**
 * Phaser 4.2.1 `Game.step` still has no try/catch, and
 * `src/dom/RequestAnimationFrame.js` calls the frame callback *before*
 * scheduling the next frame:
 *
 *     this.step = function step (time) {
 *         _this.callback(time);                              // throws here
 *         ...
 *         _this.timeOutID = window.requestAnimationFrame(step);  // never reached
 *     };
 *
 * So a single uncaught exception anywhere in a scene — most easily in the
 * chained shutdown that runs on `scene.start` — permanently kills the render
 * loop. The canvas keeps its last clear colour and input does nothing, with no
 * visible error. Lionn shipped this bug to a five-year-old as a frozen purple
 * screen. Catching at the engine layer means one bad frame is survivable.
 */
let stepGuardInstalled = false;

function patchStepGuard(): void {
  // Patch once. It is applied to the prototype, so a second call during a hot
  // reload would wrap the already-wrapped function and grow the call stack by
  // one frame per reload.
  if (stepGuardInstalled) return;
  stepGuardInstalled = true;

  const original = Game.prototype.step;
  Game.prototype.step = function patchedStep(this: Game, time: number, delta: number): void {
    try {
      original.call(this, time, delta);
    } catch (error) {
      console.error('[step-guard] engine-level step error (frame skipped):', error);
    }
  };
}

/**
 * Second layer. The guard above survives a throwing frame; it cannot survive a
 * loop that stops being scheduled at all. If the engine has genuinely died,
 * reload rather than leave a dead canvas on screen.
 *
 * The hard part is telling a dead loop apart from a *throttled* one. Browsers
 * throttle requestAnimationFrame to near zero for occluded windows, background
 * tabs and headless previews — and `document.hidden` is false in the occluded
 * case, so it is not a sufficient test on its own. Reloading there would put
 * the page into an endless reload cycle whenever the window happened to be
 * covered.
 *
 * The discriminator: schedule our *own* rAF callback. If ours fires while
 * Phaser's step has not, the browser is animating and the engine is broken —
 * reload. If ours does not fire either, the whole page is throttled and there
 * is nothing wrong.
 */
function installWatchdog(game: Game): void {
  let lastStepAt = performance.now();
  game.events.on('poststep', () => {
    lastStepAt = performance.now();
  });

  window.setInterval(() => {
    if (document.hidden) return;
    if (performance.now() - lastStepAt <= WATCHDOG_STALL_MS) return;

    // Probe: is the browser painting at all?
    const probeStartedAt = performance.now();
    requestAnimationFrame(() => {
      const rafIsAlive = performance.now() - probeStartedAt < WATCHDOG_STALL_MS;
      const stepStillStalled = performance.now() - lastStepAt > WATCHDOG_STALL_MS;
      if (!rafIsAlive || !stepStillStalled) return;

      console.warn(
        `[watchdog] rAF is running but no engine step in >${WATCHDOG_STALL_MS} ms — reloading`,
      );
      try {
        window.location.reload();
      } catch {
        /* nothing left to try */
      }
    });
  }, WATCHDOG_POLL_MS);
}

/**
 * The canvas defaults to `tabIndex = -1`, so clicking it does not move keyboard
 * focus to it. Combined with keyboard capture above, this is what makes keys
 * work on first load and again after the user has clicked elsewhere.
 */
function installCanvasFocus(game: Game): void {
  game.events.once('ready', () => {
    const canvas = game.canvas;
    if (!canvas) return;
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none';
    canvas.addEventListener('pointerdown', () => canvas.focus());
    try {
      canvas.focus();
    } catch {
      /* some browsers throw if the window itself is not focused */
    }
  });
}
