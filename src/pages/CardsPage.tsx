import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, Snowflake } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  frozen: "bg-warning/10 text-warning",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function CardsPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ card_name: "", spending_limit: "5000", card_type: "virtual" });
  const isAdmin = role === "company_admin";

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["cards", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*").eq("org_id", orgId!).order("created_at", { ascending: false });
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

  const createCard = useMutation({
    mutationFn: async () => {
      const lastFour = String(Math.floor(1000 + Math.random() * 9000));
      const { error } = await supabase.from("cards").insert({
        org_id: orgId!, holder_id: user!.id, card_name: form.card_name,
        last_four: lastFour, card_type: form.card_type,
        spending_limit: parseFloat(form.spending_limit),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setOpen(false);
      setForm({ card_name: "", spending_limit: "5000", card_type: "virtual" });
      toast({ title: "Card issued" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold">Cards</h1><p className="text-muted-foreground text-sm">Virtual and physical cards</p></div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Issue card</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Issue new card</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createCard.mutate(); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Card name *</Label><Input value={form.card_name} onChange={(e) => setForm({ ...form, card_name: e.target.value })} required placeholder="Marketing budget" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Spending limit (€)</Label><Input type="number" value={form.spending_limit} onChange={(e) => setForm({ ...form, spending_limit: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Type</Label><Input value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })} placeholder="virtual" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createCard.isPending}>{createCard.isPending ? "Issuing..." : "Issue card"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {isLoading ? <div className="text-sm text-muted-foreground">Loading...</div> : cards.length === 0 ? <div className="text-sm text-muted-foreground">No cards issued yet.</div> : cards.map((card: any) => (
          <Card key={card.id} className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
                <Badge variant="secondary" className={`text-xs capitalize ${statusColors[card.status]}`}>{card.status}</Badge>
              </div>
              <p className="text-lg font-mono tracking-wider mb-1">•••• •••• •••• {card.last_four}</p>
              <p className="text-sm font-medium">{card.card_name}</p>
              <div className="flex justify-between mt-3">
                <span className="text-xs text-muted-foreground capitalize">{card.card_type}</span>
                <span className="text-xs text-muted-foreground">Limit: {Number(card.spending_limit).toLocaleString("de-DE")} €</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent transactions */}
      <h2 className="text-lg font-semibold mb-3">Recent transactions</h2>
      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No transactions yet.</div> : (
            <table className="w-full">
              <thead><tr className="border-b text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Merchant</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Card</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Reconciled</th>
              </tr></thead>
              <tbody>
                {transactions.map((t: any) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{t.merchant_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">•••• {t.cards?.last_four || "—"}</td>
                    <td className="px-4 py-3 text-sm">{Number(t.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString("de-DE")}</td>
                    <td className="px-4 py-3"><Badge variant={t.is_reconciled ? "default" : "secondary"} className="text-xs">{t.is_reconciled ? "Yes" : "No"}</Badge></td>
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
