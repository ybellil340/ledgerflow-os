import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { orgId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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
