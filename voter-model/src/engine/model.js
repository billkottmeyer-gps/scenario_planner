// src/engine/model.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE IS
// ─────────────────────────────────────────────────────────────────────────────
// This is the calculation engine. It does all the math.
// It has no UI in it. It does not know React exists.
// It can be imported anywhere — the app, tests, scripts.
//
// It takes in voter data rows, a selected scenario, and force multipliers.
// It returns initial and adjusted vote projections for every district,
// plus statewide totals and a seat count.
//
// DO NOT put any display logic, formatting, or UI code in this file.
// ─────────────────────────────────────────────────────────────────────────────

import { SCORE_MAP }                from "./scoreLookup.js"
import { DEFAULT_FORCE_MULTIPLIERS } from "./defaults.js"

// ─────────────────────────────────────────────────────────────────────────────
// ROW-LEVEL CALCULATION
// ─────────────────────────────────────────────────────────────────────────────
// Takes one row of voter data and returns initial and adjusted vote totals.
//
// The formulas:
//
//   Initial Turnout   = Count × T_Midpoint
//   Initial Dem Votes = Initial Turnout × S_Midpoint
//   Initial Rep Votes = Initial Turnout − Initial Dem Votes
//
//   Adjusted Turnout  = Initial Turnout × (1 + Turnout Delta × Turnout Force)
//   Adjusted Dem Rate = (Initial Dem Votes / Initial Turnout) + (Support Delta × Support Force)
//   Adjusted Dem Votes = Adjusted Dem Rate × Adjusted Turnout
//   Adjusted Rep Votes = Adjusted Turnout − Adjusted Dem Votes
//
// ─────────────────────────────────────────────────────────────────────────────

