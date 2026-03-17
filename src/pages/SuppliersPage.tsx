import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";

export default function SuppliersPage() {
  const { orgId, role } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", tax_id: "", address: "", city: "", iban: "", bic: "" });
  const canManage = role === "company_admin" || role === "finance_manager";

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suppliers").insert({ org_id: orgId!, ...form, tax_id: form.tax_id || null, email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, iban: form.iban || null, bic: form.bic || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", tax_id: "", address: "", city: "", iban: "", bic: "" });
      toast({ title: "Supplier created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = suppliers.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Manage your supplier directory</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>BIC</Label><Input value={form.bic} onChange={(e) => setForm({ ...form, bic: e.target.value })} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Add supplier"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading...</div> : filtered.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No suppliers found.</div> : (
            <table className="w-full">
              <thead><tr className="border-b text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">City</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Tax ID</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.email || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.city || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.tax_id || "—"}</td>
                    <td className="px-4 py-3"><Badge variant={s.is_active ? "default" : "secondary"} className="text-xs">{s.is_active ? "Active" : "Inactive"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
