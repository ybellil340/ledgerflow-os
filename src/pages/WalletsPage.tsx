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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Wallet, ArrowRightLeft, Copy, CheckCircle, Landmark } from "lucide-react";

export default function WalletsPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "company_admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [walletForm, setWalletForm] = useState({ name: "", iban_display: "", bic_display: "" });
  const [transferForm, setTransferForm] = useState({ from_wallet_id: "", to_wallet_id: "", amount: "", note: "" });
  const [topUpAmount, setTopUpAmount] = useState("");
  const [copiedIban, setCopiedIban] = useState(false);

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ["wallets", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("org_id", orgId!)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["wallet_transfers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transfers")
        .select("*, from_wallet:wallets!wallet_transfers_from_wallet_id_fkey(name), to_wallet:wallets!wallet_transfers_to_wallet_id_fkey(name)")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const primaryWallet = wallets.find((w: any) => w.is_primary);
  const subWallets = wallets.filter((w: any) => !w.is_primary);

  const createWallet = useMutation({
    mutationFn: async () => {
      const isPrimary = wallets.length === 0;
      const { error } = await supabase.from("wallets").insert({
        org_id: orgId!,
        name: isPrimary ? "Primary Wallet" : walletForm.name,
        is_primary: isPrimary,
        iban_display: isPrimary ? walletForm.iban_display || null : null,
        bic_display: isPrimary ? walletForm.bic_display || null : null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      setCreateOpen(false);
      setWalletForm({ name: "", iban_display: "", bic_display: "" });
      toast({ title: "Wallet created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const topUpPrimary = useMutation({
    mutationFn: async () => {
      if (!primaryWallet) throw new Error("No primary wallet");
      const amount = parseFloat(topUpAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
      const { error } = await supabase
        .from("wallets")
        .update({ balance: Number(primaryWallet.balance) + amount })
        .eq("id", primaryWallet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      setTopUpOpen(false);
      setTopUpAmount("");
      toast({ title: "Funds recorded", description: "Primary wallet balance updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const transferFunds = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(transferForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
      const fromW = wallets.find((w: any) => w.id === transferForm.from_wallet_id);
      if (!fromW || Number(fromW.balance) < amount) throw new Error("Insufficient balance");

      // Deduct from source
      const { error: e1 } = await supabase
        .from("wallets")
        .update({ balance: Number(fromW.balance) - amount })
        .eq("id", fromW.id);
      if (e1) throw e1;

      // Add to target
      const toW = wallets.find((w: any) => w.id === transferForm.to_wallet_id);
      const { error: e2 } = await supabase
        .from("wallets")
        .update({ balance: Number(toW!.balance) + amount })
        .eq("id", toW!.id);
      if (e2) throw e2;

      // Log transfer
      const { error: e3 } = await supabase.from("wallet_transfers").insert({
        org_id: orgId!,
        from_wallet_id: fromW.id,
        to_wallet_id: toW!.id,
        amount,
        note: transferForm.note || null,
        created_by: user!.id,
      });
      if (e3) throw e3;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet_transfers"] });
      setTransferOpen(false);
      setTransferForm({ from_wallet_id: "", to_wallet_id: "", amount: "", note: "" });
      toast({ title: "Transfer complete" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyIban = () => {
    if (primaryWallet?.iban_display) {
      navigator.clipboard.writeText(primaryWallet.iban_display);
      setCopiedIban(true);
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  const isPrimary = wallets.length === 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Wallets</h1>
          <p className="text-muted-foreground text-sm">Fund your primary wallet via bank transfer, then distribute across sub-wallets.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && wallets.length >= 1 && (
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><ArrowRightLeft className="h-4 w-4 mr-1.5" />Transfer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Transfer funds</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); transferFunds.mutate(); }} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>From wallet</Label>
                    <Select value={transferForm.from_wallet_id} onValueChange={(v) => setTransferForm({ ...transferForm, from_wallet_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        {wallets.map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} ({Number(w.balance).toLocaleString("de-DE", { style: "currency", currency: "EUR" })})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>To wallet</Label>
                    <Select value={transferForm.to_wallet_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_wallet_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                      <SelectContent>
                        {wallets.filter((w: any) => w.id !== transferForm.from_wallet_id).map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} ({Number(w.balance).toLocaleString("de-DE", { style: "currency", currency: "EUR" })})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (€)</Label>
                    <Input type="number" step="0.01" min="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} placeholder="e.g. March marketing budget" />
                  </div>
                  <Button type="submit" className="w-full" disabled={transferFunds.isPending}>
                    {transferFunds.isPending ? "Transferring..." : "Transfer funds"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />{isPrimary ? "Create primary wallet" : "Add wallet"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{isPrimary ? "Create primary wallet" : "Create sub-wallet"}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createWallet.mutate(); }} className="space-y-3">
                  {isPrimary ? (
                    <>
                      <p className="text-sm text-muted-foreground">Your primary wallet receives incoming bank transfers. All sub-wallets are funded from here.</p>
                      <div className="space-y-1.5">
                        <Label>IBAN (for display)</Label>
                        <Input value={walletForm.iban_display} onChange={(e) => setWalletForm({ ...walletForm, iban_display: e.target.value })} placeholder="DE89 3704 0044 0532 0130 00" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>BIC (optional)</Label>
                        <Input value={walletForm.bic_display} onChange={(e) => setWalletForm({ ...walletForm, bic_display: e.target.value })} placeholder="DEUTDEDB" />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Wallet name *</Label>
                      <Input value={walletForm.name} onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })} required placeholder="e.g. Marketing, Petty Cash, Office Supplies" />
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={createWallet.isPending}>
                    {createWallet.isPending ? "Creating..." : isPrimary ? "Create primary wallet" : "Create wallet"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading wallets...</p>
      ) : wallets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium mb-1">No wallets yet</p>
            <p className="text-xs text-muted-foreground mb-4">Start by creating your primary wallet to receive bank transfers.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Primary Wallet */}
          {primaryWallet && (
            <Card className="mb-6 bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Landmark className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold">{primaryWallet.name}</h2>
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">Primary</Badge>
                    </div>
                    <p className="text-3xl font-bold tracking-tight mt-2">
                      {Number(primaryWallet.balance).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </p>
                    {primaryWallet.iban_display && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-mono">{primaryWallet.iban_display}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copyIban}>
                          {copiedIban ? <CheckCircle className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                        {primaryWallet.bic_display && (
                          <span className="text-xs text-muted-foreground">BIC: {primaryWallet.bic_display}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">Record incoming transfer</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Record incoming bank transfer</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); topUpPrimary.mutate(); }} className="space-y-3">
                          <p className="text-sm text-muted-foreground">Record an incoming bank transfer amount that arrived to your primary wallet.</p>
                          <div className="space-y-1.5">
                            <Label>Amount received (€)</Label>
                            <Input type="number" step="0.01" min="0.01" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} required />
                          </div>
                          <Button type="submit" className="w-full" disabled={topUpPrimary.isPending}>
                            {topUpPrimary.isPending ? "Recording..." : "Record transfer"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sub-wallets grid */}
          {subWallets.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Sub-wallets</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {subWallets.map((w: any) => (
                  <Card key={w.id}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{w.name}</p>
                      </div>
                      <p className="text-2xl font-bold">
                        {Number(w.balance).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Recent transfers */}
          {transfers.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Recent transfers</h2>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">From</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">To</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Note</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((t: any) => (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="px-4 py-3 text-sm">{t.from_wallet?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-sm">{t.to_wallet?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {Number(t.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{t.note || "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString("de-DE")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
