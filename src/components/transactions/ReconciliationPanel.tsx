// src/components/transactions/ReconciliationPanel.tsx
// Shows linked expense (if any) or an expense picker to reconcile.
// Uses useLinkExpense / useUnlinkExpense from useTransactions.
// Only rendered for 'cleared' or 'settled' transactions.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useLinkExpense, useUnlinkExpense } from "@/hooks/useTransactions";
import { Transaction } from "@/types/transactions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { Link2, Link2Off, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category: string | null;
}

// ── ExpensePicker (dropdown) ──────────────────────────────────────────────────

function ExpensePicker({
  txAmount,
  orgId,
  onSelect,
  disabled,
}: {
  txAmount: number | null;
  orgId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses-for-picker", orgId],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, description, amount, currency, date, category")
        .eq("org_id", orgId)
        .is("transaction_id", null) // unreconciled only
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    staleTime: 30_000,
  });

  // Sort: exact amount match first, then ascending delta
  const sorted = txAmount != null
    ? [...expenses].sort((a, b) => {
        const da = Math.abs(a.amount - txAmount);
        const db = Math.abs(b.amount - txAmount);
        return da - db;
      })
    : expenses;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isLoading} className="w-full">
          {isLoading ? "Loading expenses…" : "Select expense to link"}
          <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-h-64 overflow-y-auto" align="start">
        {sorted.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No unreconciled expenses found
          </div>
        ) : (
          sorted.map((exp) => {
            const delta = txAmount != null ? Math.abs(exp.amount - txAmount) : null;
            const isMatch = delta !== null && delta < 0.01;
            return (
              <DropdownMenuItem
                key={exp.id}
                onSelect={() => onSelect(exp.id)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="font-medium text-sm truncate max-w-[180px]">
                    {exp.description || "No description"}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-semibold">
                      {formatCurrency(exp.amount, exp.currency)}
                    </span>
                    {isMatch && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-green-100 text-green-700">
                        match
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(exp.date).toLocaleDateString("de-DE")}
                  {exp.category ? ` · ${exp.category}` : ""}
                </span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── ReconciliationPanel ────────────────────────────────────────────────────────

interface ReconciliationPanelProps {
  transaction: Transaction;
}

export function ReconciliationPanel({ transaction }: ReconciliationPanelProps) {
  const { orgId } = useOrganization();
  const linkExpense   = useLinkExpense();
  const unlinkExpense = useUnlinkExpense();
  const [error, setError] = useState<string | null>(null);

  const canReconcile = ["cleared", "settled"].includes(transaction.tx_status);

  // Fetch linked expense details if reconciled
  const { data: linkedExpense } = useQuery({
    queryKey: ["expense", transaction.expense_id],
    queryFn: async (): Promise<Expense | null> => {
      if (!transaction.expense_id) return null;
      const { data, error } = await supabase
        .from("expenses")
        .select("id, description, amount, currency, date, category")
        .eq("id", transaction.expense_id)
        .single();
      if (error) return null;
      return data as Expense;
    },
    enabled: !!transaction.expense_id,
    staleTime: 60_000,
  });

  const handleLink = async (expenseId: string) => {
    setError(null);
    try {
      await linkExpense.mutateAsync({
        transactionId: transaction.id,
        expenseId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    }
  };

  const handleUnlink = async () => {
    setError(null);
    try {
      await unlinkExpense.mutateAsync({ transactionId: transaction.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlink failed");
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Reconciliation
      </p>

      {!canReconcile ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-dashed px-3 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Transaction must be cleared or settled to reconcile
        </div>
      ) : transaction.is_reconciled && linkedExpense ? (
        /* ── Linked state ─────────────────────────────────────────────────── */
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Reconciled</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleUnlink}
              disabled={unlinkExpense.isPending}
            >
              <Link2Off className="h-3 w-3 mr-1" />
              Unlink
            </Button>
          </div>
          <div className="text-sm space-y-0.5">
            <p className="font-medium">{linkedExpense.description || "Expense"}</p>
            <p className="text-muted-foreground text-xs">
              {formatCurrency(linkedExpense.amount, linkedExpense.currency)}
              {" · "}
              {new Date(linkedExpense.date).toLocaleDateString("de-DE")}
              {linkedExpense.category ? ` · ${linkedExpense.category}` : ""}
            </p>
          </div>
        </div>
      ) : (
        /* ── Unlinked state ────────────────────────────────────────────────── */
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="h-4 w-4 shrink-0" />
            No expense linked yet
          </div>
          {orgId && (
            <ExpensePicker
              txAmount={transaction.amount}
              orgId={orgId}
              onSelect={handleLink}
              disabled={linkExpense.isPending}
            />
          )}
          {linkExpense.isPending && (
            <p className="text-xs text-muted-foreground">Linking…</p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
