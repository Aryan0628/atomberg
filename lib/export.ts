// lib/export.ts
// CSV & Excel generation utilities for the Report Center.
// Uses exceljs (actively maintained, no known prototype-pollution/ReDoS vulns)
// instead of the abandoned xlsx@0.18.5 package.
//
// SECURITY: safeCell() neutralises formula injection — cells starting with
// = + - @ are prefixed with a single quote so spreadsheet apps treat them
// as text, preventing macro execution.

import ExcelJS from "exceljs";

/** Prefix any cell value that starts with a spreadsheet formula trigger character. */
function safeCell(v: unknown): unknown {
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}

/**
 * Generates an Excel .xlsx file from an array of objects.
 * Returns a Buffer that can be streamed as a response.
 */
export async function generateExcel(rows: object[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AtomQuest Portal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  if (rows.length === 0) {
    sheet.addRow(["No data"]);
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  const headers = Object.keys(rows[0]);

  // Header row — bold
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };

  // Auto-size columns
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(
      h.length + 2,
      ...rows.map((r) => String((r as Record<string, unknown>)[h] ?? "").length + 2)
    ),
  }));

  // Data rows
  for (const row of rows) {
    const sanitized = Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([k, v]) => [k, safeCell(v)])
    );
    sheet.addRow(sanitized);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Generates a CSV string from an array of objects.
 */
export function generateCSV(rows: object[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          let val = String(safeCell((row as Record<string, unknown>)[h]) ?? "");
          val = val.replace(/\r?\n|\r/g, " ");
          return val.includes(",") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(",")
    ),
  ];

  return csvRows.join("\n");
}
