/**
 * Locomotion states — bible §25.
 *
 * Seventeen states, declared complete from day one even though F1 implements
 * seven. A partial union invites `switch` statements with no default and
 * "temporary" states that outlive the milestone; a complete union with an
 * `implemented` flag on each definition makes the gap explicit and lets the
 * debug overlay say "declared, not implemented" instead of silently doing
 * nothing.
 *
 * This is one of the two cooperating machines the bible mandates instead of a
 * single enum over every movement × weapon × damage combination. That product
 * is the state explosion; two machines plus one `reconcile` function is the
 * escape from it.
 */
export type LocomotionState =
  | 'Idle'
  | 'Run'
  | 'Crouch'
  | 'JumpRise'
  | 'JumpApex'
  | 'JumpFall'
  | 'Land'
  | 'Evade'
  | 'GroundPoundPrime'
  | 'GroundPoundFall'
  | 'GroundPoundRecover'
  | 'LedgeHang'
  | 'LedgeClimb'
  | 'SurfaceClimb'
  | 'PushPull'
  | 'Mounted'
  | 'Disabled';

export const ALL_LOCOMOTION_STATES: readonly LocomotionState[] = [
  'Idle',
  'Run',
  'Crouch',
  'JumpRise',
  'JumpApex',
  'JumpFall',
  'Land',
  'Evade',
  'GroundPoundPrime',
  'GroundPoundFall',
  'GroundPoundRecover',
  'LedgeHang',
  'LedgeClimb',
  'SurfaceClimb',
  'PushPull',
  'Mounted',
  'Disabled',
] as const;

/**
 * Coarse grouping used by interrupt rules and by the action machine's
 * `allowedActions`, so a new state does not require touching every table that
 * cares about "is he airborne".
 */
export type LocomotionCategory = 'grounded' | 'airborne' | 'anchored' | 'scripted' | 'incapacitated';
