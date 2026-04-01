// scripts/csv_to_json.js
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE THIS SCRIPT
// ─────────────────────────────────────────────────────────────────────────────
// 1. Drop your three TargetSmart CSV exports into /data/raw/
// 2. Open a terminal in the root of this project
// 3. Run: node scripts/csv_to_json.js
// 4. It will create/overwrite /src/data/voter_model.json
// 5. Commit that file and push — the app is updated
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs")
const path = require("path")
const Papa = require("papaparse")

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMED COLUMN HEADERS — verified from real TargetSmart export 2026-04-01
// Do NOT change these unless TargetSmart changes their export format.
// If the script breaks after a new export, compare these strings to the
// actual column names in the new file — one character difference will break it.
// ─────────────────────────────────────────────────────────────────────────────

// The district column — one of these three will appear in each export file.
// The script reads whichever one is present and uses it to set the Chamber.
const CHAMBER_HEADERS = {
  "Geography/Registration Address/Voter File Congressional District": "CD",
  "Geography/Registration Address/Voter File State Senate District":  "SS",
  "Geography/Registration Address/Voter File State House District":   "SH"
}

// The race column — values come as "W - White", "B - Black", etc.
// The script automatically extracts just the first letter (W, B, H, A, N, U).
const RACE_HEADER = "Demographics/Individual/Ethnicity/VoterBase Race"

// The turnout score bucket column — values come as "0-9.9", "10-19.9", etc.
// NOTE: This column name contains "Mid-Term General" — if you are pulling
// a Presidential year or Primary export, this name may be different.
// Always verify against a real export file before running.
const TURNOUT_SCORE_HEADER = "Voting/Voting Behavior/TSP - Mid-Term General Turnout Score Bucket"

// The partisan support score bucket column — values come as "0-9.9", etc.
const SUPPORT_SCORE_HEADER = "Issues/Modeled/TSP - Partisan Score Bucket"

// The count column — values come with commas like "48,676".
// The script automatically strips commas and converts to a plain integer.
const COUNT_HEADER = "All Record Count"

// ─────────────────────────────────────────────────────────────────────────────
// FILE PATHS — do not change these unless you restructure the project folders
// ─────────────────────────────────────────────────────────────────────────────

const RAW_DIR = path.join(__dirname, "../data/raw")
const OUTPUT  = path.join(__dirname, "../src/data/voter_model.json")

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Reads the column headers in a file and figures out which chamber it is.
// Throws a clear error if no recognized district column is found.
function detectChamber(headers) {
  for (const h of headers) {
    if (CHAMBER_HEADERS[h]) {
      return { chamber: CHAMBER_HEADERS[h], districtCol: h }
    }
  }
  throw new Error(
    `\nERROR: Could not find a district column in this file.\n` +
    `Headers found in file:\n  ${headers.join("\n  ")}\n\n` +
    `Expected one of:\n  ${Object.keys(CHAMBER_HEADERS).join("\n  ")}\n`
  )
}

// Extracts just the single letter race code from a full label.
// "W - White" becomes "W", "B - Black" becomes "B", etc.
function extractRaceCode(raceLabel) {
  if (!raceLabel) return "U"
  return raceLabel.trim().charAt(0).toUpperCase()
}

// Strips commas from a number string and converts to integer.
// "48,676" becomes 48676. "1234" stays 1234.
function parseCount(countString) {
  if (!countString) return 0
  return parseInt(countString.replace(/,/g, ""), 10) || 0
}

// Strips leading zeros from district numbers for consistency.
// "003" becomes "3". "047" becomes "47". "1A" stays "1A".
function normalizeDistrict(districtValue) {
  if (!districtValue) return districtValue
  const trimmed = districtValue.trim()
  // If it looks purely numeric, strip leading zeros
  if (/^\d+$/.test(trimmed)) {
    return String(parseInt(trimmed, 10))
  }
  // Otherwise return as-is (handles text district names)
  return trimmed
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PROCESSING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

function processFile(filePath) {
  console.log(`\nReading: ${path.basename(filePath)}`)

  const raw    = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const headers = parsed.meta.fields

  // Figure out which chamber this file is for
  const { chamber, districtCol } = detectChamber(headers)
  console.log(`  Detected chamber: ${chamber}`)

  const rows    = []
  let skipped   = 0

  for (const row of parsed.data) {
    const count = parseCount(row[COUNT_HEADER])

    // Skip rows with zero count — they contribute nothing to the math
    if (!count || count === 0) {
      skipped++
      continue
    }

    rows.push({
      chamber:  chamber,                            // "CD", "SS", or "SH" — added by this script
      district: normalizeDistrict(row[districtCol]),// district number, leading zeros removed
      race:     extractRaceCode(row[RACE_HEADER]),  // single letter: W, B, H, A, N, U
      tScore:   row[TURNOUT_SCORE_HEADER]?.trim(),  // "0-9.9", "10-19.9", ... "90-100"
      sScore:   row[SUPPORT_SCORE_HEADER]?.trim(),  // "0-9.9", "10-19.9", ... "90-100"
      count:    count                               // plain integer, e.g. 48676
    })
  }

  console.log(`  Rows loaded: ${rows.length}`)
  console.log(`  Rows skipped (zero count): ${skipped}`)

  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────

console.log("=================================================")
console.log(" TargetSmart CSV → voter_model.json")
console.log("=================================================")

// Check the raw folder exists
if (!fs.existsSync(RAW_DIR)) {
  console.error(`\nERROR: Raw data folder not found at: ${RAW_DIR}`)
  console.error("Create the folder and place your CSV exports inside it.\n")
  process.exit(1)
}

// Find all CSV files in the raw folder
const files = fs.readdirSync(RAW_DIR).filter(f => f.toLowerCase().endsWith(".csv"))

if (files.length === 0) {
  console.error(`\nERROR: No CSV files found in: ${RAW_DIR}`)
  console.error("Place your TargetSmart exports there and run this script again.\n")
  process.exit(1)
}

console.log(`\nFound ${files.length} CSV file(s) to process.`)

const allRows = []

for (const file of files) {
  const rows = processFile(path.join(RAW_DIR, file))
  allRows.push(...rows)
}

// Write the combined output
fs.writeFileSync(OUTPUT, JSON.stringify(allRows, null, 2))

console.log("\n=================================================")
console.log(` DONE`)
console.log(`  Total rows written: ${allRows.length}`)
console.log(`  Output file: src/data/voter_model.json`)
console.log("=================================================\n")
