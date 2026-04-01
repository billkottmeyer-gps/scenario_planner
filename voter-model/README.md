# Voter Scenario Modeling Dashboard

## What This Is
A what-if calculator for elections. Load voter data, pick a scenario, see projected
Democratic and Republican vote totals and seat counts across every district in a state.

---

## Data Refresh — How To Update With New TargetSmart Data

### Step 1 — Get your exports from TargetSmart
Pull three exports — one for Congressional Districts, one for State Senate,
one for State House. The column headers must match what is hardcoded in
`scripts/csv_to_json.js`. If they don't match, the script will tell you.

### Step 2 — Drop them in the right folder
Place all three CSV files in: `/data/raw/`
You can name the files anything you want. The script figures out which chamber
each file is by reading the column headers, not the filename.

### Step 3 — Run the processing script
Open a terminal in the root of this project and run:
```
node scripts/csv_to_json.js
```
The script will print how many rows it found in each file and confirm it worked.

### Step 4 — Commit and push
```
git add src/data/voter_model.json
git commit -m "Data refresh: [date] [state]"
git push
```
GitHub Actions will automatically deploy the updated app within 2-3 minutes.

---

## Changing Scenario Assumptions
Edit `/src/data/scenarios.json` — then commit and push.
Document the change in `CHANGELOG.md` before committing.
Do not change values without direction from the research team.

## Confirmed TargetSmart Column Headers (as of 2026-04-01)
- District (CD): `Geography/Registration Address/Voter File Congressional District`
- District (SS): `Geography/Registration Address/Voter File State Senate District`
- District (SH): `Geography/Registration Address/Voter File State House District`
- Race:          `Demographics/Individual/Ethnicity/VoterBase Race`
- Turnout Score: `Voting/Voting Behavior/TSP - Mid-Term General Turnout Score Bucket`
- Support Score: `Issues/Modeled/TSP - Partisan Score Bucket`
- Count:         `All Record Count`

⚠️  The Turnout Score column name contains "Mid-Term General". If pulling a
Presidential year or Primary export, this column name may differ. Always verify.
