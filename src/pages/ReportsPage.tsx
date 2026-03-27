import { useMemo, useState } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { DownloadMenu } from "@/components/expenses/DownloadMenu";
import { DataPageHeader } from "@/components/DataPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtEur } from "@/lib/formatters";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ReportsPage() {
  const { expenses, isLoading } = useExpenses();
  const [year, setYear] = useState(new Date().getFullYear());

  const years = useMemo(() => {
    const ys = new Set(expenses.map(e => new Date(e.expense_date).getFullYear()));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [expenses]);

  const yearExpenses = useMemo(() =>
    expenses.filter(e => new Date(e.expense_date).getFullYear() === year),
    [expenses, year]
  );

  const byMonth = useMemo(() => {
    const m: Record<number, number> = {};
    yearExpenses.forEach(e => {
      const mo = new Date(e.expense_date).getMonth();
      m[mo] = (m[mo] || 0) + (e.base_amount ?? e.amount);
    });
    return m;
  }, [yearExpenses]);

  const byCategory = useMemo(() => {
    const c: Record<string, number> = {};
    yearExpenses.forEach(e => {
      const cat = e.expense_categories?.name || "Uncategorized";
      c[cat] = (c[cat] || 0) + (e.base_amount ?? e.amount);
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [yearExpenses]);

  const totalEur = yearExpenses.reduce((s, e) => s + (e.base_amount ?? e.amount), 0);
  const maxMonth = Math.max(...Object.values(byMonth), 1);

  return (
    <div className="p-6">
      <DataPageHeader title="Reports" />
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <DownloadMenu expenses={yearExpenses} />
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Spend", value: fmtEur(totalEur) },
              { label: "Expenses", value: String(yearExpenses.length) },
              { label: "Avg per Month", value: fmtEur(totalEur / 12) },
              { label: "Avg per Expense", value: yearExpenses.length > 0 ? fmtEur(totalEur / yearExpenses.length) : "" },
            ].map(k => (
              <Card key={k.label}>
                <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{k.value}</div></CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">{"Monthly Spend - " + year + " (EUR)"}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-40">
                {MONTHS.map((m, i) => {
                  const val = byMonth[i] || 0;
                  const pct = maxMonth > 0 ? (val / maxMonth) * 100 : 0;
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground">{val > 0 ? fmtEur(val) : ""}</span>
                      <div className="w-full rounded-t bg-muted" style={{ height: Math.max(pct * 0.9, val > 0 ? 4 : 0) + "%" }}>
                        <div className="w-full h-full bg-primary rounded-t opacity-80" />
                      </div>
                      <span className="text-xs text-muted-foreground">{m}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{"Spend by Category - " + year}</CardTitle></CardHeader>
            <CardContent>
              {byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">{"No data for " + year}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Amount (EUR)</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">%</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Count</th>
                  </tr></thead>
                  <tbody>
                    {byCategory.map(([cat, amt]) => {
                      const pct = totalEur > 0 ? (amt / totalEur) * 100 : 0;
                      const count = yearExpenses.filter(e => (e.expense_categories?.name || "Uncategorized") === cat).length;
                      return (
                        <tr key={cat} className="border-b last:border-0">
                          <td className="py-2 font-medium">{cat}</td>
                          <td className="py-2 text-right">{fmtEur(amt)}</td>
                          <td className="py-2 text-right text-muted-foreground">{pct.toFixed(1) + "%"}</td>
                          <td className="py-2 text-right text-muted-foreground">{count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="border-t font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{fmtEur(totalEur)}</td>
                    <td className="py-2 text-right">100%</td>
                    <td className="py-2 text-right">{yearExpenses.length}</td>
                  </tr></tfoot>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
