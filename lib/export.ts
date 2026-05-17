// lib/export.ts
// CSV & Excel generation utilities for the Report Center.
// Uses SheetJS (xlsx) for Excel — judges can open it directly.
//
// SECURITY: Both generateExcel and generateCSV neutralise formula injection.
// Cells starting with = + - @ are prefixed with a single quote so spreadsheet
// apps treat them as text, preventing macro execution.

import * as XLSX from "xlsx";

/** Prefix any cell value that starts with a spreadsheet formula trigger character. */
function safeCell(v: unknown): unknown {
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}

/**
 * Generates an Excel file from an array of objects.
 * Returns a Buffer that can be streamed as a response.
 */
export function generateExcel(rows: object[], sheetName: string): Buffer {
  if (rows.length === 0) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["No data"]]), sheetName);
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
  }

  // Sanitize every cell value before building the sheet
  const sanitizedRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([k, v]) => [k, safeCell(v)])
    )
  );

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sanitizedRows);

  // Auto-size columns for readability
  const colWidths = Object.keys(rows[0]).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length)
    ),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
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
