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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowRightLeft, Copy, CheckCircle, Wallet, ChevronRight, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WalletsPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "company_admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false);
  const [addFundsWalletId, setAddFundsWalletId] = useState<string | null>(null);
  const [walletForm, setWalletForm] = useState({ name: "", iban_display: "", bic_display: "" });
  const [transferForm, setTransferForm] = useState({ from_wallet_id: "", to_wallet_id: "", amount: "", note: "" });
  const [addFundsAmount, setAddFundsAmount] = useState("");
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

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("id, wallet_id, status")
        .eq("org_id", orgId!);
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
  const totalBalance = wallets.reduce((sum: number, w: any) => sum + Number(w.balance), 0);

  const getActiveCardCount = (walletId: string) =>
    cards.filter((c: any) => c.wallet_id === walletId && c.status === "active").length;

  const LOW_FUNDS_THRESHOLD = 100;

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

  const addFundsToWallet = useMutation({
    mutationFn: async () => {
      if (!addFundsWalletId || !primaryWallet) throw new Error("Missing wallet");
      const amount = parseFloat(addFundsAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

      // Only sub-wallet funding allowed (from primary)
      if (Number(primaryWallet.balance) < amount) throw new Error("Insufficient primary wallet balance");
      const targetWallet = wallets.find((w: any) => w.id === addFundsWalletId);
      if (!targetWallet) throw new Error("Wallet not found");

      const { error: e1 } = await supabase
        .from("wallets")
        .update({ balance: Number(primaryWallet.balance) - amount })
        .eq("id", primaryWallet.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("wallets")
        .update({ balance: Number(targetWallet.balance) + amount })
        .eq("id", targetWallet.id);
      if (e2) throw e2;

      const { error: e3 } = await supabase.from("wallet_transfers").insert({
        org_id: orgId!,
        from_wallet_id: primaryWallet.id,
        to_wallet_id: targetWallet.id,
        amount,
        note: `Fund ${targetWallet.name}`,
        created_by: user!.id,
      });
      if (e3) throw e3;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet_transfers"] });
      setAddFundsOpen(false);
      setAddFundsAmount("");
      setAddFundsWalletId(null);
      toast({ title: "Funds transferred" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const transferFunds = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(transferForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
      const fromW = wallets.find((w: any) => w.id === transferForm.from_wallet_id);
      if (!fromW || Number(fromW.balance) < amount) throw new Error("Insufficient balance");

      const { error: e1 } = await supabase
        .from("wallets")
        .update({ balance: Number(fromW.balance) - amount })
        .eq("id", fromW.id);
      if (e1) throw e1;

      const toW = wallets.find((w: any) => w.id === transferForm.to_wallet_id);
      const { error: e2 } = await supabase
        .from("wallets")
        .update({ balance: Number(toW!.balance) + amount })
        .eq("id", toW!.id);
      if (e2) throw e2;

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

  const openAddFunds = (walletId: string) => {
    setAddFundsWalletId(walletId);
    setAddFundsAmount("");
    setAddFundsOpen(true);
  };

  const isPrimarySetup = wallets.length === 0;
  const addFundsTargetWallet = wallets.find((w: any) => w.id === addFundsWalletId);
  const isPrimaryTopUp = addFundsWalletId === primaryWallet?.id;

  const formatCurrency = (amount: number) =>
    Number(amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  const WalletTableRow = ({ wallet, showLowFunds = false }: { wallet: any; showLowFunds?: boolean }) => {
    const activeCards = getActiveCardCount(wallet.id);
    const isLow = showLowFunds && Number(wallet.balance) < LOW_FUNDS_THRESHOLD;

    return (
      <TableRow>
        <TableCell>
          <div>
            <span className="font-medium text-sm">{wallet.name}</span>
            {isLow && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                Low Funds
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-sm">{formatCurrency(wallet.balance)}</TableCell>
        <TableCell className="text-sm">{activeCards}</TableCell>
        <TableCell>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
            Active
          </Badge>
        </TableCell>
        <TableCell>
          {isAdmin && (
            <div className="flex items-center gap-3">
              {wallet.is_primary ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1 text-primary hover:text-primary"
                  onClick={() => setBankDetailsOpen(true)}
                >
                  <Landmark className="h-3 w-3" />
                  Bank Details
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1 text-primary hover:text-primary"
                  onClick={() => openAddFunds(wallet.id)}
                >
                  <Plus className="h-3 w-3" />
                  Add Funds
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground">
                Manage <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Wallets</h1>
        <div className="flex gap-2">
          {isAdmin && wallets.length >= 2 && (
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                  Transfer Funds
                </Button>
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
                            {w.name} ({formatCurrency(w.balance)})
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
                            {w.name} ({formatCurrency(w.balance)})
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
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  {isPrimarySetup ? "Create Primary Wallet" : "Create Wallet"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{isPrimarySetup ? "Create Primary Wallet" : "Create Sub-wallet"}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createWallet.mutate(); }} className="space-y-3">
                  {isPrimarySetup ? (
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
                      <Input value={walletForm.name} onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })} required placeholder="e.g. Marketing, Petty Cash" />
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={createWallet.isPending}>
                    {createWallet.isPending ? "Creating..." : isPrimarySetup ? "Create Primary Wallet" : "Create Wallet"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Add Funds Dialog */}
      <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPrimaryTopUp ? "Record Incoming Transfer" : `Add Funds to ${addFundsTargetWallet?.name}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addFundsToWallet.mutate(); }} className="space-y-3">
            {isPrimaryTopUp ? (
              <p className="text-sm text-muted-foreground">
                Record a bank transfer amount that arrived to your primary wallet.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Funds will be transferred from <span className="font-medium">Primary Wallet</span> ({formatCurrency(primaryWallet?.balance ?? 0)}) to <span className="font-medium">{addFundsTargetWallet?.name}</span>.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Amount (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={addFundsAmount}
                onChange={(e) => setAddFundsAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={addFundsToWallet.isPending}>
              {addFundsToWallet.isPending ? "Processing..." : isPrimaryTopUp ? "Record Transfer" : "Transfer Funds"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
          {/* Total Balance Card */}
          <Card className="mb-8 w-fit">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Balance</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(totalBalance)}</p>
                {primaryWallet?.iban_display && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">{primaryWallet.iban_display}</span>
                    <button onClick={copyIban} className="text-muted-foreground hover:text-foreground">
                      {copiedIban ? <CheckCircle className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Primary Wallet Table */}
          {primaryWallet && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold mb-3">Primary Wallet</h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Wallet</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Active Cards</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <WalletTableRow wallet={primaryWallet} />
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Sub-wallets Table */}
          {subWallets.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold mb-3">Sub-wallets</h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Wallet</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Active Cards</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subWallets.map((w: any) => (
                      <WalletTableRow key={w.id} wallet={w} showLowFunds />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Recent Transfers */}
          {transfers.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Recent Transfers</h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">{t.from_wallet?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{t.to_wallet?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(t.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.note || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("de-DE")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
