import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { CATEGORY_CODE_MAP } from "@/types";
import type { ExpenseCategory } from "@/types";

export function useCategories() {
  const { orgId } = useOrganization();

  const query = useQuery<ExpenseCategory[]>({
    queryKey: ["expense_categories", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ExpenseCategory[];
    },
  });

  /** Match an OCR suggestion string to a category ID using CATEGORY_CODE_MAP */
  function matchCategory(suggestion: string): string | null {
    const categories = query.data ?? [];
    if (!suggestion || categories.length === 0) return null;
    const key = suggestion.toLowerCase().trim();
    const code = CATEGORY_CODE_MAP[key] ?? "OTHER";
    // 1. Exact code match (preferred)
    const byCode = categories.find(c => c.code === code);
    if (byCode) return byCode.id;
    // 2. Exact name match
    const byName = categories.find(c => c.name.toLowerCase() === key);
    if (byName) return byName.id;
    // 3. Fallback to first OTHER/Sonstiges category
    const fallback = categories.find(c => c.code === "OTHER") ?? categories[0];
    return fallback?.id ?? null;
  }

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    matchCategory,
  };
}
