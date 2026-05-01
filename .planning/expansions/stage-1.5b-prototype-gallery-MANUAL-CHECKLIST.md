# Manual setup checklist — stage-1.5b-prototype-gallery

**Status:** PENDING JAKE — 3 items
**Generated:** 2026-05-01 14:25

After completing each item, run `/nightwork-auto-setup stage-1.5b-prototype-gallery` again to validate.

---

## Item M1: Stage priority Drummond raw files into the fixture directory

**Why:** EXPANDED-SCOPE deliverable #1 (Drummond fixture sanitization) requires raw source files in a deterministic location. The extraction script reads from `.planning/fixtures/drummond/source3-downloads/`; today only `INVENTORY.md` lives there. Per the inventory, the actual files are in `C:\Users\Jake\Downloads\`. Auto-setup cannot copy them — your privacy posture (D-029) requires you to make the staging decision yourself.

**Time estimate:** 5-10 minutes (file copy via Explorer or PowerShell).

**What to copy** (priority subset for 1.5b — full inventory is in `INVENTORY.md`):

### A. Pay apps (5 historical) — needed for draws + G702/G703 + schedule reconstruction
- `Drummond - Pay App 1 - March-July 2025.xls`
- `Drummond - Pay App 2 - August 2025.xls`
- `Drummond - Pay App 3 - September 2025 REVISED.xls`
- `Drummond - Pay App 4 - October 2025.xlsx`
- `Pay Application #5 - Drummond-501 74th St.pdf`
- `Draw_5_Drummond-501_74th_St_G702_G703.pdf` (G702/G703 reference truth)

### B. Budget XLSX
- `Drummond_Budget_2026-04-15.xlsx`

### C. Schedule (per Q2 override C — schedule prototype #11)
- `Drummond_Schedule.xlsx`
- `Schedule_List_Drummond-501 74th St.xlsx`
- `Schedule_Gantt_Drummond-501 74th St (12).pdf` (latest Gantt PDF — for visual reference)

### D. Lien releases (Florida 4-statute types)
- `Drummond-Nov 2025 Lein Releases (2).pdf`

### E. Invoices (4-6 representative)
- `Drummond November 2025 Corresponding Invoices.pdf` (combined batch — for splitting reference)
- 4-6 from `C:\Users\Jake\Downloads\split-invoices\` (recommended: SmartShield-105472, FloridaSunshine-7093, Ferguson-6713881, Loftin-26125163, IslandLumber-525830, ParadiseFoam-5977 — covers clean-PDF / T&M / lump-sum / multi-line types)

### F. (Optional) Contract + permit reference
- `Ross Built - Construction Agreement - Drummond.docx` (sanitized contract reference for Document Review prototype)

**Steps:**

1. Open PowerShell or File Explorer.
2. Navigate to `C:\Users\Jake\Downloads\`.
3. Copy the files listed above into `C:\Users\Jake\nightwork-platform\.planning\fixtures\drummond\source3-downloads\`.
4. (Optional but recommended) For the split-invoices subset, create a `split-invoices/` subdirectory inside `source3-downloads/` and copy the 4-6 invoice PDFs there.

**PowerShell shortcut** (run in `C:\Users\Jake\nightwork-platform\` to copy the priority files in one go):

```powershell
$src = "C:\Users\Jake\Downloads"
$dst = "C:\Users\Jake\nightwork-platform\.planning\fixtures\drummond\source3-downloads"
$files = @(
  "Drummond - Pay App 1 - March-July 2025.xls",
  "Drummond - Pay App 2 - August 2025.xls",
  "Drummond - Pay App 3 - September 2025 REVISED.xls",
  "Drummond - Pay App 4 - October 2025.xlsx",
  "Pay Application #5 - Drummond-501 74th St.pdf",
  "Draw_5_Drummond-501_74th_St_G702_G703.pdf",
  "Drummond_Budget_2026-04-15.xlsx",
  "Drummond_Schedule.xlsx",
  "Schedule_List_Drummond-501 74th St.xlsx",
  "Schedule_Gantt_Drummond-501 74th St (12).pdf",
  "Drummond-Nov 2025 Lein Releases (2).pdf",
  "Drummond November 2025 Corresponding Invoices.pdf",
  "Ross Built - Construction Agreement - Drummond.docx"
)
foreach ($f in $files) { Copy-Item -Path "$src\$f" -Destination "$dst\$f" -Force }

