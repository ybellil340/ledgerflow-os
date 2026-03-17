import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPageHeader, DataTable, StatusBadge } from "@/components/DataPageLayout";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Check, X, Eye } from "lucide-react";
import ExpenseDetailView from "@/components/ExpenseDetailView";

export default function ExpensesPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0], category_id: "", currency: "EUR" });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isApprover = role === "company_admin" || role === "finance_manager" || role === "approver";

  const { data: allExpenses = [], isLoading } = useQuery({
    queryKey: ["expenses", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*, expense_categories(name, code)").eq("org_id", orgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
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

  // Tab counts
  const counts = {
    all: allExpenses.length,
    submitted: allExpenses.filter((e: any) => e.status === "submitted").length,
    approved: allExpenses.filter((e: any) => e.status === "approved").length,
    rejected: allExpenses.filter((e: any) => e.status === "rejected").length,
    draft: allExpenses.filter((e: any) => e.status === "draft").length,
    reimbursed: allExpenses.filter((e: any) => e.status === "reimbursed").length,
  };

  const tabs = [
    { label: "All Expenses", value: "all", count: counts.all },
    { label: "Pending Approval", value: "submitted", count: counts.submitted },
    { label: "Approved", value: "approved", count: counts.approved },
    { label: "Rejected", value: "rejected", count: counts.rejected },
    { label: "Drafts", value: "draft", count: counts.draft },
    { label: "Reimbursed", value: "reimbursed", count: counts.reimbursed },
  ];

  const expenses = allExpenses
    .filter((e: any) => activeTab === "all" || e.status === activeTab)
    .filter((e: any) => !search || e.title.toLowerCase().includes(search.toLowerCase()));

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
        org_id: orgId!, submitter_id: user!.id, title: form.title,
        description: form.description || null, amount: parseFloat(form.amount),
        expense_date: form.expense_date, category_id: form.category_id || null,
        receipt_url, status: "submitted", submitted_at: new Date().toISOString(),
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
      const updates: any = {
        status,
        ...(status === "approved" ? { approved_at: new Date().toISOString(), approver_id: user!.id } : {}),
        ...(status === "rejected" ? { rejected_at: new Date().toISOString(), approver_id: user!.id, rejection_reason: reason } : {}),
      };
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <DataPageHeader
        title="Expenses"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, merchant..."
        onDownload={() => {}}
        actions={
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
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
        }
      />

      <div className="mt-4">
        <DataTable
          headers={["Title", "Date", "Amount", "Category", "Status", "Action"]}
          isLoading={isLoading}
          isEmpty={expenses.length === 0}
          emptyMessage="No expenses found."
          hasCheckbox
          allChecked={expenses.length > 0 && selected.size === expenses.length}
          onCheckAll={(checked) => setSelected(checked ? new Set(expenses.map((e: any) => e.id)) : new Set())}
        >
          {expenses.map((exp: any) => (
            <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="w-10 px-4 py-3">
                <input type="checkbox" checked={selected.has(exp.id)} onChange={() => toggleSelect(exp.id)} className="rounded border-border" />
              </td>
              <td className="px-4 py-3">
                <p className="text-sm font-medium">{exp.title}</p>
                {exp.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{exp.description}</p>}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(exp.expense_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" })}</td>
              <td className="px-4 py-3 text-sm font-medium">{Number(exp.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{exp.expense_categories?.name || "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={exp.status} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-0.5">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedExpense(exp); setDetailOpen(true); }}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {isApprover && exp.status === "submitted" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success hover:text-success" onClick={() => updateStatus.mutate({ id: exp.id, status: "approved" })}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => updateStatus.mutate({ id: exp.id, status: "rejected", reason: "Rejected by approver" })}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* Alaan-style Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[900px] p-0 overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Expense details</DialogTitle></DialogHeader>
          {selectedExpense && (
            <ExpenseDetailView expense={selectedExpense} onClose={() => setDetailOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
