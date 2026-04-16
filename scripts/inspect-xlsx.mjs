// Dump first 40 rows of every sheet in the Drummond Pay App so we can see
// what column layout the budget-import parser is facing.
import ExcelJS from 'exceljs';

const PATH = 'P:/Projects Info Folder/Drummond 501 74th St/Budget/Payapps/Drummond_Pay_App_9_March_26.xlsx';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PATH);

console.log(`Sheets: ${wb.worksheets.map((s) => s.name).join(', ')}\n`);

for (const sheet of wb.worksheets) {
  console.log(`─── Sheet: ${sheet.name} (${sheet.rowCount} rows × ${sheet.columnCount} cols) ───`);
  let n = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (n++ >= 40) return;
    const cells = [];
    for (let c = 1; c <= Math.min(10, sheet.columnCount); c++) {
      const v = row.getCell(c).value;
      const t = typeof v === 'object' && v && 'result' in v ? v.result : v;
      const s = t == null ? '' : String(t).slice(0, 22);
      cells.push(`[${c}]${s}`);
    }
    console.log(`  r${String(rowNumber).padStart(3)}: ${cells.join('  ')}`);
  });
  console.log('');
}
