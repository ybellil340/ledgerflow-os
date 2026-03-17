import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPageHeader, DataTable, StatusBadge } from "@/components/DataPageLayout";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function ARInvoicesPage() {
  const { orgId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ invoice_number: "", customer_id: "", amount: "", tax_amount: "0", issue_date: new Date().toISOString().split("T")[0], due_date: "" });

  const { data: allInvoices = [], isLoading } = useQuery({
    queryKey: ["ar-invoices", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ar_invoices").select("*, customers(name)").eq("org_id", orgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").eq("org_id", orgId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const counts = {
    all: allInvoices.length,
    pending: allInvoices.filter((i: any) => i.status === "pending").length,
    approved: allInvoices.filter((i: any) => i.status === "approved").length,
    paid: allInvoices.filter((i: any) => i.status === "paid").length,
    overdue: allInvoices.filter((i: any) => i.status === "overdue").length,
    draft: allInvoices.filter((i: any) => i.status === "draft").length,
  };

  const tabs = [
    { label: "All Invoices", value: "all", count: counts.all },
    { label: "Pending", value: "pending", count: counts.pending },
    { label: "Approved", value: "approved", count: counts.approved },
    { label: "Paid", value: "paid", count: counts.paid },
    { label: "Overdue", value: "overdue", count: counts.overdue },
    { label: "Draft", value: "draft", count: counts.draft },
  ];

  const invoices = allInvoices
    .filter((i: any) => activeTab === "all" || i.status === activeTab)
    .filter((i: any) => !search || i.invoice_number.toLowerCase().includes(search.toLowerCase()) || i.customers?.name?.toLowerCase().includes(search.toLowerCase()));

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ar_invoices").insert({
        org_id: orgId!, created_by: user!.id, invoice_number: form.invoice_number,
        customer_id: form.customer_id || null, amount: parseFloat(form.amount),
        tax_amount: parseFloat(form.tax_amount || "0"), issue_date: form.issue_date,
        due_date: form.due_date || null, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ar-invoices"] });
      setOpen(false);
      setForm({ invoice_number: "", customer_id: "", amount: "", tax_amount: "0", issue_date: new Date().toISOString().split("T")[0], due_date: "" });
      toast({ title: "Invoice created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <DataPageHeader
        title="AR Invoices"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by invoice #, customer..."
        onDownload={() => {}}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New invoice</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create AR Invoice</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Invoice # *</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required /></div>
                {customers.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Amount (€) *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
                  <div className="space-y-1.5"><Label>Tax (€)</Label><Input type="number" step="0.01" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create invoice"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-4">
        <DataTable
          headers={["Invoice #", "Customer", "Amount", "Issue Date", "Due Date", "Status"]}
          isLoading={isLoading}
          isEmpty={invoices.length === 0}
          emptyMessage="No invoices found."
          hasCheckbox
          allChecked={invoices.length > 0 && selected.size === invoices.length}
          onCheckAll={(checked) => setSelected(checked ? new Set(invoices.map((i: any) => i.id)) : new Set())}
        >
          {invoices.map((inv: any) => (
            <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="w-10 px-4 py-3"><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="rounded border-border" /></td>
              <td className="px-4 py-3 text-sm font-medium">{inv.invoice_number}</td>
              <td className="px-4 py-3 text-sm">{inv.customers?.name || "—"}</td>
              <td className="px-4 py-3 text-sm font-medium">{Number(inv.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(inv.issue_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" })}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