# split-invoices subset
New-Item -ItemType Directory -Force -Path "$dst\split-invoices" | Out-Null
$invs = @("SmartShield-105472-2845.84.pdf","Ferguson-6713881-1461.05.pdf","Loftin-26125163-19899.00.pdf","IslandLumber-525830-60.09.pdf","ParadiseFoam-5977-17921.56.pdf","FPL-Electric-58.13.pdf")
foreach ($i in $invs) { Copy-Item -Path "$src\split-invoices\$i" -Destination "$dst\split-invoices\$i" -Force }
```

**Validation (will run automatically when you re-invoke):**
- File count check: ≥12 files in `source3-downloads/` (the priority list above).
- Each priority file's existence is verified by name.
- If any priority file is missing, validation reports which one and stops.

**Privacy posture:**
- These files stay gitignored (`.gitignore` rule `/.planning/*` blocks them).
- They never sync to git or to other PCs.
- The extraction script reads them locally; the COMMITTED output goes to `src/app/design-system/_fixtures/drummond/` (sanitized only).

---

## Item M2: Review and lock SUBSTITUTION-MAP.md

**Why:** D-029 substitution-map workflow requires Jake-locked real → fictional name mappings before any sanitized fixture commits. Auto-setup wrote a TEMPLATE with proposed substitutions; you decide which to keep, which to amend, and which national vendors stay AS-IS.

**Time estimate:** 10-15 minutes.

**Steps:**

1. Open `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` in your editor.
2. For each row marked `?? PROPOSED`:
   - Accept the proposed substitution (delete the `?? PROPOSED` marker), OR
   - Replace with your own substitution (delete the marker), OR
   - Mark `NO-SUB` if you've decided the real name can stay (e.g., national chains — Ferguson, Home Depot, FPL).
3. Pay particular attention to:
   - **Owner surname** (currently proposed "Halcyon" — your call)
   - **Site address** (currently proposed "501 Pelican Bay Way, Anna Maria FL")
   - **Vendor decisions** (which 17 get fictional vs NO-SUB)
   - **Job code** (currently proposed "GC0501")
4. Save the file. Status will remain "TEMPLATE" but with all `?? PROPOSED` markers removed, indicating "ready for extraction".

**Validation (will run automatically when you re-invoke):**
- `grep "?? PROPOSED" .planning/fixtures/drummond/SUBSTITUTION-MAP.md` returns 0 matches.
- File still exists at the gitignored path.
- Validation will NOT inspect your specific choices — only that all proposed markers are resolved.

---

## Item M3: Confirm mobile test device for Q5=B real-phone gate

**Status (post-nwrp27): PENDING JAKE CHAT REPLY** — Jake's autonomy directive nwrp27 contained literal `[PHONE]` placeholder ("Phone: [PHONE]") that was not substituted with actual device info. SETUP-COMPLETE.md proceeds with M3 deferred to ship-time gate per the original "not setup-blocking" contract (AUTO-LOG.md MANUAL items table).

**Why:** EXPANDED-SCOPE Q5=B locks "Jake walks every prototype on his actual phone before ship verdict, including PM-in-field one-hand + gloves-on + outdoor lighting." Preflight at ship time needs to know which device + browser combo so the test acceptance line in PLAN.md is concrete.

**Time estimate:** 30 seconds.

**Steps:**

1. Tell me (in chat) the exact phone make/model + primary browser:
   - Example: "iPhone 15, Safari 17"
   - Example: "Pixel 8, Chrome 121"
2. I'll edit this section to "LOCKED" + edit EXPANDED-SCOPE.md §0 to substitute the PENDING marker.

**Validation:**
- Not setup-blocking — recorded as a preflight note, not a hard gate at setup time (per AUTO-LOG.md MANUAL items table).
- The actual real-phone test is a ship gate (Q9=B halt criterion), executed during final QA.
- SETUP-COMPLETE.md flags M3 as "deferred ship-time" so `/np` can proceed; the phone info MUST be locked before `/nx` execute completes (so the QA spec-checker can validate against a concrete device).

---

## After all items complete

Run: `/nightwork-auto-setup stage-1.5b-prototype-gallery`

The command will:
1. Verify file count in `source3-downloads/` (M1).
2. Grep SUBSTITUTION-MAP.md for unresolved `?? PROPOSED` markers (M2).
3. Record M3 confirmation.
4. On 100% pass: write `stage-1.5b-prototype-gallery-SETUP-COMPLETE.md` and clear you to run `/np stage-1.5b-prototype-gallery`.
5. On any fail: update this checklist with what specifically failed.

## Items NOT in this checklist

Things you might wonder about that are NOT manual setup work:

- **Schedule prototype implementation tech (D-19/Gantt library vs custom)** — planning decision for `/np`'s discuss-phase step. AUTO-LOG.md §"Items deferred to /gsd-discuss-phase" lists D2.
- **G702 print stylesheet approach** — planning decision (AUTO-LOG D3).
- **PDF parsing dep (`pdf-parse` install)** — planning decision (AUTO-LOG D1). Likely not needed for 1.5b; small N can be hand-transcribed.
- **Vercel preview URL test** — auto-validates on every push to a feature branch (`vercel.json` `github.autoAlias: true`); no setup action needed.
- **Sentry / observability for prototypes** — N/A; prototypes are read-only HTML.
- **DB migrations** — N/A; 1.5b is throwaway HTML, no DB writes.
- **Env vars** — N/A; no new env vars required.
- **Supabase RLS policies** — N/A; prototypes never query tenant tables (hook T10c enforces).
