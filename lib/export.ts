// lib/export.ts
// CSV & Excel generation utilities for the Report Center.
// Uses SheetJS (xlsx) for Excel — judges can open it directly.

import * as XLSX from "xlsx";

/**
 * Generates an Excel file from an array of objects.
 * Returns a Buffer that can be streamed as a response.
 */
export function generateExcel(rows: object[], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns for better readability
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length)
    ),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  );
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
          let val = String((row as Record<string, unknown>)[h] ?? "");
          // Neutralise formula injection (=, +, -, @)
          if (/^[=+\-@]/.test(val)) val = `'${val}`;
          // Strip newlines to prevent row-breaking
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
