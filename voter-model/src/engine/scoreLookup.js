// src/engine/scoreLookup.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE IS
// ─────────────────────────────────────────────────────────────────────────────
// TargetSmart exports score ranges as text labels like "70-79.9".
// This file maps every possible label to three things the engine needs:
//
//   midpoint  — the number used in vote calculations (70-79.9 → 0.75)
//   partisan  — which support bucket this score falls into (for scenario lookup)
//   turnout   — which turnout bucket this score falls into (for scenario lookup)
//
// This file should never need to change unless TargetSmart changes their
// scoring system entirely — which would be a major vendor announcement.
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: "New/Never" matches the exact spelling used in scenarios.json.
// Do not change it to "New or Never" — the two files must match exactly.
// ─────────────────────────────────────────────────────────────────────────────

export const SCORE_MAP = {
  "0-9.9":   { midpoint: 0.05, partisan: "GOP Base", turnout: "New/Never"   },
  "10-19.9": { midpoint: 0.15, partisan: "GOP Base", turnout: "Rare"        },
  "20-29.9": { midpoint: 0.25, partisan: "Lean GOP", turnout: "Rare"        },
  "30-39.9": { midpoint: 0.35, partisan: "Lean GOP", turnout: "Rare"        },
  "40-49.9": { midpoint: 0.45, partisan: "Swing",    turnout: "Sometimes"   },
  "50-59.9": { midpoint: 0.55, partisan: "Swing",    turnout: "Sometimes"   },
  "60-69.9": { midpoint: 0.65, partisan: "Lean D",   turnout: "Sometimes"   },
  "70-79.9": { midpoint: 0.75, partisan: "Lean D",   turnout: "Super"       },
  "80-89.9": { midpoint: 0.85, partisan: "Dem Base", turnout: "Super"       },
  "90-100":  { midpoint: 0.95, partisan: "Dem Base", turnout: "Super Super" }
}
