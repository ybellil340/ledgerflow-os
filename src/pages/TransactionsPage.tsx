// src/pages/TransactionsPage.tsx
// Transactions list page: summary cards, filter chips, searchable table, slide-over detail.
// Read-only view — writes only happen via TransactionDetailView → ReconciliationPanel.

import { useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { TransactionDetailView } from "@/components/transactions/TransactionDetailView";
import { DataPageLayout } from "@/components/DataPageLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  TX_STATUS_COLOR,
  TX_STATUS_LABEL,
  TX_STATUS_ICON,
  TxStatus,
  TxFilterStatus,
  TxFilters,
  DEFAULT_TX_FILTERS,
} from "@/types/transactions";
import { formatCurrency } from "@/lib/formatters";
import { Search, ArrowUpDown, CheckCircle2 } from "lucide-react";

// ── Summary card data ─────────────────────────────────────────────────────────

const SUMMARY_STATUSES: TxStatus[] = ["pending", "authorized", "cleared", "settled"];

// ── Filter chips ──────────────────────────────────────────────────────────────

const FILTER_CHIPS: { label: string; value: TxFilterStatus }[] = [
  { label: "All",        value: "all" },
  { label: "Pending",    value: "pending" },
  { label: "Authorized", value: "authorized" },
  { label: "Cleared",    value: "cleared" },
  { label: "Settled",    value: "settled" },
  { label: "Failed",     value: "failed" },
  { label: "Reversed",   value: "reversed" },
  { label: "Disputed",   value: "disputed" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TxFilters>(DEFAULT_TX_FILTERS);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useTransactions({ filters, page });
  const transactions = data?.data ?? [];
  const totalCount   = data?.count ?? 0;

  // Summary counts: always fetch "all" for summary cards
  const { data: allData } = useTransactions({ filters: DEFAULT_TX_FILTERS, page: 0 });
  const allTx = allData?.data ?? [];

  const summaryCards = SUMMARY_STATUSES.map((status) => {
    const txsForStatus = allTx.filter((t) => t.tx_status === status);
    const total = txsForStatus.reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return {
      status,
      count: txsForStatus.length,
      total,
      currency: txsForStatus[0]?.currency ?? "EUR",
    };
  });

  function setFilter<K extends keyof TxFilters>(key: K, value: TxFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }

  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <DataPageLayout title="Transactions" subtitle="Bank card transaction lifecycle">
      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {summaryCards.map(({ status, count, total, currency }) => (
          <Card
            key={status}
            className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            onClick={() => setFilter("status", status)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {TX_STATUS_ICON[status]} {TX_STATUS_LABEL[status]}
                </span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  {count}
                </Badge>
              </div>
              <p className="text-lg font-bold tracking-tight">
                {formatCurrency(total, currency)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search merchant…"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setFilter("status", chip.value)}
              className={[
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                filters.status === chip.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ].join(" ")}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => {
                    setFilter("sortField", "transaction_date");
                    setFilter("sortDir", filters.sortDir === "asc" ? "desc" : "asc");
                  }}
                >
                  Date <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Merchant</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                <button
                  className="flex items-center gap-1 hover:text-foreground ml-auto"
                  onClick={() => {
                    setFilter("sortField", "amount");
                    setFilter("sortDir", filters.sortDir === "asc" ? "desc" : "asc");
                  }}
                >
                  Amount <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Reconciled</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : transactions.length === 0
              ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                )
              : transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedId(tx.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(tx.transaction_date).toLocaleDateString("de-DE", {
                        day: "2-digit", month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium truncate max-w-[180px]">
                      {tx.merchant_name ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={TX_STATUS_COLOR[tx.tx_status] + " text-xs"}>
                        {TX_STATUS_LABEL[tx.tx_status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {tx.amount != null
                        ? formatCurrency(tx.amount, tx.currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.is_reconciled
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        : <span className="text-muted-foreground/30 text-lg leading-none">·</span>}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Slide-over ─────────────────────────────────────────────────────── */}
      <TransactionDetailView
        transactionId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </DataPageLayout>
  );
}
