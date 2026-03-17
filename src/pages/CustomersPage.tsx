import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DataPageHeader, DataTable, StatusBadge } from "@/components/DataPageLayout";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function CustomersPage() {
  const { orgId, role } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [form, setForm] = useState({ name: "", email: "", phone: "", tax_id: "", address: "", city: "" });
  const canManage = role === "company_admin" || role === "finance_manager";

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const counts = {
    all: customers.length,
    active: customers.filter((c: any) => c.is_active).length,
    inactive: customers.filter((c: any) => !c.is_active).length,
  };

  const tabs = [
    { label: "All Customers", value: "all", count: counts.all },
    { label: "Active", value: "active", count: counts.active },
    { label: "Inactive", value: "inactive", count: counts.inactive },
  ];

  const filtered = customers
    .filter((c: any) => activeTab === "all" || (activeTab === "active" ? c.is_active : !c.is_active))
    .filter((c: any) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({ org_id: orgId!, name: form.name, email: form.email || null, phone: form.phone || null, tax_id: form.tax_id || null, address: form.address || null, city: form.city || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", tax_id: "", address: "", city: "" });
      toast({ title: "Customer created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <DataPageHeader
        title="Customers"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email..."
        onDownload={() => {}}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add customer</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
                  <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Tax ID</Label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Add customer"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="mt-4">
        <DataTable
          headers={["Name", "Email", "City", "Tax ID", "Country", "Status"]}
          isLoading={isLoading}
          isEmpty={filtered.length === 0}
          emptyMessage="No customers found."
        >
          {filtered.map((c: any) => (
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{c.email || "—"}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{c.city || "—"}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{c.tax_id || "—"}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{c.country || "DE"}</td>
              <td className="px-4 py-3"><StatusBadge status={c.is_active ? "active" : "inactive"} /></td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
