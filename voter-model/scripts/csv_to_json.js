// scripts/csv_to_json.js
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE
// ─────────────────────────────────────────────────────────────────────────────
// 1. Place TargetSmart CSV exports in:
//       scenario_planner/voter-model/data/raw/
//
// 2. Open a terminal, navigate to the voter-model folder, then run:
//       node scripts/csv_to_json.js
//
// 3. Output is written to:
//       scenario_planner/voter-model/src/data/voter_model.json
//
// 4. Commit both the raw CSVs and the generated JSON, then push.
//    GitHub Pages will serve the updated data automatically.
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

// ─── Paths relative to this script's location ────────────────────────────────
const RAW_DIR = path.join(__dirname, "../data/raw")
const OUTPUT  = path.join(__dirname, "../src/data/voter_model.json")

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectChamber(headers) {
  for (const h of headers) {
    if (CHAMBER_HEADERS[h]) return { chamber: CHAMBER_HEADERS[h], districtCol: h }
  }
  throw new Error(
    `\nERROR: No recognized district column found.\n` +
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
  console.log(`\nReading: ${path.basename(filePath)}`)
  const raw    = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const { chamber, districtCol } = detectChamber(parsed.meta.fields)
  console.log(`  Chamber detected: ${chamber}`)

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

  console.log(`  Rows loaded:   ${rows.length}`)
  console.log(`  Rows skipped:  ${skipped} (zero count)`)
  return rows
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("=================================================")
console.log(" TargetSmart CSV → voter_model.json")
console.log("=================================================")

if (!fs.existsSync(RAW_DIR)) {
  console.error(`\nERROR: Raw folder not found: ${RAW_DIR}`)
  console.error("Create it and place your TargetSmart CSV exports inside.\n")
  process.exit(1)
}

const files = fs.readdirSync(RAW_DIR).filter(f => f.toLowerCase().endsWith(".csv"))

if (files.length === 0) {
  console.error(`\nERROR: No CSV files found in: ${RAW_DIR}\n`)
  process.exit(1)
}

console.log(`\nFound ${files.length} CSV file(s).`)

const allRows = []
for (const file of files) {
  allRows.push(...processFile(path.join(RAW_DIR, file)))
}

// Ensure output directory exists
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, JSON.stringify(allRows))

console.log("\n=================================================")
console.log(` DONE`)
console.log(`  Total rows: ${allRows.length}`)
console.log(`  Written to: src/data/voter_model.json`)
console.log("=================================================\n")
