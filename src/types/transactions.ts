// src/types/transactions.ts
// Canonical transaction types, state machine, and UI helpers.

// ── Status type ───────────────────────────────────────────────────────────────

export type TxStatus =
  | "pending"
  | "authorized"
  | "cleared"
  | "settled"
  | "failed"
  | "reversed"
  | "disputed";

// ── State machine ─────────────────────────────────────────────────────────────
// Mirror of supabase/migrations/20260327_tx_state_guard.sql
// and supabase/functions/webhook-process/index.ts ALLOWED_TRANSITIONS.

export const ALLOWED_TRANSITIONS: Record<TxStatus, TxStatus[]> = {
  pending:    ["authorized", "failed"],
  authorized: ["cleared", "failed", "reversed", "disputed"],
  cleared:    ["settled", "reversed", "disputed"],
  settled:    ["disputed"],
  disputed:   ["settled", "reversed"],
  failed:     [],   // terminal
  reversed:   [],   // terminal
};

// ── UI helpers ────────────────────────────────────────────────────────────────

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  pending:    "Pending",
  authorized: "Authorized",
  cleared:    "Cleared",
  settled:    "Settled",
  failed:     "Failed",
  reversed:   "Reversed",
  disputed:   "Disputed",
};

export const TX_STATUS_COLOR: Record<TxStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-800",
  authorized: "bg-blue-100 text-blue-800",
  cleared:    "bg-cyan-100 text-cyan-800",
  settled:    "bg-green-100 text-green-800",
  failed:     "bg-red-100 text-red-800",
  reversed:   "bg-orange-100 text-orange-800",
  disputed:   "bg-purple-100 text-purple-800",
};

export const TX_STATUS_ICON: Record<TxStatus, string> = {
  pending:    "⏳",
  authorized: "🔐",
  cleared:    "✅",
  settled:    "💰",
  failed:     "❌",
  reversed:   "↩️",
  disputed:   "⚠️",
};

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  org_id: string;
  card_id: string | null;
  provider_tx_id: string | null;
  webhook_event_id: string | null;
  tx_status: TxStatus;
  amount: number | null;
  currency: string;
  merchant_name: string | null;
  merchant_mcc: string | null;
  transaction_date: string;
  authorized_at: string | null;
  cleared_at: string | null;
  settled_at: string | null;
  expense_id: string | null;
  is_reconciled: boolean;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string;
  idempotency_key: string;
  raw_payload: Record<string, unknown>;
  status: "pending" | "processing" | "processed" | "failed" | "dead";
  attempts: number;
  last_error: string | null;
  org_id: string | null;
  processed_at: string | null;
  created_at: string;
}

// ── Filter / sort options (used by TransactionsPage) ──────────────────────────

export type TxFilterStatus = TxStatus | "all";
export type TxSortField = "transaction_date" | "amount" | "merchant_name";
export type TxSortDir = "asc" | "desc";

export interface TxFilters {
  status: TxFilterStatus;
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
  sortField: TxSortField;
  sortDir: TxSortDir;
}

export const DEFAULT_TX_FILTERS: TxFilters = {
  status:    "all",
  search:    "",
  dateFrom:  null,
  dateTo:    null,
  sortField: "transaction_date",
  sortDir:   "desc",
};
