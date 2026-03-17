import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { orgId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"company" | "pin">("company");
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep, setPinStep] = useState<"new" | "confirm">("new");
  const [pinError, setPinError] = useState("");

  if (authLoading || orgLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }
  if (!user) return <Navigate to="/" replace />;
  if (orgId) return <Navigate to="/dashboard" replace />;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const orgId = crypto.randomUUID();

      const { error: orgError } = await supabase
        .from("organizations")
        .insert({
          id: orgId,
          name: companyName,
          legal_name: legalName || null,
          tax_id: taxId || null,
        });
      if (orgError) throw orgError;

      const { error: memberError } = await supabase
        .from("org_members")
        .insert({ org_id: orgId, user_id: user.id, role: "company_admin" as const });
      if (memberError) throw memberError;

      await queryClient.invalidateQueries({ queryKey: ["org-membership", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["organization", orgId] });

      toast({ title: "Company created", description: `${companyName} is ready.` });
      setStep("pin");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewPin = (value: string) => {
    setNewPin(value);
    if (value.length === 4) {
      setPinStep("confirm");
    }
  };

  const handleConfirmPin = async (value: string) => {
    setConfirmPin(value);
    if (value.length === 4) {
      if (value !== newPin) {
        setPinError("PINs don't match. Try again.");
        setConfirmPin("");
        setPinStep("new");
        setNewPin("");
        return;
      }
      setPinError("");
      setSubmitting(true);
      const { error } = await supabase.rpc("set_user_pin", { _pin: value });
      setSubmitting(false);
      if (error) {
        setPinError(error.message);
        return;
      }
      toast({ title: "PIN set up!", description: "Your security PIN is ready." });
      navigate("/dashboard", { replace: true });
    }
  };

  const skipPin = () => {
    navigate("/dashboard", { replace: true });
  };

  if (step === "pin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Set up your security PIN
            </CardTitle>
            <p className="text-sm text-muted-foreground">Create a 4-digit PIN to secure sensitive actions like viewing card details.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm font-medium text-center">
              {pinStep === "new" ? "Choose your PIN" : "Confirm your PIN"}
            </p>
            <div className="flex justify-center">
              {pinStep === "new" ? (
                <InputOTP maxLength={4} value={newPin} onChange={handleNewPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              ) : (
                <InputOTP maxLength={4} value={confirmPin} onChange={handleConfirmPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              )}
            </div>
            {pinError && <p className="text-sm text-destructive text-center">{pinError}</p>}
            {submitting && <p className="text-sm text-muted-foreground text-center">Saving...</p>}
            <Button variant="ghost" className="w-full" onClick={skipPin}>Skip for now</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up your company</CardTitle>
          <p className="text-sm text-muted-foreground">Create your organization to get started with LedgerFlow.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company name *</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legalName">Legal name</Label>
              <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxId">Tax ID (Steuernummer)</Label>
              <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="h-10" />
            </div>
            <Button type="submit" className="w-full h-10" disabled={submitting}>
              {submitting ? "Creating..." : "Create company"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
