import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function ReimbursementsPage() {
  const { orgId, role } = useOrganization();
  const isAdmin = role === "company_admin" || role === "finance_manager";

  const { data: approved = [], isLoading } = useQuery({
    queryKey: ["reimbursements", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("org_id", orgId!).in("status", ["approved", "reimbursed"]).order("approved_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Reimbursements</h1>
        <p className="text-muted-foreground text-sm">Approved expenses pending reimbursement</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading...</div> : approved.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No approved expenses to reimburse.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Approved</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                {isAdmin && <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>}
              </tr></thead>
              <tbody>
                {approved.map((e: any) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{e.title}</td>
                    <td className="px-4 py-3 text-sm">{Number(e.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{e.approved_at ? new Date(e.approved_at).toLocaleDateString("de-DE") : "—"}</td>
                    <td className="px-4 py-3"><Badge variant={e.status === "reimbursed" ? "default" : "secondary"} className="text-xs capitalize">{e.status}</Badge></td>
                    {isAdmin && e.status === "approved" && (
                      <td className="px-4 py-3"><Button size="sm" variant="outline" className="h-7 text-xs">Mark reimbursed</Button></td>
                    )}
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
