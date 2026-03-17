import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Lock } from "lucide-react";

interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (pin: string) => Promise<void>;
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string;
}

export function PinDialog({ open, onOpenChange, onSubmit, title = "Enter your PIN", description = "Enter your 4-digit security PIN to continue.", loading, error }: PinDialogProps) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open) setPin("");
  }, [open]);

  const handleComplete = async (value: string) => {
    if (value.length === 4) {
      await onSubmit(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex justify-center">
            <InputOTP maxLength={4} value={pin} onChange={(v) => { setPin(v); if (v.length === 4) handleComplete(v); }}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground text-center">Verifying...</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
