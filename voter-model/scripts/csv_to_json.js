// scripts/csv_to_json.js
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE MANUALLY
// ─────────────────────────────────────────────────────────────────────────────
// Process one state:   node scripts/csv_to_json.js ms
// Process all states:  node scripts/csv_to_json.js all
//
// Files must be named: ms_cd_export.csv, ms_ss_export_1.csv, etc.
// First two letters = state code. Script auto-detects everything else.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs")
const path = require("path")
const Papa = require("papaparse")

const CHAMBER_HEADERS = {
  "Geography/Registration Address/Voter File Congressional District": "CD",
  "Geography/Registration Address/Voter File State Senate District":  "SS",
  "Geography/Registration Address/Voter File State House District":   "SH"
}

const RACE_HEADER          = "Demographics/Individual/Ethnicity/VoterBase Race"
const TURNOUT_SCORE_HEADER = "Voting/Voting Behavior/TSP - Mid-Term General Turnout Score Bucket"
const SUPPORT_SCORE_HEADER = "Issues/Modeled/TSP - Partisan Score Bucket"
const COUNT_HEADER         = "All Record Count"

const RAW_DIR = path.join(__dirname, "../data/raw")
const OUTPUT  = path.join(__dirname, "../src/data/voter_model.json")

// ─── State argument ───────────────────────────────────────────────────────────
const stateArg = (process.argv[2] || "").toLowerCase().trim()

if (!stateArg) {
  console.error(`
ERROR: No state code provided.

Usage:
  node scripts/csv_to_json.js ms       ← process Mississippi only
  node scripts/csv_to_json.js all      ← process every state in the raw folder
`)
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectChamber(headers) {
  for (const h of headers) {
    if (CHAMBER_HEADERS[h]) return { chamber: CHAMBER_HEADERS[h], districtCol: h }
  }
  throw new Error(
    `No recognized district column found.\nHeaders: ${headers.join(" | ")}`
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

function processFile(filePath, state) {
  console.log(`\n  Reading: ${path.basename(filePath)}`)
  const raw    = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const { chamber, districtCol } = detectChamber(parsed.meta.fields)
  console.log(`  Chamber: ${chamber}  State: ${state.toUpperCase()}`)

  const rows = []
  let skipped = 0

  for (const row of parsed.data) {
    const count = parseCount(row[COUNT_HEADER])
    if (!count) { skipped++; continue }
    rows.push({
      state:    state.toUpperCase(),
      chamber:  chamber,
      district: normalizeDistrict(row[districtCol]),
      race:     extractRaceCode(row[RACE_HEADER]),
      tScore:   row[TURNOUT_SCORE_HEADER]?.trim(),
      sScore:   row[SUPPORT_SCORE_HEADER]?.trim(),
      count:    count
    })
  }

  console.log(`  Rows loaded: ${rows.length}  Skipped: ${skipped}`)
  return rows
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(RAW_DIR)) {
  console.error(`\nERROR: Raw folder not found: ${RAW_DIR}\n`)
  process.exit(1)
}

const allFiles = fs.readdirSync(RAW_DIR).filter(f => f.toLowerCase().endsWith(".csv"))

if (allFiles.length === 0) {
  console.error(`\nERROR: No CSV files found in ${RAW_DIR}\n`)
  process.exit(1)
}

// Detect all unique state prefixes from filenames
const allStates = [...new Set(allFiles.map(f => f.substring(0, 2).toLowerCase()))]

// Determine which states to process
let statesToProcess
if (stateArg === "all") {
  statesToProcess = allStates
  console.log(`\nProcessing ALL states found: ${statesToProcess.map(s=>s.toUpperCase()).join(", ")}`)
} else {
  if (stateArg.length !== 2) {
    console.error(`\nERROR: State code must be exactly two letters. Got: "${stateArg}"\n`)
    process.exit(1)
  }
  if (!allStates.includes(stateArg)) {
    console.error(`\nERROR: No files found starting with "${stateArg}" in ${RAW_DIR}`)
    console.error(`States found: ${allStates.join(", ")}\n`)
    process.exit(1)
  }
  statesToProcess = [stateArg]
  console.log(`\nProcessing state: ${stateArg.toUpperCase()}`)
}

console.log("=================================================")

const allRows = []
const summary = {}

for (const state of statesToProcess) {
  const stateFiles = allFiles.filter(f => f.toLowerCase().startsWith(state)).sort()
  console.log(`\n── ${state.toUpperCase()} (${stateFiles.length} file(s)) ──`)
  summary[state.toUpperCase()] = {}

  for (const file of stateFiles) {
    try {
      const rows = processFile(path.join(RAW_DIR, file), state)
      rows.forEach(r => {
        summary[state.toUpperCase()][r.chamber] = (summary[state.toUpperCase()][r.chamber] || 0) + 1
      })
      allRows.push(...rows)
    } catch (err) {
      console.error(`\n  ERROR in ${file}: ${err.message}`)
      process.exit(1)
    }
  }
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, JSON.stringify(allRows))

console.log("\n=================================================")
console.log(" DONE")
for (const [state, chambers] of Object.entries(summary)) {
  console.log(`\n  ${state}:`)
  for (const [chamber, count] of Object.entries(chambers)) {
    console.log(`    ${chamber}: ${count.toLocaleString()} rows`)
  }
}
console.log(`\n  Total rows: ${allRows.length.toLocaleString()}`)
console.log(`  Output: src/data/voter_model.json`)
console.log("=================================================\n")
