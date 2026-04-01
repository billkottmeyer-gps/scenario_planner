// scripts/csv_to_json.js
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE
// ─────────────────────────────────────────────────────────────────────────────
// 1. Place TargetSmart CSV exports in:
//       scenario_planner/voter-model/data/raw/
//
//    File naming convention (REQUIRED):
//       Start every file with the two-letter state abbreviation.
//       Examples: ms_cd_export.csv
//                 ms_cd_export_1.csv  ms_cd_export_2.csv  (if split)
//                 ms_ss_export.csv
//                 ms_sh_export_1.csv  ms_sh_export_2.csv
//
// 2. Open a terminal, navigate to the voter-model folder, then run:
//
//       node scripts/csv_to_json.js ms
//
//    Replace "ms" with whichever two-letter state code you want to process.
//    The script will ONLY process files that start with those two letters.
//
// 3. Output is written to:
//       scenario_planner/voter-model/src/data/voter_model.json
//
// 4. Commit the generated JSON, then push.
//    GitHub Pages will serve the updated data automatically.
//
// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLE FILES PER CHAMBER
// ─────────────────────────────────────────────────────────────────────────────
// If a single chamber export is too large and must be split into multiple
// files, just name them consistently and drop them all in the raw folder.
// The script stacks all matching files — it does not care how many there are.
//
// Example — three files that all represent Mississippi CD data:
//   ms_cd_export_1.csv
//   ms_cd_export_2.csv
//   ms_cd_export_3.csv
//
// The script detects all three are CD exports (from the column header),
// processes each one, and stacks the rows together before writing output.
// Duplicate rows are NOT removed — make sure your splits do not overlap.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs")
const path = require("path")
const Papa = require("papaparse")

// ─── Confirmed column headers from TargetSmart export (verified 2026-04-01) ──
const CHAMBER_HEADERS = {
  "Geography/Registration Address/Voter File Congressional District": "CD",
  "Geography/Registration Address/Voter File State Senate District":  "SS",
  "Geography/Registration Address/Voter File State House District":   "SH"
}

const RACE_HEADER          = "Demographics/Individual/Ethnicity/VoterBase Race"
const TURNOUT_SCORE_HEADER = "Voting/Voting Behavior/TSP - Mid-Term General Turnout Score Bucket"
const SUPPORT_SCORE_HEADER = "Issues/Modeled/TSP - Partisan Score Bucket"
const COUNT_HEADER         = "All Record Count"

// ─── Paths ────────────────────────────────────────────────────────────────────
const RAW_DIR = path.join(__dirname, "../data/raw")
const OUTPUT  = path.join(__dirname, "../src/data/voter_model.json")

// ─── State filter — read from command line argument ───────────────────────────
// Usage: node scripts/csv_to_json.js ms
// If no argument is given, the script will error and tell you what to do.
const stateArg = process.argv[2]

if (!stateArg) {
  console.error(`
ERROR: No state code provided.

Usage:   node scripts/csv_to_json.js <state>
Example: node scripts/csv_to_json.js ms

The state code must match the first two letters of your file names.
Files must be named like: ms_cd_export.csv, ms_ss_export_1.csv, etc.
`)
  process.exit(1)
}

const STATE_PREFIX = stateArg.toLowerCase().trim()

