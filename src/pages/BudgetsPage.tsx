import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, PiggyBank, Trash2 } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function BudgetsPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const canManage = role === "company_admin" || role === "finance_manager";
  const [form, setForm] = useState({
    name: "", amount: "", period: "monthly", department_id: "", cost_center_id: "", category_id: "",
    start_date: new Date().toISOString().split("T")[0], end_date: "",
  });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*, departments(name), cost_centers(name), expense_categories(name)")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch actual spend per category for budget vs actual
  const { data: actualSpend = {} } = useQuery({
    queryKey: ["budget-actuals", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("category_id, cost_center_id, amount")
        .eq("org_id", orgId!)
        .in("status", ["approved", "reimbursed"]);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const e of data || []) {
        if (e.category_id) map[`cat_${e.category_id}`] = (map[`cat_${e.category_id}`] || 0) + Number(e.amount);
        if (e.cost_center_id) map[`cc_${e.cost_center_id}`] = (map[`cc_${e.cost_center_id}`] || 0) + Number(e.amount);
        map["total"] = (map["total"] || 0) + Number(e.amount);
      }
      return map;
    },
    enabled: !!orgId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_centers").select("id, name").eq("org_id", orgId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("id, name").eq("org_id", orgId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const createBudget = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budgets").insert({
        org_id: orgId!,
        created_by: user!.id,
        name: form.name,
        amount: parseFloat(form.amount),
        period: form.period as any,
        department_id: form.department_id || null,
        cost_center_id: form.cost_center_id || null,
        category_id: form.category_id || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setOpen(false);
      setForm({ name: "", amount: "", period: "monthly", department_id: "", cost_center_id: "", category_id: "", start_date: new Date().toISOString().split("T")[0], end_date: "" });
      toast({ title: "Budget created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast({ title: "Budget deleted" });
    },
  });

  const getActual = (b: any): number => {
    if (b.category_id) return actualSpend[`cat_${b.category_id}`] || 0;
    if (b.cost_center_id) return actualSpend[`cc_${b.cost_center_id}`] || 0;
    return 0;
  };

  const totalBudget = budgets.reduce((s: number, b: any) => s + Number(b.amount), 0);
  const totalActual = budgets.reduce((s: number, b: any) => s + getActual(b), 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Budgets</h1>
          <p className="text-muted-foreground text-sm">Set and track spending budgets</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Create budget</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create budget</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createBudget.mutate(); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Marketing Q1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Amount (€) *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
                  <div className="space-y-1.5">
                    <Label>Period</Label>
                    <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {categories.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Expense category</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                      <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {departments.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                      <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                      <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {costCenters.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Cost center</Label>
                    <Select value={form.cost_center_id} onValueChange={(v) => setForm({ ...form, cost_center_id: v })}>
                      <SelectTrigger><SelectValue placeholder="All cost centers" /></SelectTrigger>
                      <SelectContent>{costCenters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createBudget.isPending}>{createBudget.isPending ? "Creating..." : "Create budget"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total budgeted</p><p className="text-2xl font-semibold">{fmt(totalBudget)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total spent</p><p className="text-2xl font-semibold">{fmt(totalActual)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Remaining</p><p className={cn("text-2xl font-semibold", totalBudget - totalActual < 0 ? "text-destructive" : "text-success")}>{fmt(totalBudget - totalActual)}</p></CardContent></Card>
      </div>

      {/* Budget cards */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <PiggyBank className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No budgets configured yet. Create your first budget to start tracking spending.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b: any) => {
            const actual = getActual(b);
            const budgetAmt = Number(b.amount);
            const pct = budgetAmt > 0 ? Math.min((actual / budgetAmt) * 100, 100) : 0;
            const over = actual > budgetAmt;
            return (
              <Card key={b.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold">{b.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{b.period}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className={cn("text-xs", b.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                        {b.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {canManage && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteBudget.mutate(b.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {(b.departments || b.cost_centers || b.expense_categories) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {b.departments?.name && <Badge variant="outline" className="text-[10px]">{b.departments.name}</Badge>}
                      {b.cost_centers?.name && <Badge variant="outline" className="text-[10px]">{b.cost_centers.name}</Badge>}
                      {b.expense_categories?.name && <Badge variant="outline" className="text-[10px]">{b.expense_categories.name}</Badge>}
                    </div>
                  )}

                  <div className="flex justify-between text-sm mb-1.5">
                    <span className={cn("font-medium", over && "text-destructive")}>{fmt(actual)}</span>
                    <span className="text-muted-foreground">of {fmt(budgetAmt)}</span>
                  </div>
                  <Progress value={pct} className={cn("h-2", over && "[&>div]:bg-destructive")} />
                  <p className={cn("text-xs mt-1.5", over ? "text-destructive" : "text-muted-foreground")}>
                    {over ? `Over budget by ${fmt(actual - budgetAmt)}` : `${fmt(budgetAmt - actual)} remaining`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
