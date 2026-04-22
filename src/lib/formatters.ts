// Formatting utilities — used app-wide, import from here

export function fmtCurrency(amount: number, currency = "EUR", locale = "de-DE"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return currency + " " + amount.toFixed(2);
  }
}

export function fmtDate(dateStr: string, locale = "de-DE"): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      day: "2-digit", month: "short", year: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function fmtEur(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return fmtCurrency(amount, "EUR");
}

export function fmtPercent(value: number, decimals = 1): string {
  return value.toFixed(decimals) + "%";
}

export function fmtNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: decimals }).format(value);
}

// Aliases for backward-compat imports
export const formatCurrency = fmtCurrency;
