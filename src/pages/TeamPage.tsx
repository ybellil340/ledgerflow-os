import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, X } from "lucide-react";

const roleOptions = [
  { value: "employee", label: "Employee" },
  { value: "approver", label: "Approver" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "company_admin", label: "Admin" },
  { value: "tax_advisor", label: "Tax Advisor" },
];

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

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  accepted: "bg-success/10 text-success",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function TeamPage() {
  const { orgId, role } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");
  const isAdmin = role === "company_admin";

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("org_members")
        .select(`id, role, is_active, joined_at, user_id, profiles:user_id (first_name, last_name, avatar_url)`)
        .eq("org_id", orgId);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: { email, role: inviteRole, org_id: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      setInviteOpen(false);
      setEmail("");
      setInviteRole("employee");
      toast({ title: "Invitation sent", description: data?.message || `Invited ${email}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").update({ status: "cancelled" as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast({ title: "Invitation cancelled" });
    },
  });

  const pendingCount = invitations.filter((i: any) => i.status === "pending").length;

  return (
    <div className="p-6 lg:p-8 max-w-[1000px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="text-muted-foreground text-sm">Manage your organization members</p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4 mr-1.5" />Invite member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); sendInvite.mutate(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email address *</Label>
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {inviteRole === "company_admin" && "Full access to all settings and data"}
                    {inviteRole === "finance_manager" && "Can manage invoices, expenses, and financial data"}
                    {inviteRole === "approver" && "Can approve or reject expenses and invoices"}
                    {inviteRole === "employee" && "Can submit expenses and view own data"}
                    {inviteRole === "tax_advisor" && "Read-only access to financial data for tax advisory"}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={sendInvite.isPending}>
                  <Mail className="h-4 w-4 mr-1.5" />
                  {sendInvite.isPending ? "Sending..." : "Send invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations
            {pendingCount > 0 && <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">{pendingCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
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
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardContent className="p-0">
              {invitations.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No invitations sent yet.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Sent</th>
                      {isAdmin && <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv: any) => (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-medium">{inv.email}</td>
                        <td className="px-4 py-3 text-sm">{roleLabel(inv.role)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={`text-xs capitalize ${statusColors[inv.status]}`}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString("de-DE")}
                        </td>
                        {isAdmin && inv.status === "pending" && (
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => cancelInvite.mutate(inv.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
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
