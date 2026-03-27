// src/hooks/useCards.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import {
  issueCard,
  freezeCard,
  unfreezeCard,
  updateCardLimit,
  cancelCard,
  type IssueCardParams,
} from "@/lib/cardActions";

export function useCards() {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["cards", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("*, wallets(name)")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["cards", orgId] });

  const issueMutation = useMutation({
    mutationFn: (params: Omit<IssueCardParams, "orgId">) =>
      issueCard({ ...params, orgId: orgId! }),
    onSuccess: invalidate,
  });

  const freezeMutation = useMutation({
    mutationFn: (cardId: string) => freezeCard(cardId, orgId!),
    onSuccess: invalidate,
  });

  const unfreezeMutation = useMutation({
    mutationFn: (cardId: string) => unfreezeCard(cardId, orgId!),
    onSuccess: invalidate,
  });

  const updateLimitMutation = useMutation({
    mutationFn: ({
      cardId,
      spendingLimit,
      spendPeriod,
    }: {
      cardId: string;
      spendingLimit: number;
      spendPeriod?: "daily" | "monthly";
    }) => updateCardLimit(cardId, orgId!, spendingLimit, spendPeriod),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: (cardId: string) => cancelCard(cardId, orgId!),
    onSuccess: invalidate,
  });

  return {
    cards: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    issueCard: issueMutation.mutateAsync,
    isIssuing: issueMutation.isPending,
    freezeCard: freezeMutation.mutateAsync,
    unfreezeCard: unfreezeMutation.mutateAsync,
    updateCardLimit: updateLimitMutation.mutateAsync,
    cancelCard: cancelMutation.mutateAsync,
  };
}
