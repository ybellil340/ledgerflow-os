// supabase/functions/_shared/datevExport.ts
// Server-side DATEV Buchungsstapel CSV generation.
// Ported from src/lib/datevExport.ts for backend-controlled export.
// Production-ready: deterministic ordering, explicit mapping, validation.

export interface DatevBooking {
  amount: number;
  isCredit: boolean;
  account: string;
  contraAccount: string;
  date: string;       // DDMM
  documentNumber: string;
  description: string;
  taxKey?: string;
  currency?: string;
}

export interface DatevExportOptions {
  consultantNumber: string;
  clientNumber: string;
  fiscalYearStart: string;
  dateFrom: string;   // YYYYMMDD
  dateTo: string;     // YYYYMMTD
  bookings: DatevBooking[];
}

export interface MappingValidationError {
  sourceTable: string;
  sourceId: string;
  field: string;
  message: string;
}

function formatDateDDMM(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}${month}`;
}

function formatAmount(amount: number): string {
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

function generateHeader(opts: DatevExportOptions): string {
  const fields = [
    '"EXTF"', "700", "21", '"Buchungsstapel"', "12",
    `"${new Date().toISOString().slice(0, 10).replace(/-/g, "")}"`,
    "", "", "", "",
    `"${opts.consultantNumber}"`, `"${opts.clientNumber}"`,
    `"${opts.fiscalYearStart}0101"`, "4",
    `"${opts.dateFrom}"`, `"${opts.dateTo}"`,
    '""', '""', "0", "0", "0", '""',
  ];
  return fields.join(";");
}

function generateColumnHeaders(): string {
  const headers = [
    "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen",
    "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz",
    "Konto", "Gegenkonto (ohne BU-Schluessel)", "BU-Schluessel",
    "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto",
    "Buchungstext", "Postensperre", "Diverse Adressnummer",
    "Geschaeftspartnerbank", "Sachverhalt", "Zinssperre", "Beleglink",
  ];
  return headers.map((h) => `"${h}"`).join(";");
}

function generateBookingRow(b: DatevBooking): string {
  const fields = [
    formatAmount(b.amount), b.isCredit ? '"H"' : '"S"',
    `"${b.currency || "EUR"}"`, "", "", "",
    escapeField(b.account), escapeField(b.contraAccount),
    escapeField(b.taxKey || ""), b.date,
    escapeField(truncate(b.documentNumber, 36)), "", "",
    escapeField(truncate(b.description, 60)),
    "", "", "", "", "", "",
  ];
  return fields.join(";");
}

export function generateDatevCSV(opts: DatevExportOptions): string {
  const lines: string[] = [];
  lines.push(generateHeader(opts));
  lines.push(generateColumnHeaders());
  for (const b of opts.bookings) {
    lines.push(generateBookingRow(b));
  }
  return lines.join("\r\n") + "\r\n";
}

// ── Source record → DatevBooking mappers (deterministic ordering) ────────────

export function expensesToDatevBookings(
  expenses: Record<string, unknown>[],
  defaultExpenseAccount = "6300",
  defaultContraAccount = "1200",
): { bookings: DatevBooking[]; errors: MappingValidationError[] } {
  const bookings: DatevBooking[] = [];
  const errors: MappingValidationError[] = [];

  const sorted = [...expenses].sort((a, b) =>
    String(a["expense_date"] ?? "").localeCompare(String(b["expense_date"] ?? ""))
    || String(a["id"] ?? "").localeCompare(String(b["id"] ?? ""))
  );

  for (const e of sorted) {
    const amt = Number(e["amount"]);
    if (!amt || isNaN(amt)) {
      errors.push({ sourceTable: "expenses", sourceId: String(e["id"]), field: "amount", message: "Missing or invalid amount" });
      continue;
    }
    bookings.push({
      amount: amt,
      isCredit: false,
      account: defaultExpenseAccount,
      contraAccount: defaultContraAccount,
      date: formatDateDDMM(String(e["expense_date"])),
      documentNumber: String(e["id"] ?? "").substring(0, 8),
      description: truncate(String(e["title"] ?? "Ausgabe"), 60),
      currency: String(e["currency"] ?? "EUR"),
    });
  }
  return { bookings, errors };
}

export function apInvoicesToDatevBookings(
  invoices: Record<string, unknown>[],
  defaultExpenseAccount = "6300",
  creditorAccount = "1600",
): { bookings: DatevBooking[]; errors: MappingValidationError[] } {
  const bookings: DatevBooking[] = [];
  const errors: MappingValidationError[] = [];

  const sorted = [...invoices].sort((a, b) =>
    String(a["issue_date"] ?? "").localeCompare(String(b["issue_date"] ?? ""))
    || String(a["id"] ?? "").localeCompare(String(b["id"] ?? ""))
  );

  for (const inv of sorted) {
    const amt = Number(inv["amount"]);
    if (!amt || isNaN(amt)) {
      errors.push({ sourceTable: "ap_invoices", sourceId: String(inv["id"]), field: "amount", message: "Missing or invalid amount" });
      continue;
    }
    bookings.push({
      amount: amt,
      isCredit: false,
      account: defaultExpenseAccount,
      contraAccount: creditorAccount,
      date: formatDateDDMM(String(inv["issue_date"])),
      documentNumber: String(inv["invoice_number"] ?? ""),
      description: truncate(`ER ${inv["invoice_number"] ?? ""}`, 60),
      currency: String(inv["currency"] ?? "EUR"),
    });
  }
  return { bookings, errors };
}

export function arInvoicesToDatevBookings(
  invoices: Record<string, unknown>[],
  revenueAccount = "4400",
  debtorAccount = "1400",
): { bookings: DatevBooking[]; errors: MappingValidationError[] } {
  const bookings: DatevBooking[] = [];
  const errors: MappingValidationError[] = [];

  const sorted = [...invoices].sort((a, b) =>
    String(a["issue_date"] ?? "").localeCompare(String(b["issue_date"] ?? ""))
    || String(a["id"] ?? "").localeCompare(String(b["id"] ?? ""))
  );

  for (const inv of sorted) {
    const amt = Number(inv["amount"]);
    if (!amt || isNaN(amt)) {
      errors.push({ sourceTable: "ar_invoices", sourceId: String(inv["id"]), field: "amount", message: "Missing or invalid amount" });
      continue;
    }
    bookings.push({
      amount: amt,
      isCredit: true,
      account: revenueAccount,
      contraAccount: debtorAccount,
      date: formatDateDDMM(String(inv["issue_date"])),
      documentNumber: String(inv["invoice_number"] ?? ""),
      description: truncate(`AR ${inv["invoice_number"] ?? ""}`, 60),
      currency: String(inv["currency"] ?? "EUR"),
    });
  }
  return { bookings, errors };
}

// ── Source hash for stale-export detection ───────────────────────────────────
export function computeSourceHash(record: Record<string, unknown>): string {
  const keys = Object.keys(record).sort();
  const normalized = keys.map(k => `${k}:${JSON.stringify(record[k])}`).join("|");
  // Simple FNV-1a 32-bit hash — fast, deterministic, no crypto import needed
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
