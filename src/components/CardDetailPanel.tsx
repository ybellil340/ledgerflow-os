import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/DataPageLayout";
import { PinDialog } from "@/components/PinDialog";
import { PinSetupDialog } from "@/components/PinSetupDialog";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Eye, EyeOff, Snowflake, X, Copy, Check } from "lucide-react";

interface CardDetailPanelProps {
  card: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getMemberName: (userId: string) => string;
}

export function CardDetailPanel({ card, open, onOpenChange, getMemberName }: CardDetailPanelProps) {
  const { user } = useAuth();
  const { role } = useOrganization();
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

  const handleRevealDetails = async () => {
    // Check if user has PIN set
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

            {/* Card info */}
            <div className="space-y-3">
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
            </div>

            {/* Admin actions */}
            {isAdmin && card.status !== "cancelled" && (
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
