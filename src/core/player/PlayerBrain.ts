import { MOVEMENT } from '../tuning/movement.ts';
import { integrateHorizontal } from '../physics/integrate.ts';
import type { HorizontalControl } from '../physics/integrate.ts';
import { freezeMotion } from '../physics/MotionCommand.ts';
import type { MotionCommand, MotionDraft } from '../physics/MotionCommand.ts';
import { LocomotionMachine } from './locomotion/LocomotionMachine.ts';
import { LOCOMOTION_DEFS } from './locomotion/definitions.ts';
import type { LocomotionState } from './locomotion/states.ts';
import { ActionMachine } from './action/ActionMachine.ts';
import { ACTION_DEFS } from './action/definitions.ts';
import { ACTION_CATEGORY } from './action/states.ts';
import type { ActionState } from './action/states.ts';
import { JumpController } from './jump.ts';
import type { MachineIO, PlayerDebugFrame, PlayerEffect, PlayerTickContext } from './types.ts';

export interface PlayerTickResult {
  readonly motion: MotionCommand;
  readonly locomotion: LocomotionState;
  readonly action: ActionState;
  readonly animationKey: string;
  readonly effects: readonly PlayerEffect[];
  readonly debug: PlayerDebugFrame;
}

/**
 * The player, as a pure function of (body sample, input, world probe) → motion.
 *
 * Holds no engine reference of any kind, which is what makes every test in
 * tests/core/player an object literal rather than a scene boot.
 *
 * The per-tick handshake is single-pass and deterministic — action proposes,
 * locomotion decides, action reconciles — so there is no negotiation loop that
 * could fail to converge, and replaying the same inputs always produces the
 * same commands.
 */
export class PlayerBrain {
  private readonly locomotion = new LocomotionMachine('Idle');
  private readonly action = new ActionMachine('Free');
  private readonly jump = new JumpController();
  private facing: 1 | -1 = 1;

  tick(ctx: PlayerTickContext): PlayerTickResult {
    const effects: PlayerEffect[] = [];
    const grounded = ctx.body.contacts.down;

    this.jump.noteGrounded(ctx.timeMs, grounded);

    // 1. Action proposes what it needs from the body this frame.
    const constraint = this.action.propose(ctx);

    // 2. Resolve effective steering from the state we are currently in. Using
    //    the pre-transition value is deliberate: applying the *new* state's
    //    control on the same frame it is entered produces a one-frame velocity
    //    step that reads as a hitch.
    const entryDef = LOCOMOTION_DEFS[this.locomotion.current()];
    const control: HorizontalControl = constraint.forcesHorizontal ?? entryDef.horizontalControl;

    const axisX = ctx.input.axisX();
    if (axisX > 0) this.facing = 1;
    else if (axisX < 0) this.facing = -1;

    const draft: MotionDraft = {
      vx: integrateHorizontal({
        vx: ctx.body.vx,
        axisX,
        dtSec: ctx.dtSec,
        control,
        grounded,
        speedScale: constraint.speedScale,
      }),
      vyOverride: null,
      gravityScale: entryDef.gravityScale,
      maxFall: entryDef.maxFall ?? MOVEMENT.maxFall,
      teleport: null,
      bodyHeight: entryDef.bodyHeight,
      facing: this.facing,
    };

    const io: MachineIO = {
      ctx,
      draft,
      control,
      speedScale: constraint.speedScale,
      vy: () => draft.vyOverride ?? ctx.body.vy,
      request: (next) => this.locomotion.request(next),
      emit: (effect) => effects.push(effect),
      timeInState: () => this.locomotion.timeInState(ctx.timeMs),
    };

    // 3. Jump initiation is owned by the brain, not by any single state.
    //    Coyote time means a jump can legitimately begin while already in
    //    JumpFall, so no grounded state can own it — and the state being left
    //    must not get a veto over it.
    if (this.jump.tryJump(ctx.input, ctx.timeMs, grounded)) {
      draft.vyOverride = MOVEMENT.jumpVelocity;
      this.locomotion.force('JumpRise', io);
      effects.push({ kind: 'sfx', id: 'jump' });
    }

    // 4. Locomotion decides.
    if (constraint.forcesLocomotion !== null) {
      this.locomotion.force(constraint.forcesLocomotion, io);
    }
    this.locomotion.tick(io);

    // 5. Adopt the resolved state's physical properties.
    const exitDef = LOCOMOTION_DEFS[this.locomotion.current()];
    draft.gravityScale = exitDef.gravityScale;
    draft.maxFall = exitDef.maxFall ?? MOVEMENT.maxFall;
    draft.bodyHeight = exitDef.bodyHeight;

    // 6. Variable-height cut, after the state is settled so a jump started this
    //    frame cannot be cut by the same frame's button state.
    if (draft.vyOverride === null) {
      const cut = this.jump.applyVariableCut(ctx.body.vy, ctx.input.held('jump'));
      if (cut !== null) draft.vyOverride = cut;
    }

    // 7. Reconcile: force the action into something this body can actually do.
    const allowed = exitDef.allowedActions;
    if (!allowed.includes(ACTION_CATEGORY[this.action.current()])) {
      this.action.forceTo(this.action.fallback());
    }

    draft.facing = this.facing;

    const actionDef = ACTION_DEFS[this.action.current()];
    const animationKey = actionDef.animationKey ?? exitDef.animationKey;

    return {
      motion: freezeMotion(draft),
      locomotion: this.locomotion.current(),
      action: this.action.current(),
      animationKey,
      effects,
      debug: {
        locomotion: this.locomotion.current(),
        action: this.action.current(),
        timeInStateMs: this.locomotion.timeInState(ctx.timeMs),
        vx: draft.vx,
        vy: draft.vyOverride ?? ctx.body.vy,
        grounded,
        coyoteRemainingMs: this.jump.coyoteRemainingMs(ctx.timeMs),
        jumpBufferRemainingMs: Math.max(0, MOVEMENT.jumpBufferMs - ctx.input.sincePress('jump')),
        gravityScale: draft.gravityScale,
        horizontalControl: control,
        animationKey,
        facing: this.facing,
      },
    };
  }

  /** For dialogue, damage and cutscenes. */
  forceAction(next: ActionState): void {
    this.action.force(next);
  }

  /** Bible §26: a deliberate drop-through must not also grant a coyote jump. */
  noteDropThrough(): void {
    this.jump.noteDropThrough();
  }

  locomotionState(): LocomotionState {
    return this.locomotion.current();
  }

  actionState(): ActionState {
    return this.action.current();
  }
}
