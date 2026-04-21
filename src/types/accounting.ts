// src/types/accounting.ts
// Phase C: Type definitions for export batches, export records, and period locks

export type ExportType =
  | "datev_expenses"
  | "datev_ap"
  | "datev_ar"
  | "datev_reimbursements"
  | "datev_journal"
  | "csv_generic";

export type ExportBatchStatus = "pending" | "processing" | "completed" | "failed";

export type PeriodLockStatus = "locked" | "unlocked";

export type AccountingSourceTable =
  | "expenses"
  | "reimbursements"
  | "ap_invoices"
  | "ar_invoices"
  | "transactions";

// âââ Export Batches ââââââââââââââââââââââââââââââââââââââââââ
export interface ExportBatch {
  id: string;
  org_id: string;
  export_type: ExportType;
  period_start: string; // DATE as ISO string
  period_end: string;
  status: ExportBatchStatus;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  file_path: string | null;
  file_hash: string | null;
  record_count: number;
  version: number;
  supersedes_batch_id: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateExportBatchRequest {
  export_type: ExportType;
  period_start: string;
  period_end: string;
  include_expenses?: boolean;
  include_ap?: boolean;
  include_ar?: boolean;
  include_reimbursements?: boolean;
  consultant_number?: string;
  client_number?: string;
}

// âââ Export Records ââââââââââââââââââââââââââââââââââââââââââ
export interface ExportRecord {
  id: string;
  batch_id: string;
  source_table: AccountingSourceTable;
  source_id: string;
  source_status_snapshot: string;
  source_hash: string;
  created_at: string;
}

// âââ Period Locks ââââââââââââââââââââââââââââââââââââââââââââ
export interface PeriodLock {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  lock_status: PeriodLockStatus;
  locked_by: string;
  locked_at: string;
  unlocked_at: string | null;
  notes: string | null;
}

export interface CreatePeriodLockRequest {
  period_start: string;
  period_end: string;
  notes?: string;
}

// âââ Stale Export Detection ââââââââââââââââââââââââââââââââââ
export interface StaleExportCheck {
  batch_id: string;
  is_stale: boolean;
  changed_records: Array<{
    source_table: AccountingSourceTable;
    source_id: string;
    field_changed: string;
  }>;
}

// âââ Export Generation Response ââââââââââââââââââââââââââââââ
export interface ExportGenerateResponse {
  batch_id: string;
  status: ExportBatchStatus;
  record_count: number;
  file_path: string | null;
  download_url: string | null;
  validation_errors: string[];
}
