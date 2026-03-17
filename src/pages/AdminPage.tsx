import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Building2, Activity } from "lucide-react";

export default function AdminPage() {
  const { orgId, role, organization } = useOrganization();
  const isAdmin = role === "company_admin" || role === "super_admin";

  const { data: members = [] } = useQuery({
    queryKey: ["admin-members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_members").select("*, profiles:user_id(first_name, last_name)").eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isAdmin,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["admin-departments", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isAdmin,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["admin-cost-centers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_centers").select("*").eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center gap-2 text-destructive"><Shield className="h-5 w-5" /><p className="text-sm font-medium">Access denied. Admin privileges required.</p></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-muted-foreground text-sm">Organization settings and management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold">{members.length}</p><p className="text-xs text-muted-foreground">Team members</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Building2 className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold">{departments.length}</p><p className="text-xs text-muted-foreground">Departments</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Activity className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold">{costCenters.length}</p><p className="text-xs text-muted-foreground">Cost centers</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="org" className="space-y-4">
        <TabsList>
          <TabsTrigger value="org">Organization</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="cost-centers">Cost Centers</TabsTrigger>
        </TabsList>

        <TabsContent value="org">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Name</span><span className="text-sm font-medium">{organization?.name}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Legal name</span><span className="text-sm">{organization?.legal_name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Tax ID</span><span className="text-sm">{organization?.tax_id || "—"}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Country</span><span className="text-sm">{organization?.country}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Currency</span><span className="text-sm">{organization?.currency}</span></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardContent className="p-0">
              {departments.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No departments configured.</div> : (
                <table className="w-full">
                  <thead><tr className="border-b text-left"><th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th><th className="px-4 py-3 text-xs font-medium text-muted-foreground">Created</th></tr></thead>
                  <tbody>
                    {departments.map((d: any) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-medium">{d.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(d.created_at).toLocaleDateString("de-DE")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-centers">
          <Card>
            <CardContent className="p-0">
              {costCenters.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No cost centers configured.</div> : (
                <table className="w-full">
                  <thead><tr className="border-b text-left"><th className="px-4 py-3 text-xs font-medium text-muted-foreground">Code</th><th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th><th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th></tr></thead>
                  <tbody>
                    {costCenters.map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-medium">{c.code}</td>
                        <td className="px-4 py-3 text-sm">{c.name}</td>
                        <td className="px-4 py-3"><Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">{c.is_active ? "Active" : "Inactive"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
