// src/pages/AuditLogPage.tsx
// PATCHED: l.details → l.metadata everywhere (audit_logs schema uses 'metadata').

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AuditLogPage() {
  const { orgId } = useOrganization();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="text-muted-foreground text-sm">Activity trail for compliance</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No audit events recorded yet.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Entity</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("de-DE")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">{l.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{l.entity_type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                      {l.metadata ? JSON.stringify(l.metadata) : "—"}
                    </td>
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
