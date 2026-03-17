import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPageHeader, DataTable, StatusBadge } from "@/components/DataPageLayout";
import { CardDetailPanel } from "@/components/CardDetailPanel";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard } from "lucide-react";

export default function CardsPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const isAdmin = role === "company_admin";

  const [form, setForm] = useState({
    card_name: "", holder_id: "", wallet_id: "", spending_limit: "5000",
    spend_period: "monthly" as "daily" | "monthly", card_type: "virtual",
    allowed_category_ids: [] as string[],
  });

  const { data: allCards = [], isLoading } = useQuery({
    queryKey: ["cards", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*, wallets(name)").eq("org_id", orgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org_members_profiles", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_members").select("user_id, role, profiles(first_name, last_name)").eq("org_id", orgId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("*").eq("org_id", orgId!).order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").eq("org_id", orgId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*, cards(card_name, last_four)").eq("org_id", orgId!).order("transaction_date", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const counts = {
    all: allCards.length,
    active: allCards.filter((c: any) => c.status === "active").length,
    frozen: allCards.filter((c: any) => c.status === "frozen").length,
    cancelled: allCards.filter((c: any) => c.status === "cancelled").length,
  };

  const tabs = [
    { label: "All Cards", value: "all", count: counts.all },
    { label: "Active", value: "active", count: counts.active },
    { label: "Frozen", value: "frozen", count: counts.frozen },
    { label: "Cancelled", value: "cancelled", count: counts.cancelled },
  ];

  const cards = allCards
    .filter((c: any) => activeTab === "all" || c.status === activeTab)
    .filter((c: any) => !search || c.card_name.toLowerCase().includes(search.toLowerCase()));

  const getMemberName = (userId: string) => {
    const m = members.find((m: any) => m.user_id === userId);
    if (!m) return "Unknown";
    const p = m.profiles as any;
    return p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unnamed" : "Unnamed";
  };

  const toggleCategory = (catId: string) => {
    setForm((prev) => ({
      ...prev,
      allowed_category_ids: prev.allowed_category_ids.includes(catId)
        ? prev.allowed_category_ids.filter((id) => id !== catId)
        : [...prev.allowed_category_ids, catId],
    }));
  };

  const createCard = useMutation({
    mutationFn: async () => {
      const lastFour = String(Math.floor(1000 + Math.random() * 9000));
      const { error } = await supabase.from("cards").insert({
        org_id: orgId!, holder_id: form.holder_id || user!.id, card_name: form.card_name,
        last_four: lastFour, card_type: form.card_type,
        spending_limit: parseFloat(form.spending_limit),
        wallet_id: form.wallet_id || null, spend_period: form.spend_period,
        allowed_category_ids: form.allowed_category_ids.length > 0 ? form.allowed_category_ids : [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setOpen(false);
      setForm({ card_name: "", holder_id: "", wallet_id: "", spending_limit: "5000", spend_period: "monthly", card_type: "virtual", allowed_category_ids: [] });
      toast({ title: "Card issued" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <DataPageHeader
        title="Cards"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by card name, holder..."
        actions={
          isAdmin ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Issue card</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Issue new card</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createCard.mutate(); }} className="space-y-4">
                  <div className="space-y-1.5"><Label>Card name *</Label><Input value={form.card_name} onChange={(e) => setForm({ ...form, card_name: e.target.value })} required placeholder="e.g. Marketing Budget Card" /></div>
                  <div className="space-y-1.5">
                    <Label>Issue to *</Label>
                    <Select value={form.holder_id} onValueChange={(v) => setForm({ ...form, holder_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                      <SelectContent>{members.map((m: any) => {
                        const p = m.profiles as any;
                        const name = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "Unnamed";
                        return <SelectItem key={m.user_id} value={m.user_id}>{name} <span className="text-muted-foreground text-xs ml-1">({m.role})</span></SelectItem>;
                      })}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Attach to wallet</Label>
                    <Select value={form.wallet_id} onValueChange={(v) => setForm({ ...form, wallet_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                      <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({Number(w.balance).toLocaleString("de-DE", { style: "currency", currency: "EUR" })})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Spend limit (€)</Label><Input type="number" step="0.01" min="0" value={form.spending_limit} onChange={(e) => setForm({ ...form, spending_limit: e.target.value })} /></div>
                    <div className="space-y-1.5">
                      <Label>Limit period</Label>
                      <Select value={form.spend_period} onValueChange={(v: "daily" | "monthly") => setForm({ ...form, spend_period: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Card type</Label>
                    <Select value={form.card_type} onValueChange={(v) => setForm({ ...form, card_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="virtual">Virtual</SelectItem><SelectItem value="physical">Physical</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {categories.length > 0 && (
                    <div className="space-y-2">
                      <Label>Allowed categories</Label>
                      <p className="text-xs text-muted-foreground">Leave unchecked to allow all.</p>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {categories.map((cat: any) => (
                          <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={form.allowed_category_ids.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                            {cat.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={createCard.isPending}>{createCard.isPending ? "Issuing..." : "Issue card"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="mt-4">
        <DataTable
          headers={["Card", "Holder", "Type", "Limit", "Wallet", "Status"]}
          isLoading={isLoading}
          isEmpty={cards.length === 0}
          emptyMessage="No cards found."
        >
          {cards.map((card: any) => (
            <tr key={card.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-6 rounded bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                    <CreditCard className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{card.card_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">•••• {card.last_four}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-sm">{getMemberName(card.holder_id)}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{card.card_type}</td>
              <td className="px-4 py-3 text-sm">{Number(card.spending_limit).toLocaleString("de-DE")} € / {card.spend_period}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{card.wallets?.name || "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={card.status} /></td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Recent Transactions</h2>
          <DataTable headers={["Merchant", "Card", "Amount", "Date", "Reconciled"]} isEmpty={false}>
            {transactions.map((t: any) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{t.merchant_name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">•••• {t.cards?.last_four || "—"}</td>
                <td className="px-4 py-3 text-sm font-medium">{Number(t.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                <td className="px-4 py-3"><StatusBadge status={t.is_reconciled ? "active" : "pending"} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}