function projectRow(row, scenario, forceMultipliers) {
  // Look up midpoints and bucket names for this row's score ranges
  const tMap = SCORE_MAP[row.tScore]
  const sMap = SCORE_MAP[row.sScore]

  // If a score range comes in that isn't in the lookup table, skip this row
  // and log a warning so developers can catch bad data early.
  if (!tMap || !sMap) {
    console.warn(
      `WARNING: Unrecognized score range in row — ` +
      `tScore: "${row.tScore}", sScore: "${row.sScore}". ` +
      `District: ${row.district}, Race: ${row.race}. Row skipped.`
    )
    return null
  }

  // ── Initial Projection ────────────────────────────────────────────────────
  // No scenario applied. Raw midpoints × count.
  const initialTurnout = row.count * tMap.midpoint
  const initialDem     = initialTurnout * sMap.midpoint
  const initialRep     = initialTurnout - initialDem

  // ── Scenario Delta Lookup ─────────────────────────────────────────────────
  // Find the delta for this row's exact combination of turnout bucket and
  // partisan bucket within the selected scenario.
  // If no scenario is selected (Baseline), deltas are 0 and nothing changes.
  const turnoutDelta = scenario?.Turnout?.[tMap.turnout]?.[sMap.partisan] ?? 0
  const supportDelta = scenario?.Support?.[tMap.turnout]?.[sMap.partisan] ?? 0

  // ── Force Multipliers ─────────────────────────────────────────────────────
  // Scale the delta by how strongly the user wants this racial group affected.
  // Default is 1.0 — full effect. 0.8 = 80% of the delta. 0.0 = no effect.
  const force        = forceMultipliers?.[row.race] ?? DEFAULT_FORCE_MULTIPLIERS[row.race]
  const turnoutForce = force?.turnout ?? 1.0
  const supportForce = force?.support ?? 1.0

  // ── Adjusted Projection ───────────────────────────────────────────────────
  const adjTurnout = initialTurnout * (1 + (turnoutDelta * turnoutForce))
  const adjDemRate = (initialDem / initialTurnout) + (supportDelta * supportForce)
  const adjDem     = adjDemRate * adjTurnout
  const adjRep     = adjTurnout - adjDem

  return { initialTurnout, initialDem, initialRep, adjTurnout, adjDem, adjRep }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTRICT AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────
// Groups all rows by district within the selected chamber.
// Applies optional race and district filters if the user has set them.
// Runs projectRow on every qualifying row and sums up the results per district.
// ─────────────────────────────────────────────────────────────────────────────

function aggregateDistricts(rows, filters, scenario, forceMultipliers) {
  const { chamber, race, district } = filters
  const districts = {}

  for (const row of rows) {
    // Skip rows that don't match the selected chamber
    if (row.chamber !== chamber) continue

    // Skip rows that don't match the race filter (if one is set)
    if (race && race !== "All" && row.race !== race) continue

    // Skip rows that don't match the district filter (if one is set)
    if (district && district !== "All" && row.district !== district) continue

    // Initialize this district's accumulator the first time we see it
    if (!districts[row.district]) {
      districts[row.district] = {
        initialDem: 0, initialRep: 0, initialTurnout: 0,
        adjDem:     0, adjRep:     0, adjTurnout:     0
      }
    }

    // Run the row calculation
    const result = projectRow(row, scenario, forceMultipliers)

    // Skip rows where projectRow returned null (bad score data)
    if (!result) continue

    // Add this row's results to its district's running totals
    const d = districts[row.district]
    d.initialDem     += result.initialDem
    d.initialRep     += result.initialRep
    d.initialTurnout += result.initialTurnout
    d.adjDem         += result.adjDem
    d.adjRep         += result.adjRep
    d.adjTurnout     += result.adjTurnout
  }

  return districts
}

// ─────────────────────────────────────────────────────────────────────────────
// STATEWIDE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
// Rolls up all districts into statewide totals.
// Determines which districts Democrats win — any district where adjusted
// Democratic votes exceed 50% of total two-party votes is a Democratic win.
// ─────────────────────────────────────────────────────────────────────────────

function statewideSummary(districts) {
  let totalInitialDem     = 0
  let totalInitialRep     = 0
  let totalInitialTurnout = 0
  let totalAdjDem         = 0
  let totalAdjRep         = 0
  let totalAdjTurnout     = 0
  let seatsWon            = 0

  const districtResults = {}
  const totalSeats      = Object.keys(districts).length

  for (const [districtName, d] of Object.entries(districts)) {
    totalInitialDem     += d.initialDem
    totalInitialRep     += d.initialRep
    totalInitialTurnout += d.initialTurnout
    totalAdjDem         += d.adjDem
    totalAdjRep         += d.adjRep
    totalAdjTurnout     += d.adjTurnout

    // Win = Democrats get more than 50% of the two-party adjusted vote
    const adjDemShare = d.adjDem / (d.adjDem + d.adjRep)
    const win         = adjDemShare > 0.50
    if (win) seatsWon++

    districtResults[districtName] = { ...d, adjDemShare, win }
  }

  const initialTotal = totalInitialDem + totalInitialRep
  const adjTotal     = totalAdjDem + totalAdjRep

  return {
    initial: {
      dem:     totalInitialDem,
      rep:     totalInitialRep,
      demPct:  initialTotal > 0 ? totalInitialDem / initialTotal : 0,
      turnout: totalInitialTurnout
    },
    updated: {
      dem:     totalAdjDem,
      rep:     totalAdjRep,
      demPct:  adjTotal > 0 ? totalAdjDem / adjTotal : 0,
      turnout: totalAdjTurnout
    },
    seats:     { won: seatsWon, total: totalSeats },
    districts: districtResults
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
// This is the only function the React app needs to call.
// Pass everything in, get everything back.
//
// Parameters:
//   rows             — the full voter_model.json array
//   filters          — { chamber: "CD"|"SS"|"SH", race: "W"|"B"|...|"All", district: "3"|"All" }
//   scenario         — one scenario object from scenarios.json, or null for Baseline
//   forceMultipliers — object with turnout and support multipliers per race code
// ─────────────────────────────────────────────────────────────────────────────

export function runModel({ rows, filters, scenario, forceMultipliers }) {
  const districts = aggregateDistricts(rows, filters, scenario, forceMultipliers)
  return statewideSummary(districts)
}
