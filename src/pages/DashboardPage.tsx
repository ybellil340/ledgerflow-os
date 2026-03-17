import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const taxObligations = [
  { name: "USt-Voranmeldung Q1", date: "10 Apr", status: "Due", color: "destructive" as const },
  { name: "Körperschaftsteuer", date: "31 Mai", status: "Prep", color: "warning" as const },
  { name: "Gewerbesteuer", date: "15 Jun", status: "On track", color: "success" as const },
];

const StatusBadge = ({ status, color }: { status: string; color: "destructive" | "warning" | "success" }) => {
  const styles = { destructive: "bg-destructive/10 text-destructive", warning: "bg-warning/10 text-warning", success: "bg-success/10 text-success" };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded", styles[color])}>{status}</span>;
};

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function DashboardPage() {
  const { orgId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Monthly spend (expenses approved/reimbursed this month)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: monthlySpend = 0 } = useQuery({
    queryKey: ["dashboard-monthly-spend", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("amount").eq("org_id", orgId!).in("status", ["approved", "reimbursed"]).gte("expense_date", startOfMonth.split("T")[0]);
      if (error) throw error;
      return (data || []).reduce((s, e) => s + Number(e.amount), 0);
    },
    enabled: !!orgId,
  });

  // Cash position (sum of bank accounts)
  const { data: cashPosition = 0 } = useQuery({
    queryKey: ["dashboard-cash", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("balance").eq("org_id", orgId!);
      if (error) throw error;
      return (data || []).reduce((s, a) => s + Number(a.balance), 0);
    },
    enabled: !!orgId,
  });

  // Pending approvals
  const { data: pendingExpenses = [] } = useQuery({
    queryKey: ["dashboard-pending", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("id, title, amount, submitter_id, expense_date").eq("org_id", orgId!).eq("status", "submitted").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Missing receipts
  const { data: missingReceipts = 0 } = useQuery({
    queryKey: ["dashboard-missing-receipts", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("id").eq("org_id", orgId!).is("receipt_url", null).in("status", ["submitted", "approved"]);
      if (error) throw error;
      return (data || []).length;
    },
    enabled: !!orgId,
  });

  // Recent transactions
  const { data: recentTxns = [] } = useQuery({
    queryKey: ["dashboard-txns", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id, merchant_name, amount, transaction_date, status").eq("org_id", orgId!).order("transaction_date", { ascending: false }).limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Spend by category
  const { data: categorySpend = [] } = useQuery({
    queryKey: ["dashboard-category-spend", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("category_id, amount, expense_categories(name)").eq("org_id", orgId!).in("status", ["approved", "reimbursed"]);
      if (error) throw error;
      const map = new Map<string, { name: string; total: number }>();
      for (const e of data || []) {
        const name = (e as any).expense_categories?.name || "Uncategorized";
        const existing = map.get(name) || { name, total: 0 };
        existing.total += Number(e.amount);
        map.set(name, existing);
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
    },
    enabled: !!orgId,
  });

  const approveExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").update({ status: "approved", approved_at: new Date().toISOString(), approver_id: user!.id } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-monthly-spend"] });
      toast({ title: "Expense approved" });
    },
  });

  const rejectExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").update({ status: "rejected", rejected_at: new Date().toISOString(), approver_id: user!.id, rejection_reason: "Rejected from dashboard" } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
      toast({ title: "Expense rejected" });
    },
  });

  const maxCategory = categorySpend.length > 0 ? Math.max(...categorySpend.map(c => c.total)) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1.5">Total spend this month</p>
            <p className="text-2xl font-semibold">{fmt(monthlySpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1.5">Cash position</p>
            <p className="text-2xl font-semibold">{fmt(cashPosition)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Across linked accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1.5">Pending approvals</p>
            <p className={cn("text-2xl font-semibold", pendingExpenses.length > 0 && "text-warning")}>{pendingExpenses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1.5">Missing receipts</p>
            <p className={cn("text-2xl font-semibold", missingReceipts > 0 && "text-destructive")}>{missingReceipts}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {pendingExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No pending approvals</p>
            ) : pendingExpenses.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-sidebar-primary-foreground">
                    {e.title.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.expense_date).toLocaleDateString("de-DE")}</p>
                </div>
                <span className="text-sm font-semibold mr-3 whitespace-nowrap">{fmt(Number(e.amount))}</span>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 text-success border-success/30 hover:bg-success/10" onClick={() => approveExpense.mutate(e.id)}>Approve</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => rejectExpense.mutate(e.id)}>Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Spend by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            {categorySpend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense data yet</p>
            ) : (
              <div className="space-y-3">
                {categorySpend.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{c.name}</span>
                      <span className="font-medium">{fmt(c.total)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${maxCategory > 0 ? (c.total / maxCategory) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Obligations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tax obligations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {taxObligations.map((tax, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className={cn("w-2 h-2 rounded-full shrink-0", tax.color === "destructive" && "bg-destructive", tax.color === "warning" && "bg-warning", tax.color === "success" && "bg-success")} />
                <span className="text-sm flex-1">{tax.name}</span>
                <span className="text-sm text-muted-foreground mr-2">{tax.date}</span>
                <StatusBadge status={tax.status} color={tax.color} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : recentTxns.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                <span className="text-sm flex-1 font-medium">{t.merchant_name}</span>
                <span className="text-sm font-semibold">{fmt(Number(t.amount))}</span>
                <span className="text-xs text-muted-foreground ml-2">{new Date(t.transaction_date).toLocaleDateString("de-DE")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
