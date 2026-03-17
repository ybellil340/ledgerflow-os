import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type OrgMember = Database["public"]["Tables"]["org_members"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export function useOrganization() {
  const { user } = useAuth();

  const { data: membership, isLoading: membershipLoading } = useQuery({
    queryKey: ["org-membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("org_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as OrgMember | null;
    },
    enabled: !!user,
  });

  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ["organization", membership?.org_id],
    queryFn: async () => {
      if (!membership) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.org_id)
        .single();
      if (error) throw error;
      return data as Organization;
    },
    enabled: !!membership?.org_id,
  });

  return {
    membership,
    organization,
    orgId: membership?.org_id ?? null,
    role: membership?.role ?? null,
    isLoading: membershipLoading || orgLoading,
  };
}