if (STATE_PREFIX.length !== 2) {
  console.error(`\nERROR: State code must be exactly two letters. You provided: "${stateArg}"\n`)
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectChamber(headers) {
  for (const h of headers) {
    if (CHAMBER_HEADERS[h]) return { chamber: CHAMBER_HEADERS[h], districtCol: h }
  }
  throw new Error(
    `No recognized district column found.\n` +
    `Headers in file:\n  ${headers.join("\n  ")}\n\n` +
    `Expected one of:\n  ${Object.keys(CHAMBER_HEADERS).join("\n  ")}\n`
  )
}

function extractRaceCode(label) {
  if (!label) return "U"
  return label.trim().charAt(0).toUpperCase()
}

function parseCount(str) {
  if (!str) return 0
  return parseInt(str.replace(/,/g, ""), 10) || 0
}

function normalizeDistrict(val) {
  if (!val) return val
  const t = val.trim()
  return /^\d+$/.test(t) ? String(parseInt(t, 10)) : t
}

// ─── Process one CSV file ─────────────────────────────────────────────────────

function processFile(filePath) {
  console.log(`\n  Reading: ${path.basename(filePath)}`)
  const raw    = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const { chamber, districtCol } = detectChamber(parsed.meta.fields)
  console.log(`  Chamber: ${chamber}`)

  const rows = []
  let skipped = 0

  for (const row of parsed.data) {
    const count = parseCount(row[COUNT_HEADER])
    if (!count) { skipped++; continue }
    rows.push({
      chamber:  chamber,
      district: normalizeDistrict(row[districtCol]),
      race:     extractRaceCode(row[RACE_HEADER]),
      tScore:   row[TURNOUT_SCORE_HEADER]?.trim(),
      sScore:   row[SUPPORT_SCORE_HEADER]?.trim(),
      count:    count
    })
  }

  console.log(`  Rows loaded:  ${rows.length}`)
  console.log(`  Rows skipped: ${skipped} (zero count)`)
  return rows
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("=================================================")
console.log(` TargetSmart CSV → voter_model.json`)
console.log(`  State filter:  ${STATE_PREFIX.toUpperCase()}`)
console.log("=================================================")

if (!fs.existsSync(RAW_DIR)) {
  console.error(`\nERROR: Raw folder not found: ${RAW_DIR}`)
  console.error("Create it and place your TargetSmart exports inside.\n")
  process.exit(1)
}

// ─── Find all CSV files that start with the state prefix ─────────────────────
const allFiles = fs.readdirSync(RAW_DIR).filter(f => f.toLowerCase().endsWith(".csv"))
const stateFiles = allFiles.filter(f => f.toLowerCase().startsWith(STATE_PREFIX))
const otherFiles = allFiles.filter(f => !f.toLowerCase().startsWith(STATE_PREFIX))

if (otherFiles.length > 0) {
  console.log(`\n  Skipping ${otherFiles.length} file(s) from other states:`)
  otherFiles.forEach(f => console.log(`    - ${f}`))
}

if (stateFiles.length === 0) {
  console.error(`\nERROR: No CSV files found starting with "${STATE_PREFIX}" in:\n  ${RAW_DIR}`)
  console.error(`\nFiles found in that folder:`)
  if (allFiles.length === 0) {
    console.error("  (folder is empty)")
  } else {
    allFiles.forEach(f => console.error(`  - ${f}`))
  }
  console.error(`\nMake sure your files are named like: ${STATE_PREFIX}_cd_export.csv\n`)
  process.exit(1)
}

console.log(`\n  Processing ${stateFiles.length} file(s) for state: ${STATE_PREFIX.toUpperCase()}`)

// ─── Track row counts per chamber for the summary ────────────────────────────
const chamberCounts = {}
const allRows = []

for (const file of stateFiles) {
  try {
    const rows = processFile(path.join(RAW_DIR, file))
    rows.forEach(r => {
      chamberCounts[r.chamber] = (chamberCounts[r.chamber] || 0) + 1
    })
    allRows.push(...rows)
  } catch (err) {
    console.error(`\n  ERROR processing ${file}:\n  ${err.message}`)
    process.exit(1)
  }
}

// ─── Write output ─────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, JSON.stringify(allRows))

console.log("\n=================================================")
console.log(` DONE — ${STATE_PREFIX.toUpperCase()}`)
Object.entries(chamberCounts).forEach(([chamber, count]) => {
  console.log(`  ${chamber}: ${count.toLocaleString()} rows`)
})
console.log(`  Total: ${allRows.length.toLocaleString()} rows`)
console.log(`  Output: src/data/voter_model.json`)
console.log("=================================================\n")
