// src/components/transactions/TransactionDetailView.tsx
// Slide-over detail view for a single transaction.
// Shows: amount hero, status badge, lifecycle timeline, reconciliation panel.

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransaction } from "@/hooks/useTransactions";
import { TX_STATUS_COLOR, TX_STATUS_LABEL, TX_STATUS_ICON, TxStatus } from "@/types/transactions";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { formatCurrency } from "@/lib/formatters";

interface TransactionDetailViewProps {
  transactionId: string | null;
  onClose: () => void;
}

// ── Timeline step ─────────────────────────────────────────────────────────────

interface TimelineStep {
  label: string;
  ts: string | null;
  status: TxStatus;
}

function buildTimeline(tx: {
  tx_status: TxStatus;
  authorized_at: string | null;
  cleared_at: string | null;
  settled_at: string | null;
  created_at: string;
}): TimelineStep[] {
  const steps: TimelineStep[] = [
    { label: "Pending",    ts: tx.created_at,     status: "pending" },
    { label: "Authorized", ts: tx.authorized_at,  status: "authorized" },
    { label: "Cleared",    ts: tx.cleared_at,     status: "cleared" },
    { label: "Settled",    ts: tx.settled_at,     status: "settled" },
  ];

  // Insert side-path statuses if applicable
  if (["failed", "reversed", "disputed"].includes(tx.tx_status)) {
    steps.push({
      label: TX_STATUS_LABEL[tx.tx_status],
      ts:    null,
      status: tx.tx_status,
    });
  }

  return steps;
}

const TERMINAL: TxStatus[] = ["settled", "failed", "reversed", "disputed"];

function isReached(step: TimelineStep, current: TxStatus): boolean {
  if (step.ts !== null) return true;
  if (step.status === current) return true;
  const order: TxStatus[] = ["pending", "authorized", "cleared", "settled"];
  const ci = order.indexOf(current);
  const si = order.indexOf(step.status);
  return si >= 0 && ci >= 0 && ci >= si;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransactionDetailView({ transactionId, onClose }: TransactionDetailViewProps) {
  const { data: tx, isLoading } = useTransaction(transactionId);

  return (
    <Sheet open={!!transactionId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Transaction detail</SheetTitle>
        </SheetHeader>

        {isLoading || !tx ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Amount hero ─────────────────────────────────────────────── */}
            <div className="rounded-xl bg-muted/50 p-5 flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {tx.amount != null
                    ? formatCurrency(tx.amount, tx.currency ?? "EUR")
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {tx.merchant_name ?? "Unknown merchant"}
                </p>
                {tx.merchant_mcc && (
                  <p className="text-xs text-muted-foreground">MCC {tx.merchant_mcc}</p>
                )}
              </div>
              <Badge className={TX_STATUS_COLOR[tx.tx_status]}>
                {TX_STATUS_ICON[tx.tx_status]}{" "}
                {TX_STATUS_LABEL[tx.tx_status]}
              </Badge>
            </div>

            {/* ── Metadata ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <MetaItem label="Date">
                {new Date(tx.transaction_date).toLocaleDateString("de-DE", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </MetaItem>
              <MetaItem label="Currency">{tx.currency ?? "EUR"}</MetaItem>
              {tx.provider_tx_id && (
                <MetaItem label="Provider ID" className="col-span-2 font-mono text-xs break-all">
                  {tx.provider_tx_id}
                </MetaItem>
              )}
            </div>

            <Separator />

            {/* ── Lifecycle timeline ───────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Lifecycle
              </p>
              <ol className="space-y-2.5">
                {buildTimeline(tx).map((step) => {
                  const reached = isReached(step, tx.tx_status);
                  const isCurrent = step.status === tx.tx_status;
                  return (
                    <li key={step.label} className="flex items-start gap-3">
                      <div
                        className={[
                          "mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 border-2",
                          isCurrent
                            ? "border-primary bg-primary"
                            : reached
                            ? "border-muted-foreground bg-muted-foreground"
                            : "border-border bg-transparent",
                        ].join(" ")}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={[
                          "text-sm font-medium leading-none",
                          !reached ? "text-muted-foreground/50" : "",
                        ].join(" ")}>
                          {step.label}
                        </p>
                        {step.ts && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(step.ts).toLocaleString("de-DE")}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <Separator />

            {/* ── Reconciliation panel ─────────────────────────────────────── */}
            <ReconciliationPanel transaction={tx} />

            {/* ── Notes ───────────────────────────────────────────────────── */}
            {tx.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-muted-foreground">{tx.notes}</p>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetaItem({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{children}</p>
    </div>
  );
}
