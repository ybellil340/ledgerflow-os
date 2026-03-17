import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DataPageHeader, DataTable, StatusBadge } from "@/components/DataPageLayout";
import { useToast } from "@/hooks/use-toast";

export default function ReimbursementsPage() {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "company_admin" || role === "finance_manager";
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  const { data: allExpenses = [], isLoading } = useQuery({
    queryKey: ["reimbursements", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("org_id", orgId!).in("status", ["approved", "reimbursed"]).order("approved_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const markReimbursed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").update({ status: "reimbursed" as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
      toast({ title: "Marked as reimbursed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const counts = {
    all: allExpenses.length,
    approved: allExpenses.filter((e: any) => e.status === "approved").length,
    reimbursed: allExpenses.filter((e: any) => e.status === "reimbursed").length,
  };

  const tabs = [
    { label: "All", value: "all", count: counts.all },
    { label: "Pending Reimbursement", value: "approved", count: counts.approved },
    { label: "Reimbursed", value: "reimbursed", count: counts.reimbursed },
  ];

  const expenses = allExpenses
    .filter((e: any) => activeTab === "all" || e.status === activeTab)
    .filter((e: any) => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <DataPageHeader
        title="Reimbursements"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title..."
        onDownload={() => {}}
      />

      <div className="mt-4">
        <DataTable
          headers={["Title", "Amount", "Approved On", "Status", ...(isAdmin ? ["Action"] : [])]}
          isLoading={isLoading}
          isEmpty={expenses.length === 0}
          emptyMessage="No approved expenses to reimburse."
        >
          {expenses.map((e: any) => (
            <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 text-sm font-medium">{e.title}</td>
              <td className="px-4 py-3 text-sm font-medium">{Number(e.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{e.approved_at ? new Date(e.approved_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
              {isAdmin && (
                <td className="px-4 py-3">
                  {e.status === "approved" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markReimbursed.mutate(e.id)} disabled={markReimbursed.isPending}>
                      Mark reimbursed
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
