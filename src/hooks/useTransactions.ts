// src/hooks/useTransactions.ts
// React Query hooks for the transactions data layer.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Transaction, TxFilters, DEFAULT_TX_FILTERS } from "@/types/transactions";

const PAGE_SIZE = 50;

// ── useTransactions ───────────────────────────────────────────────────────────
// Paginated, filtered list of transactions for the current org.

interface UseTransactionsOptions {
  filters?: Partial<TxFilters>;
  page?: number;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { orgId } = useOrganization();
  const filters: TxFilters = { ...DEFAULT_TX_FILTERS, ...options.filters };
  const page = options.page ?? 0;

  return useQuery({
    queryKey: ["transactions", orgId, filters, page],
    queryFn: async (): Promise<{ data: Transaction[]; count: number }> => {
      let query = supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .eq("org_id", orgId!)
        .order(filters.sortField, { ascending: filters.sortDir === "asc" })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.status !== "all") {
        query = query.eq("tx_status", filters.status);
      }

      if (filters.search) {
        query = query.ilike("merchant_name", `%${filters.search}%`);
      }

      if (filters.dateFrom) {
        query = query.gte("transaction_date", filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte("transaction_date", filters.dateTo + "T23:59:59Z");
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as Transaction[], count: count ?? 0 };
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

// ── useTransaction ────────────────────────────────────────────────────────────
// Single transaction by id.

export function useTransaction(transactionId: string | null) {
  return useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: async (): Promise<Transaction> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId!)
        .single();
      if (error) throw error;
      return data as Transaction;
    },
    enabled: !!transactionId,
    staleTime: 30_000,
  });
}

// ── useLinkExpense ────────────────────────────────────────────────────────────
// Link a transaction to an expense via the transaction-link-expense edge fn.

export function useLinkExpense() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      expenseId,
    }: {
      transactionId: string;
      expenseId: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transaction-link-expense`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ transactionId, expenseId }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Link failed (${res.status})`);
      }

      return res.json();
    },
    onSuccess: (_data, { transactionId }) => {
      qc.invalidateQueries({ queryKey: ["transaction", transactionId] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ── useUnlinkExpense ──────────────────────────────────────────────────────────

export function useUnlinkExpense() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId }: { transactionId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transaction-link-expense`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ transactionId }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Unlink failed (${res.status})`);
      }

      return res.json();
    },
    onSuccess: (_data, { transactionId }) => {
      qc.invalidateQueries({ queryKey: ["transaction", transactionId] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
