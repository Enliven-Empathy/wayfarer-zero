import type { LocomotionState } from './states.ts';
import type { LocomotionStateDef, MachineIO } from '../types.ts';

/**
 * Speed below which a decelerating Run is considered stopped, px/s. Above zero
 * so the last few px/s of drift do not hold the run animation.
 */
const IDLE_SPEED_EPSILON = 8;

/**
 * Half-width of the apex band, px/s. Inside |vy| < this, the jump reads as
 * hanging at the top.
 *
 * `JumpApex` deliberately runs at gravityScale 1.0. Real hangtime (a scale
 * below 1 near the peak) is a legitimate and common feel choice, but it changes
 * the jump arc away from the bible's analytic 152.82 px and that is a tuning
 * decision for a playtest, not something to smuggle in at F1. The state exists
 * now so the animation and the debug overlay can distinguish the moment; giving
 * it hangtime later is a one-line change to `gravityScale` below, plus updating
 * the arc test that currently pins the analytic value.
 */
const APEX_BAND_VY = 140;

/** How long the landing pose holds before returning control-neutral, ms. */
const LAND_DURATION_MS = 70;

const NEVER_INTERRUPTED = { minDurationMs: 0, by: 'none', overrides: ['Disabled'] } as const;
const FREELY_INTERRUPTED = { minDurationMs: 0, by: 'any', overrides: [] } as const;

/** Shared by every grounded state: walking off an edge, and landing. */
function airborneCheck(io: MachineIO): boolean {
  if (!io.ctx.body.contacts.down) {
    io.request('JumpFall');
    return true;
  }
  return false;
}

/**
 * Has Rook actually landed?
 *
 * `contacts` comes from the *previous* frame's collision pass, so on the frame
 * a jump launches it still reports `down: true` — he was standing on the floor
 * when the sample was taken. Checking contacts alone therefore made `JumpRise`
 * request `Land` on its very first tick: every jump went
 * `Idle → JumpRise → Land → JumpFall` and the rise state was never observable,
 * which broke both the animation and any logic keyed to "is he going up".
 *
 * Requiring downward motion as well is the general fix — you cannot land while
 * still travelling upward, whatever a stale contact flag says.
 */
function hasLanded(io: MachineIO): boolean {
  return io.ctx.body.contacts.down && io.vy() >= 0;
}

