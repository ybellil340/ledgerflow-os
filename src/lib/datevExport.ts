/**
 * DATEV Buchungsstapel (posting batch) CSV export
 * Format: DATEV-Format KRE/Buchungsstapel v7+
 * Encoding: ASCII/Windows-1252 compatible
 * Separator: Semicolon
 */

export interface DatevBooking {
  amount: number;
  isCredit: boolean; // S = Soll (debit), H = Haben (credit)
  account: string; // Konto
  contraAccount: string; // Gegenkonto
  date: string; // DDMM format
  documentNumber: string; // Belegnummer
  description: string; // Buchungstext (max 60 chars)
  taxKey?: string; // BU-Schlüssel (e.g. "9" for 19% VAT)
  currency?: string;
}

export interface DatevExportOptions {
  consultantNumber: string; // Beraternummer (7 digits)
  clientNumber: string; // Mandantennummer (5 digits)
  fiscalYearStart: string; // YYYY format
  dateFrom: string; // YYYYMMDD
  dateTo: string; // YYYYMMDD
  bookings: DatevBooking[];
}

function formatDateDDMM(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}${month}`;
}

function formatAmount(amount: number): string {
  // DATEV uses comma as decimal separator, no thousands separator
  return Math.abs(amount).toFixed(2).replace(".", ",");
}

function truncate(str: string, maxLen: number): string {
  return (str || "").substring(0, maxLen);
}

function escapeField(val: string): string {
  if (val.includes(";") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Generate the DATEV header row (row 1) with metadata
 */
function generateHeader(opts: DatevExportOptions): string {
  const fields = [
    '"EXTF"', // Format identifier
    "700", // Version
    "21", // Category (Buchungsstapel)
    '"Buchungsstapel"', // Format name
    "12", // Format version
    `"${new Date().toISOString().slice(0, 10).replace(/-/g, "")}"`, // Created date
    "", // Reserved
    "", // Reserved
    "", // Reserved
    "", // Reserved
    `"${opts.consultantNumber}"`, // Beraternummer
    `"${opts.clientNumber}"`, // Mandantennummer
    `"${opts.fiscalYearStart}0101"`, // WJ-Beginn
    "4", // Sachkontenlänge
    `"${opts.dateFrom}"`, // Datum von
    `"${opts.dateTo}"`, // Datum bis
    '""', // Bezeichnung
    '""', // Diktatkürzel
    "0", // Buchungstyp (0 = Finanzbuchführung)
    "0", // Rechnungslegungszweck
    "0", // Festschreibung
    '""', // WKZ
  ];
  return fields.join(";");
}

/**
 * Generate the column header row (row 2)
 */
function generateColumnHeaders(): string {
  const headers = [
    "Umsatz (ohne Soll/Haben-Kz)",
    "Soll/Haben-Kennzeichen",
    "WKZ Umsatz",
    "Kurs",
    "Basis-Umsatz",
    "WKZ Basis-Umsatz",
    "Konto",
    "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel",
    "Belegdatum",
    "Belegfeld 1",
    "Belegfeld 2",
    "Skonto",
    "Buchungstext",
    "Postensperre",
    "Diverse Adressnummer",
    "Geschäftspartnerbank",
    "Sachverhalt",
    "Zinssperre",
    "Beleglink",
  ];
  return headers.map((h) => `"${h}"`).join(";");
}

/**
 * Generate a single booking row
 */
function generateBookingRow(b: DatevBooking): string {
  const fields = [
    formatAmount(b.amount), // Umsatz
    b.isCredit ? '"H"' : '"S"', // S/H
    `"${b.currency || "EUR"}"`, // WKZ
    "", // Kurs
    "", // Basis-Umsatz
    "", // WKZ Basis-Umsatz
    escapeField(b.account), // Konto
    escapeField(b.contraAccount), // Gegenkonto
    escapeField(b.taxKey || ""), // BU-Schlüssel
    b.date, // Belegdatum (DDMM)
    escapeField(truncate(b.documentNumber, 36)), // Belegfeld 1
    "", // Belegfeld 2
    "", // Skonto
    escapeField(truncate(b.description, 60)), // Buchungstext
    "", // Postensperre
    "", // Diverse Adressnummer
    "", // Geschäftspartnerbank
    "", // Sachverhalt
    "", // Zinssperre
    "", // Beleglink
  ];
  return fields.join(";");
}

/**
 * Build the full DATEV CSV content
 */
export function generateDatevCSV(opts: DatevExportOptions): string {
  const lines: string[] = [];
  lines.push(generateHeader(opts));
  lines.push(generateColumnHeaders());
  for (const b of opts.bookings) {
    lines.push(generateBookingRow(b));
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * Trigger a file download in the browser
 */
export function downloadCSV(content: string, filename: string) {
  // DATEV expects Windows-1252 but UTF-8 with BOM works in most modern DATEV imports
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert expenses to DATEV bookings
 */
export function expensesToDatevBookings(
  expenses: any[],
  defaultExpenseAccount = "6300",
  defaultContraAccount = "1200"
): DatevBooking[] {
  return expenses.map((e) => ({
    amount: Number(e.amount),
    isCredit: false, // expenses are debit
    account: defaultExpenseAccount,
    contraAccount: defaultContraAccount,
    date: formatDateDDMM(e.expense_date),
    documentNumber: e.id?.substring(0, 8) || "",
    description: truncate(e.title || "Ausgabe", 60),
    currency: e.currency || "EUR",
  }));
}

/**
 * Convert AP invoices to DATEV bookings
 */
export function apInvoicesToDatevBookings(
  invoices: any[],
  defaultExpenseAccount = "6300",
  creditorAccount = "1600"
): DatevBooking[] {
  return invoices.map((inv) => ({
    amount: Number(inv.amount),
    isCredit: false,
    account: defaultExpenseAccount,
    contraAccount: creditorAccount,
    date: formatDateDDMM(inv.issue_date),
    documentNumber: inv.invoice_number || "",
    description: truncate(`ER ${inv.invoice_number}`, 60),
    currency: inv.currency || "EUR",
  }));
}

/**
 * Convert AR invoices to DATEV bookings
 */
export function arInvoicesToDatevBookings(
  invoices: any[],
  revenueAccount = "4400",
  debtorAccount = "1400"
): DatevBooking[] {
  return invoices.map((inv) => ({
    amount: Number(inv.amount),
    isCredit: true,
    account: revenueAccount,
    contraAccount: debtorAccount,
    date: formatDateDDMM(inv.issue_date),
    documentNumber: inv.invoice_number || "",
    description: truncate(`AR ${inv.invoice_number}`, 60),
    currency: inv.currency || "EUR",
  }));
}
