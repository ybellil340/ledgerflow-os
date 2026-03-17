import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/DataPageLayout";
import { PinDialog } from "@/components/PinDialog";
import { PinSetupDialog } from "@/components/PinSetupDialog";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Eye, EyeOff, Snowflake, X, Copy, Check, Pencil } from "lucide-react";

interface CardDetailPanelProps {
  card: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getMemberName: (userId: string) => string;
}

export function CardDetailPanel({ card, open, onOpenChange, getMemberName }: CardDetailPanelProps) {
  const { user } = useAuth();
  const { role, orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "company_admin";
  const isHolder = card?.holder_id === user?.id;
  const canViewDetails = isHolder || isAdmin;

  const [showDetails, setShowDetails] = useState(false);
  const [cardDetails, setCardDetails] = useState<{ card_number: string; expiry_month: number; expiry_year: number; cvv: string } | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [editPeriod, setEditPeriod] = useState<"daily" | "monthly">("monthly");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editWalletId, setEditWalletId] = useState("");
  const [countryMode, setCountryMode] = useState<"all" | "selected">("all");
  const [editCountries, setEditCountries] = useState<string[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").eq("org_id", orgId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && editing,
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("*").eq("org_id", orgId!).order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && editing,
  });

  useEffect(() => {
    if (card && editing) {
      setEditName(card.card_name || "");
      setEditLimit(String(card.spending_limit ?? "5000"));
      setEditPeriod(card.spend_period || "monthly");
      setEditCategories(card.allowed_category_ids || []);
      setEditWalletId(card.wallet_id || "none");
      const countries = card.allowed_countries || [];
      setCountryMode(countries.length === 0 ? "all" : "selected");
      setEditCountries(countries);
    }
  }, [card, editing]);

  // Reset state when panel closes
  useEffect(() => {
    if (!open) {
      setShowDetails(false);
      setCardDetails(null);
      setEditing(false);
    }
  }, [open]);

  const handleRevealDetails = async () => {
    const { data: hasPin } = await supabase.rpc("has_pin_set");
    if (!hasPin) {
      setPinSetupOpen(true);
      return;
    }
    setPinDialogOpen(true);
  };

  const handlePinSubmit = async (pin: string) => {
    setPinLoading(true);
    setPinError("");
    try {
      const { data, error } = await supabase.rpc("get_card_details", { _card_id: card.id, _pin: pin });
      if (error) throw error;
      if (data && data.length > 0) {
        setCardDetails(data[0] as any);
        setShowDetails(true);
        setPinDialogOpen(false);
      } else {
        setPinError("Could not retrieve card details");
      }
    } catch (err: any) {
      setPinError(err.message?.includes("Invalid PIN") ? "Invalid PIN" : err.message);
    } finally {
      setPinLoading(false);
    }
  };

  const hideDetails = () => {
    setShowDetails(false);
    setCardDetails(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const formatCardNumber = (num: string) => num?.replace(/(.{4})/g, "$1 ").trim();

  const toggleStatus = useMutation({
    mutationFn: async (newStatus: "active" | "frozen" | "cancelled") => {
      const { error } = await supabase.from("cards").update({ status: newStatus }).eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast({ title: "Card updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cards").update({
        card_name: editName,
        spending_limit: parseFloat(editLimit),
        spend_period: editPeriod,
        allowed_category_ids: editCategories.length > 0 ? editCategories : [],
        wallet_id: editWalletId === "none" ? null : editWalletId,
        allowed_countries: countryMode === "all" ? [] : editCountries,
      }).eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setEditing(false);
      toast({ title: "Card settings updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleCountry = (code: string) => {
    setEditCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };
  const toggleCategory = (catId: string) => {
    setEditCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  if (!card) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) hideDetails(); onOpenChange(v); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Card Details</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Visual card */}
            <div className="relative w-full aspect-[1.6/1] rounded-xl bg-gradient-to-br from-primary/90 to-primary p-5 flex flex-col justify-between text-primary-foreground shadow-lg">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium opacity-80">{card.card_type === "virtual" ? "Virtual" : "Physical"}</p>
                <CreditCard className="h-6 w-6 opacity-60" />
              </div>
              <div>
                <p className="text-lg font-mono tracking-widest">
                  {showDetails && cardDetails ? formatCardNumber(cardDetails.card_number) : `•••• •••• •••• ${card.last_four}`}
                </p>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] uppercase opacity-60">Card holder</p>
                  <p className="text-sm font-medium">{getMemberName(card.holder_id)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase opacity-60">Expires</p>
                  <p className="text-sm font-mono">
                    {showDetails && cardDetails
                      ? `${String(cardDetails.expiry_month).padStart(2, "0")}/${String(cardDetails.expiry_year).slice(-2)}`
                      : "••/••"}
                  </p>
                </div>
              </div>
            </div>

            {/* Reveal / hide button */}
            {canViewDetails && (
              <div className="flex gap-2">
                {!showDetails ? (
                  <Button variant="outline" className="flex-1 gap-2" onClick={handleRevealDetails}>
                    <Eye className="h-4 w-4" /> Show card details
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1 gap-2" onClick={hideDetails}>
                    <EyeOff className="h-4 w-4" /> Hide details
                  </Button>
                )}
              </div>
            )}

            {/* Sensitive details */}
            {showDetails && cardDetails && (
              <div className="space-y-3 bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Card number</p>
                    <p className="text-sm font-mono">{formatCardNumber(cardDetails.card_number)}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(cardDetails.card_number, "number")}>
                    {copied === "number" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Expiry</p>
                    <p className="text-sm font-mono">{String(cardDetails.expiry_month).padStart(2, "0")}/{cardDetails.expiry_year}</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">CVV</p>
                      <p className="text-sm font-mono">{cardDetails.cvv}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(cardDetails.cvv, "cvv")}>
                      {copied === "cvv" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Card info / Edit mode */}
            {!editing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Spend Controls</h3>
                  {isAdmin && card.status !== "cancelled" && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditing(true)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Card name</span>
                  <span className="font-medium">{card.card_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={card.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spend limit</span>
                  <span className="font-medium">{Number(card.spending_limit).toLocaleString("de-DE")} € / {card.spend_period}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wallet</span>
                  <span>{card.wallets?.name || "—"}</span>
                </div>
                {card.allowed_category_ids && card.allowed_category_ids.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Allowed categories</span>
                    <p className="text-xs mt-1">{card.allowed_category_ids.length} categories restricted</p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); updateCard.mutate(); }} className="space-y-4 border border-border rounded-lg p-4 bg-muted/30">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Edit Spend Controls</h3>
                <div className="space-y-1.5">
                  <Label>Card name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Spend limit (€)</Label>
                    <Input type="number" step="0.01" min="0" value={editLimit} onChange={(e) => setEditLimit(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Limit period</Label>
                    <Select value={editPeriod} onValueChange={(v: "daily" | "monthly") => setEditPeriod(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {categories.length > 0 && (
                  <div className="space-y-2">
                    <Label>Allowed categories</Label>
                    <p className="text-xs text-muted-foreground">Leave unchecked to allow all.</p>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3 bg-background">
                      {categories.map((cat: any) => (
                        <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={editCategories.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                          {cat.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="flex-1" disabled={updateCard.isPending}>
                    {updateCard.isPending ? "Saving..." : "Save changes"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </form>
            )}

            {/* Admin actions */}
            {isAdmin && card.status !== "cancelled" && !editing && (
              <div className="flex gap-2 pt-2 border-t border-border">
                {card.status === "active" && (
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => toggleStatus.mutate("frozen")}>
                    <Snowflake className="h-3.5 w-3.5" /> Freeze
                  </Button>
                )}
                {card.status === "frozen" && (
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => toggleStatus.mutate("active")}>
                    Unfreeze
                  </Button>
                )}
                <Button variant="destructive" size="sm" className="flex-1 gap-1.5" onClick={() => toggleStatus.mutate("cancelled")}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        onSubmit={handlePinSubmit}
        loading={pinLoading}
        error={pinError}
      />

      <PinSetupDialog
        open={pinSetupOpen}
        onOpenChange={setPinSetupOpen}
        onSuccess={() => setPinDialogOpen(true)}
      />
    </>
  );
}
