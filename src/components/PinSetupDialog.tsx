import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  isChange?: boolean;
}

export function PinSetupDialog({ open, onOpenChange, onSuccess, isChange }: PinSetupDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"current" | "new" | "confirm">(isChange ? "current" : "new");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(isChange ? "current" : "new");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setError("");
    }
  }, [open, isChange]);

  const verifyCurrentPin = async (pin: string) => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.rpc("verify_user_pin", { _pin: pin });
    setLoading(false);
    if (err || !data) {
      setError("Current PIN is incorrect");
      setCurrentPin("");
      return;
    }
    setStep("new");
  };

  const handleNewPin = (pin: string) => {
    setNewPin(pin);
    if (pin.length === 4) {
      setStep("confirm");
    }
  };

  const handleConfirm = async (pin: string) => {
    setConfirmPin(pin);
    if (pin.length === 4) {
      if (pin !== newPin) {
        setError("PINs don't match. Try again.");
        setConfirmPin("");
        setStep("new");
        setNewPin("");
        return;
      }
      setLoading(true);
      setError("");
      const { error: err } = await supabase.rpc("set_user_pin", { _pin: pin });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      toast({ title: isChange ? "PIN updated" : "PIN set up", description: "Your security PIN has been saved." });
      onOpenChange(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {isChange ? "Change PIN" : "Set up your PIN"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {step === "current" && "Enter your current 4-digit PIN."}
            {step === "new" && "Choose a 4-digit security PIN."}
            {step === "confirm" && "Confirm your new PIN."}
          </p>
          <div className="flex justify-center">
            {step === "current" && (
              <InputOTP maxLength={4} value={currentPin} onChange={(v) => { setCurrentPin(v); if (v.length === 4) verifyCurrentPin(v); }}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            )}
            {step === "new" && (
              <InputOTP maxLength={4} value={newPin} onChange={handleNewPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            )}
            {step === "confirm" && (
              <InputOTP maxLength={4} value={confirmPin} onChange={handleConfirm}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            )}
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground text-center">Processing...</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
