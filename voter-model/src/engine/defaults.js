// src/engine/defaults.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE IS
// ─────────────────────────────────────────────────────────────────────────────
// Default force multiplier values for every racial group.
// These are what the dashboard starts with when it first loads.
//
// 1.0 means the scenario applies at full strength to this group.
// 0.8 means only 80% of the scenario delta applies to this group.
// 0.0 means the scenario has no effect on this group at all.
//
// The user can change these in the dashboard UI at any time.
// Changing them here changes what the dashboard STARTS with, not what
// the user is locked into.
//
// Race codes match exactly what TargetSmart exports:
//   W = White
//   B = Black
//   H = Hispanic or Latino
//   A = Asian or Pacific Islander
//   N = Native American
//   U = Uncoded (TargetSmart could not determine race)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FORCE_MULTIPLIERS = {
  W: { turnout: 1.0, support: 1.0 },
  B: { turnout: 1.0, support: 1.0 },
  H: { turnout: 1.0, support: 1.0 },
  A: { turnout: 1.0, support: 1.0 },
  N: { turnout: 1.0, support: 1.0 },
  U: { turnout: 1.0, support: 1.0 }
}
