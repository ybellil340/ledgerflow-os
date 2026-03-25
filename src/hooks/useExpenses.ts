import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import type { Expense } from "@/types";

export function useExpenses() {
  const { orgId } = useOrganization();

  const query = useQuery<Expense[]>({
    queryKey: ["expenses", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_categories(name, code)")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Expense>) => {
      const { data, error } = await supabase.from("expenses").insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", orgId] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Expense> & { id: string }) => {
      const { data, error } = await supabase.from("expenses").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", orgId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", orgId] }),
  });

  return {
    expenses: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createExpense: createMutation.mutate,
    updateExpense: updateMutation.mutate,
    deleteExpense: deleteMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
