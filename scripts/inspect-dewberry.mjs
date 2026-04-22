import ExcelJS from 'exceljs';

const PATH = 'C:/Users/Jake/nightwork-platform/test-invoices/Dewberry-681_KRD-Pay_App_9_Jan-Feb_26.xlsx';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PATH);

console.log(`Sheets: ${wb.worksheets.map((s) => s.name).join(', ')}\n`);

for (const sheet of wb.worksheets) {
  console.log(`─── Sheet: ${sheet.name} (${sheet.rowCount} rows × ${sheet.columnCount} cols) ───`);
  let n = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rn) => {
    if (n++ >= 50) return;
    const cells = [];
    for (let c = 1; c <= Math.min(10, sheet.columnCount); c++) {
      const v = row.getCell(c).value;
      const t = typeof v === 'object' && v && 'result' in v ? v.result : v;
      const s = t == null ? '' : String(t).slice(0, 24);
      cells.push(`[${c}]${s}`);
    }
    console.log(`  r${String(rn).padStart(3)}: ${cells.join('  ')}`);
  });
  console.log('');
}