export const LOCOMOTION_DEFS: Readonly<Record<LocomotionState, LocomotionStateDef>> = {
  Idle: {
    id: 'Idle',
    category: 'grounded',
    acceptsInputs: ['moveLeft', 'moveRight', 'moveDown', 'jump', 'evade', 'grabInteract', 'lightAttack', 'heavyAttack'],
    horizontalControl: 'full',
    gravityScale: 1,
    allowedActions: ['none', 'unarmed', 'weapon', 'ranged', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'idle',
    bodyHeight: 'standing',
    implemented: true,
    tick: (io) => {
      if (airborneCheck(io)) return;
      if (io.ctx.input.axisX() !== 0) io.request('Run');
    },
  },

  Run: {
    id: 'Run',
    category: 'grounded',
    acceptsInputs: ['moveLeft', 'moveRight', 'moveDown', 'jump', 'evade', 'grabInteract', 'lightAttack', 'heavyAttack'],
    horizontalControl: 'full',
    gravityScale: 1,
    allowedActions: ['none', 'unarmed', 'weapon', 'ranged', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'run',
    bodyHeight: 'standing',
    implemented: true,
    tick: (io) => {
      if (airborneCheck(io)) return;
      if (io.ctx.input.axisX() === 0 && Math.abs(io.draft.vx) < IDLE_SPEED_EPSILON) {
        io.request('Idle');
      }
    },
  },

  Crouch: {
    id: 'Crouch',
    category: 'grounded',
    acceptsInputs: ['moveLeft', 'moveRight', 'moveDown', 'jump', 'grabInteract'],
    horizontalControl: 'reduced',
    gravityScale: 1,
    allowedActions: ['none', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'crouch',
    bodyHeight: 'crouched',
    implemented: false,
  },

  JumpRise: {
    id: 'JumpRise',
    category: 'airborne',
    acceptsInputs: ['moveLeft', 'moveRight', 'jump', 'lightAttack', 'grabInteract'],
    horizontalControl: 'full',
    gravityScale: 1,
    allowedActions: ['none', 'unarmed', 'weapon', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'jump',
    bodyHeight: 'standing',
    implemented: true,
    tick: (io) => {
      if (hasLanded(io)) {
        io.request('Land');
        return;
      }
      if (io.vy() > -APEX_BAND_VY) io.request('JumpApex');
    },
  },

  JumpApex: {
    id: 'JumpApex',
    category: 'airborne',
    acceptsInputs: ['moveLeft', 'moveRight', 'jump', 'lightAttack', 'grabInteract'],
    horizontalControl: 'full',
    gravityScale: 1,
    allowedActions: ['none', 'unarmed', 'weapon', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'jumpApex',
    bodyHeight: 'standing',
    implemented: true,
    tick: (io) => {
      if (hasLanded(io)) {
        io.request('Land');
        return;
      }
      if (io.vy() > APEX_BAND_VY) io.request('JumpFall');
    },
  },

  JumpFall: {
    id: 'JumpFall',
    category: 'airborne',
    acceptsInputs: ['moveLeft', 'moveRight', 'jump', 'moveDown', 'lightAttack', 'grabInteract'],
    horizontalControl: 'full',
    gravityScale: 1,
    allowedActions: ['none', 'unarmed', 'weapon', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'fall',
    bodyHeight: 'standing',
    implemented: true,
    tick: (io) => {
      if (hasLanded(io)) io.request('Land');
    },
  },

  Land: {
    id: 'Land',
    category: 'grounded',
    acceptsInputs: ['moveLeft', 'moveRight', 'jump', 'evade', 'grabInteract'],
    /**
     * Full control, deliberately. A landing that takes control away is a
     * punishment for having jumped, and the bible's difficulty target is
     * "demanding but generous". This state exists for the animation and for
     * the landing effect, not to slow the player down.
     */
    horizontalControl: 'full',
    gravityScale: 1,
    allowedActions: ['none', 'unarmed', 'weapon', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'land',
    bodyHeight: 'standing',
    implemented: true,
    onEnter: (io) => {
      io.emit({ kind: 'sfx', id: 'land' });
      io.emit({ kind: 'fx', id: 'landDust' });
    },
    tick: (io) => {
      if (airborneCheck(io)) return;
      if (io.timeInState() < LAND_DURATION_MS) return;
      io.request(io.ctx.input.axisX() !== 0 ? 'Run' : 'Idle');
    },
  },

  Evade: {
    id: 'Evade',
    category: 'scripted',
    acceptsInputs: [],
    horizontalControl: 'scripted',
    gravityScale: 0,
    allowedActions: ['none', 'forced'],
    interrupt: { minDurationMs: 120, by: 'none', overrides: ['Disabled'] },
    animationKey: 'evade',
    bodyHeight: 'standing',
    implemented: false,
  },

  GroundPoundPrime: {
    id: 'GroundPoundPrime',
    category: 'scripted',
    acceptsInputs: ['jump', 'moveDown'],
    horizontalControl: 'locked',
    // Frozen at the tuck. Only meaningful because world gravity is zero.
    gravityScale: 0,
    allowedActions: ['none', 'forced'],
    interrupt: { minDurationMs: 0, by: ['JumpFall'], overrides: ['Disabled'] },
    animationKey: 'poundPrime',
    bodyHeight: 'crouched',
    implemented: false,
  },

  GroundPoundFall: {
    id: 'GroundPoundFall',
    category: 'scripted',
    acceptsInputs: [],
    horizontalControl: 'scripted',
    gravityScale: 1,
    allowedActions: ['none', 'forced'],
    interrupt: NEVER_INTERRUPTED,
    animationKey: 'poundFall',
    bodyHeight: 'crouched',
    // A pound legitimately exceeds terminal velocity; that is the whole point.
    maxFall: 1800,
    implemented: false,
  },

  GroundPoundRecover: {
    id: 'GroundPoundRecover',
    category: 'grounded',
    acceptsInputs: [],
    horizontalControl: 'locked',
    gravityScale: 1,
    allowedActions: ['none', 'forced'],
    interrupt: { minDurationMs: 220, by: 'any', overrides: ['Disabled'] },
    animationKey: 'poundRecover',
    bodyHeight: 'crouched',
    implemented: false,
  },

  LedgeHang: {
    id: 'LedgeHang',
    category: 'anchored',
    acceptsInputs: ['jump', 'moveDown', 'moveLeft', 'moveRight'],
    horizontalControl: 'locked',
    gravityScale: 0,
    allowedActions: ['none', 'forced'],
    interrupt: NEVER_INTERRUPTED,
    animationKey: 'ledgeHang',
    bodyHeight: 'standing',
    implemented: false,
  },

  LedgeClimb: {
    id: 'LedgeClimb',
    category: 'scripted',
    acceptsInputs: [],
    horizontalControl: 'scripted',
    gravityScale: 0,
    allowedActions: ['none', 'forced'],
    interrupt: NEVER_INTERRUPTED,
    animationKey: 'ledgeClimb',
    bodyHeight: 'standing',
    implemented: false,
  },

  SurfaceClimb: {
    id: 'SurfaceClimb',
    category: 'anchored',
    acceptsInputs: ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'jump'],
    horizontalControl: 'scripted',
    gravityScale: 0,
    allowedActions: ['none', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'surfaceClimb',
    bodyHeight: 'standing',
    implemented: false,
  },

  PushPull: {
    id: 'PushPull',
    category: 'grounded',
    acceptsInputs: ['moveLeft', 'moveRight', 'grabInteract'],
    horizontalControl: 'reduced',
    gravityScale: 1,
    allowedActions: ['none', 'handling', 'forced'],
    interrupt: FREELY_INTERRUPTED,
    animationKey: 'pushPull',
    bodyHeight: 'standing',
    implemented: false,
  },

  Mounted: {
    id: 'Mounted',
    category: 'scripted',
    acceptsInputs: ['moveLeft', 'moveRight', 'jump', 'grabInteract', 'lightAttack'],
    horizontalControl: 'scripted',
    gravityScale: 1,
    allowedActions: ['none', 'weapon', 'forced'],
    interrupt: NEVER_INTERRUPTED,
    animationKey: 'mounted',
    bodyHeight: 'standing',
    implemented: false,
  },

  Disabled: {
    id: 'Disabled',
    category: 'incapacitated',
    acceptsInputs: [],
    horizontalControl: 'locked',
    gravityScale: 1,
    allowedActions: ['none', 'forced'],
    interrupt: NEVER_INTERRUPTED,
    animationKey: 'disabled',
    bodyHeight: 'standing',
    implemented: true,
  },
};

export const LOCOMOTION_CONSTANTS = {
  IDLE_SPEED_EPSILON,
  APEX_BAND_VY,
  LAND_DURATION_MS,
} as const;
