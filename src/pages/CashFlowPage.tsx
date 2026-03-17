import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default function CashFlowPage() {
  const { orgId } = useOrganization();

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").eq("org_id", orgId!).order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: apTotal = 0 } = useQuery({
    queryKey: ["ap-total", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ap_invoices").select("amount").eq("org_id", orgId!).in("status", ["pending", "approved"]);
      if (error) throw error;
      return (data || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    },
    enabled: !!orgId,
  });

  const { data: arTotal = 0 } = useQuery({
    queryKey: ["ar-total", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ar_invoices").select("amount").eq("org_id", orgId!).in("status", ["pending", "approved"]);
      if (error) throw error;
      return (data || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    },
    enabled: !!orgId,
  });

  const totalBalance = bankAccounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
  const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Cash Flow</h1>
        <p className="text-muted-foreground text-sm">Overview of your cash position</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Total balance</p>
            </div>
            <p className="text-2xl font-semibold">{fmt(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <p className="text-sm text-muted-foreground">Receivables (AR)</p>
            </div>
            <p className="text-2xl font-semibold text-success">{fmt(arTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              <p className="text-sm text-muted-foreground">Payables (AP)</p>
            </div>
            <p className="text-2xl font-semibold text-destructive">{fmt(apTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-3">Bank accounts</h2>
      <Card>
        <CardContent className="p-0">
          {bankAccounts.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No bank accounts linked yet.</div> : (
            <table className="w-full">
              <thead><tr className="border-b text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Bank</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">IBAN</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Balance</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Primary</th>
              </tr></thead>
              <tbody>
                {bankAccounts.map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{a.bank_name}</td>
                    <td className="px-4 py-3 text-sm">{a.account_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{a.iban || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium">{fmt(Number(a.balance))}</td>
                    <td className="px-4 py-3">{a.is_primary && <Badge className="text-xs">Primary</Badge>}</td>
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
