// One-off conversion script per Jake directive nwrp37.
//
// Bypasses Excel-required manual conversion of legacy .xls (BIFF) files
// to modern .xlsx (Office Open XML) by using SheetJS programmatically.
// Reads each .xls in the Drummond raw fixtures directory, writes the
// equivalent .xlsx alongside it. Idempotent: skips when target exists.
//
// Run: `npx tsx scripts/convert-xls-to-xlsx.ts`
//
// After conversion succeeds, exceljs (the lib sanitize-drummond.ts uses)
// can read the .xlsx files where it cannot read .xls. The original .xls
// files may be left in place or deleted manually — sanitize-drummond.ts
// hard-fails on any remaining .xls, so they must be removed before
// running it.

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const SOURCE_DIR = ".planning/fixtures/drummond/source3-downloads";

const filesToConvert = [
  "Drummond - Pay App 1 - March-July 2025.xls",
  "Drummond - Pay App 2 - August 2025.xls",
  "Drummond - Pay App 3 - September 2025 REVISED.xls",
];

let converted = 0;
let skipped = 0;
let failed = 0;

for (const filename of filesToConvert) {
  const xlsPath = path.join(SOURCE_DIR, filename);
  const xlsxPath = path.join(SOURCE_DIR, filename.replace(/\.xls$/, ".xlsx"));

  if (!fs.existsSync(xlsPath)) {
    console.error(`SKIP: ${xlsPath} not found`);
    skipped += 1;
    continue;
  }

  if (fs.existsSync(xlsxPath)) {
    console.log(`SKIP: ${xlsxPath} already exists`);
    skipped += 1;
    continue;
  }

  console.log(`Converting: ${filename}`);

  try {
    const workbook = XLSX.readFile(xlsPath, {
      cellDates: true,
      cellNF: false,
      cellText: false,
    });
    XLSX.writeFile(workbook, xlsxPath, {
      bookType: "xlsx",
      cellDates: true,
    });
    console.log(`  Wrote: ${xlsxPath}`);
    converted += 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL: ${filename} → ${msg}`);
    failed += 1;
  }
}

console.log(
  `\nConversion complete. Converted=${converted}, Skipped=${skipped}, Failed=${failed}.`,
);

if (failed > 0) {
  console.error(
    `\nOne or more conversions failed. Per nwrp37 fallback order:\n` +
      `  1. Try node-xlsx package (different parser).\n` +
      `  2. Try libreoffice-convert (requires LibreOffice).\n` +
      `  3. Last resort: surface to Jake for manual Excel conversion.\n`,
  );
  process.exit(1);
}
