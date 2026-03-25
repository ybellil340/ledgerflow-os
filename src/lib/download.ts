import type { Expense } from "@/types";

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return s.includes(",") || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadCsv(expenses: Expense[]): void {
  const cols = ["Date","Title","Currency","Amount","Base EUR","FX Rate","Category","Status","Description","VAT Amount","VAT Rate","TRN"];
  const rows = expenses.map(function(e) {
    const cat = e.expense_categories ? e.expense_categories.name : "";
    return [
      e.expense_date, e.title, e.currency, e.amount,
      e.base_amount ?? "", e.fx_rate ?? 1, cat, e.status,
      e.description ?? "", e.vat_amount ?? 0, e.vat_rate ?? 0,
      e.tax_registration_number ?? "",
    ].map(esc).join(",");
  });
  const csv = [cols.join(",")].concat(rows).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "expenses-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
}

export function downloadPdf(expenses: Expense[]): void {
  const th = function(s: string) {
    return "<th style=\"padding:6px 8px;background:#1e3a5f;color:#fff;text-align:left\">" + s + "</th>";
  };
  const td = function(s: string) {
    return "<td style=\"padding:5px 8px;border-bottom:1px solid #eee\">" + s + "</td>";
  };
  const hdr = "<tr>" + ["Date","Title","CCY","Amount","EUR","Category","Status","VAT"].map(th).join("") + "</tr>";
  const bdy = expenses.map(function(e) {
    const cat = e.expense_categories ? e.expense_categories.name : "";
    return "<tr>" + [
      e.expense_date ?? "", e.title ?? "", e.currency ?? "",
      Number(e.amount).toFixed(2),
      e.base_amount ? Number(e.base_amount).toFixed(2) : "",
      cat, e.status ?? "", String(e.vat_amount ?? 0),
    ].map(td).join("") + "</tr>";
  }).join("");
  const css = "<style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}h2{font-size:14px}table{width:100%;border-collapse:collapse}</style>";
  const html = "<html><head>" + css + "</head><body><h2>Expenses Report " + new Date().toLocaleDateString() + "</h2><p>Total: " + expenses.length + "</p><table><thead>" + hdr + "</thead><tbody>" + bdy + "</tbody></table></body></html>";
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}
