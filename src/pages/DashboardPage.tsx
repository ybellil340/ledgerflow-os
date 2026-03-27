import { useMemo } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { DataPageHeader } from "@/components/DataPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtEur, fmtCurrency } from "@/lib/formatters";
import { TrendingUp, TrendingDown, Receipt, Clock } from "lucide-react";

export default function DashboardPage() {
  const { expenses, isLoading } = useExpenses();

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastMonth = expenses.filter(e => {
      const d = new Date(e.expense_date);
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    });
    const total = (arr: typeof expenses) => arr.reduce((s, e) => s + (e.base_amount ?? e.amount), 0);
    const thisTotal = total(thisMonth);
    const lastTotal = total(lastMonth);
    const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;
    const pending = expenses.filter(e => e.status === "submitted").length;
    const approved = expenses.filter(e => e.status === "approved").length;
    const byCategory: Record<string, number> = {};
    thisMonth.forEach(e => {
      const cat = e.expense_categories?.name || "Uncategorized";
      byCategory[cat] = (byCategory[cat] || 0) + (e.base_amount ?? e.amount);
    });
    const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { thisTotal, lastTotal, change, pending, approved, topCategories };
  }, [expenses]);

  const cards = [
    { title: "This Month (EUR)", value: fmtEur(kpis.thisTotal), sub: (kpis.change >= 0 ? "+" : "") + kpis.change.toFixed(1) + "% vs last month", icon: kpis.change >= 0 ? TrendingUp : TrendingDown, color: kpis.change >= 0 ? "text-red-500" : "text-green-500" },
    { title: "Last Month (EUR)", value: fmtEur(kpis.lastTotal), sub: "Previous period", icon: Receipt, color: "text-blue-500" },
    { title: "Pending Approval", value: String(kpis.pending), sub: "Awaiting review", icon: Clock, color: "text-orange-500" },
    { title: "Approved", value: String(kpis.approved), sub: "All time", icon: TrendingUp, color: "text-green-500" },
  ];

  return (
    <div className="p-6">
      <DataPageHeader title="Dashboard" />
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(c => (
              <Card key={c.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                  <c.icon className={"h-4 w-4 " + c.color} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Top Categories - This Month</CardTitle></CardHeader>
            <CardContent>
              {kpis.topCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses this month</p>
              ) : (
                <div className="space-y-3">
                  {kpis.topCategories.map(([cat, amt]) => {
                    const pct = kpis.thisTotal > 0 ? (amt / kpis.thisTotal) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{cat}</span>
                          <span className="text-muted-foreground">{fmtEur(amt)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: pct + "%" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Expenses</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Title","Date","Amount","Category","Status"].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 10).map(e => (
                    <tr key={e.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{e.title}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.expense_date}</td>
                      <td className="px-4 py-2">{fmtCurrency(e.amount, e.currency)}</td>
                      <td className="px-4 py-2">{e.expense_categories?.name || ""}</td>
                      <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-muted">{e.status}</span></td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No expenses yet</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
