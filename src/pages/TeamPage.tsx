import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";

export default function TeamPage() {
  const { orgId, role } = useOrganization();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("org_members")
        .select(`
          id, role, is_active, joined_at, user_id,
          profiles:user_id (first_name, last_name, avatar_url)
        `)
        .eq("org_id", orgId);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const isAdmin = role === "company_admin";

  const roleLabel = (r: string) => {
    const map: Record<string, string> = {
      company_admin: "Admin",
      finance_manager: "Finance Manager",
      approver: "Approver",
      employee: "Employee",
      tax_advisor: "Tax Advisor",
      super_admin: "Super Admin",
    };
    return map[r] || r;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1000px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="text-muted-foreground text-sm">Manage your organization members</p>
        </div>
        {isAdmin && (
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Invite member
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading...</div>
          ) : members.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No team members yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground">
                          {(m.profiles?.first_name?.[0] || "").toUpperCase()}
                          {(m.profiles?.last_name?.[0] || "").toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">
                          {m.profiles?.first_name} {m.profiles?.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{roleLabel(m.role)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.is_active ? "default" : "secondary"} className="text-xs">
                        {m.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(m.joined_at).toLocaleDateString("de-DE")}
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
