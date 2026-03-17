import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Check, X, Eye } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  reimbursed: "bg-primary/10 text-primary",
};

export default function ExpensesPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState({ title: "", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0], category_id: "" });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const isApprover = role === "company_admin" || role === "finance_manager" || role === "approver";

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", orgId, statusFilter],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*").eq("org_id", orgId!).order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").eq("org_id", orgId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      let receipt_url: string | null = null;
      if (receiptFile && user) {
        const path = `${user.id}/${Date.now()}_${receiptFile.name}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, receiptFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
        receipt_url = urlData.publicUrl;
      }
      const { error } = await supabase.from("expenses").insert({
        org_id: orgId!,
        submitter_id: user!.id,
        title: form.title,
        description: form.description || null,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        category_id: form.category_id || null,
        receipt_url,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
      setForm({ title: "", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0], category_id: "" });
      setReceiptFile(null);
      toast({ title: "Expense submitted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updates: any = { status, ...(status === "approved" ? { approved_at: new Date().toISOString(), approver_id: user!.id } : {}), ...(status === "rejected" ? { rejected_at: new Date().toISOString(), approver_id: user!.id, rejection_reason: reason } : {}) };
      const { error } = await supabase.from("expenses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setDetailOpen(false);
      toast({ title: "Expense updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stats = {
    total: expenses.length,
    pending: expenses.filter((e: any) => e.status === "submitted").length,
    approved: expenses.filter((e: any) => e.status === "approved").length,
    totalAmount: expenses.reduce((s: number, e: any) => s + Number(e.amount), 0),
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Submit and track expense reports</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit expense</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (€) *</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required />
                </div>
              </div>
              {categories.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                  {receiptFile && <Upload className="h-4 w-4 text-success" />}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Submitting..." : "Submit expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-semibold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-semibold text-warning">{stats.pending}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Approved</p><p className="text-2xl font-semibold text-success">{stats.approved}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total amount</p><p className="text-2xl font-semibold">{stats.totalAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["all", "draft", "submitted", "approved", "rejected", "reimbursed"].map((s) => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize text-xs">
            {s === "all" ? "All" : s}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No expenses found.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp: any) => (
                  <tr key={exp.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{exp.title}</td>
                    <td className="px-4 py-3 text-sm">{Number(exp.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(exp.expense_date).toLocaleDateString("de-DE")}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={`text-xs capitalize ${statusColors[exp.status] || ""}`}>{exp.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedExpense(exp); setDetailOpen(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {isApprover && exp.status === "submitted" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success" onClick={() => updateStatus.mutate({ id: exp.id, status: "approved" })}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => updateStatus.mutate({ id: exp.id, status: "rejected", reason: "Rejected by approver" })}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Expense details</DialogTitle></DialogHeader>
          {selectedExpense && (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Title</span><span className="text-sm font-medium">{selectedExpense.title}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Amount</span><span className="text-sm font-medium">{Number(selectedExpense.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Date</span><span className="text-sm">{new Date(selectedExpense.expense_date).toLocaleDateString("de-DE")}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Status</span><Badge variant="secondary" className={`text-xs capitalize ${statusColors[selectedExpense.status]}`}>{selectedExpense.status}</Badge></div>
              {selectedExpense.description && <div><span className="text-sm text-muted-foreground">Description</span><p className="text-sm mt-1">{selectedExpense.description}</p></div>}
              {selectedExpense.rejection_reason && <div><span className="text-sm text-muted-foreground">Rejection reason</span><p className="text-sm mt-1 text-destructive">{selectedExpense.rejection_reason}</p></div>}
              {selectedExpense.receipt_url && (
                <div>
                  <a href={selectedExpense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">View receipt</a>
                </div>
              )}
              {isApprover && selectedExpense.status === "submitted" && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" variant="outline" onClick={() => updateStatus.mutate({ id: selectedExpense.id, status: "approved" })}>
                    <Check className="h-4 w-4 mr-1.5" />Approve
                  </Button>
                  <Button className="flex-1" variant="outline" onClick={() => updateStatus.mutate({ id: selectedExpense.id, status: "rejected", reason: "Rejected" })}>
                    <X className="h-4 w-4 mr-1.5" />Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
