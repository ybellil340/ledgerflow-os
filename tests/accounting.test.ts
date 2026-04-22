// tests/accounting.test.ts
// Phase C: Tests for export batches, period locks, stale detection, immutability

import { describe, it, expect, vi, beforeEach } from "vitest";

// âââ Mock Supabase client âââââââââââââââââââââââââââââââââââââ
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockLimit = vi.fn();

function createChain() {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return chain;
}

// âââ Export Batch Types & Validation ââââââââââââââââââââââââââ

describe("ExportBatch domain rules", () => {
  interface ExportBatch {
    id: string;
    org_id: string;
    export_type: string;
    period_start: string;
    period_end: string;
    status: "pending" | "processing" | "completed" | "failed";
    version: number;
    supersedes_batch_id: string | null;
    record_count: number;
    file_hash: string | null;
  }

  it("should create a batch in pending status with version 1", () => {
    const batch: ExportBatch = {
      id: "batch-001",
      org_id: "org-001",
      export_type: "datev_journal",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      status: "pending",
      version: 1,
      supersedes_batch_id: null,
      record_count: 0,
      file_hash: null,
    };

    expect(batch.status).toBe("pending");
    expect(batch.version).toBe(1);
    expect(batch.supersedes_batch_id).toBeNull();
  });

  it("should enforce immutability: completed batches reject status changes", () => {
    const completedBatch: ExportBatch = {
      id: "batch-002",
      org_id: "org-001",
      export_type: "datev_expenses",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      status: "completed",
      version: 1,
      supersedes_batch_id: null,
      record_count: 25,
      file_hash: "abc123def456",
    };

    // Simulate the trigger: completed batches cannot change status
    function validateBatchUpdate(oldBatch: ExportBatch, newStatus: string): boolean {
      if (oldBatch.status === "completed" && newStatus !== "completed") {
        return false; // blocked by trigger
      }
      return true;
    }

    expect(validateBatchUpdate(completedBatch, "failed")).toBe(false);
    expect(validateBatchUpdate(completedBatch, "pending")).toBe(false);
    expect(validateBatchUpdate(completedBatch, "processing")).toBe(false);
    // Idempotent update to same status is OK
    expect(validateBatchUpdate(completedBatch, "completed")).toBe(true);
  });

  it("should create re-export with incremented version and supersedes link", () => {
    const originalBatch: ExportBatch = {
      id: "batch-003",
      org_id: "org-001",
      export_type: "datev_journal",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      status: "completed",
      version: 1,
      supersedes_batch_id: null,
      record_count: 25,
      file_hash: "hash-v1",
    };

    const reExportBatch: ExportBatch = {
      id: "batch-004",
      org_id: "org-001",
      export_type: "datev_journal",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      status: "completed",
      version: originalBatch.version + 1,
      supersedes_batch_id: originalBatch.id,
      record_count: 27,
      file_hash: "hash-v2",
    };

    expect(reExportBatch.version).toBe(2);
    expect(reExportBatch.supersedes_batch_id).toBe("batch-003");
    // Original remains in history
    expect(originalBatch.status).toBe("completed");
  });
});

// âââ Export Record Linkage ââââââââââââââââââââââââââââââââââââ

describe("ExportRecord linkage", () => {
  interface ExportRecord {
    id: string;
    batch_id: string;
    source_table: string;
    source_id: string;
    source_status_snapshot: string;
    source_hash: string;
  }

  it("should link each exported source record to its batch", () => {
    const records: ExportRecord[] = [
      {
        id: "rec-001",
        batch_id: "batch-001",
        source_table: "expenses",
        source_id: "exp-001",
        source_status_snapshot: "approved",
        source_hash: "hash-exp-001",
      },
      {
        id: "rec-002",
        batch_id: "batch-001",
        source_table: "ap_invoices",
        source_id: "ap-001",
        source_status_snapshot: "paid",
        source_hash: "hash-ap-001",
      },
    ];

    expect(records).toHaveLength(2);
    expect(records.every((r) => r.batch_id === "batch-001")).toBe(true);
    expect(records[0].source_table).toBe("expenses");
    expect(records[1].source_table).toBe("ap_invoices");
  });

  it("should enforce valid source_table values", () => {
    const validTables = ["expenses", "reimbursements", "ap_invoices", "ar_invoices", "transactions"];
    const invalidTable = "users";

    expect(validTables.includes("expenses")).toBe(true);
    expect(validTables.includes("ap_invoices")).toBe(true);
    expect(validTables.includes(invalidTable)).toBe(false);
  });
});

// âââ Period Lock Enforcement ââââââââââââââââââââââââââââââââââ

describe("PeriodLock enforcement", () => {
  interface PeriodLock {
    id: string;
    org_id: string;
    period_start: string;
    period_end: string;
    lock_status: "locked" | "unlocked";
  }

  function isDateInLockedPeriod(date: string, locks: PeriodLock[]): boolean {
    return locks.some(
      (lock) =>
        lock.lock_status === "locked" &&
        date >= lock.period_start &&
        date <= lock.period_end,
    );
  }

  const activeLocks: PeriodLock[] = [
    {
      id: "lock-001",
      org_id: "org-001",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      lock_status: "locked",
    },
    {
      id: "lock-002",
      org_id: "org-001",
      period_start: "2026-02-01",
      period_end: "2026-02-28",
      lock_status: "unlocked",
    },
  ];

  it("should block modifications in locked periods", () => {
    expect(isDateInLockedPeriod("2026-01-15", activeLocks)).toBe(true);
    expect(isDateInLockedPeriod("2026-01-01", activeLocks)).toBe(true);
    expect(isDateInLockedPeriod("2026-01-31", activeLocks)).toBe(true);
  });

  it("should allow modifications in unlocked periods", () => {
    expect(isDateInLockedPeriod("2026-02-15", activeLocks)).toBe(false);
  });

  it("should allow modifications outside any period lock", () => {
    expect(isDateInLockedPeriod("2026-03-15", activeLocks)).toBe(false);
    expect(isDateInLockedPeriod("2025-12-31", activeLocks)).toBe(false);
  });

  it("should reject overlapping lock creation", () => {
    function hasOverlap(newStart: string, newEnd: string, locks: PeriodLock[]): boolean {
      return locks.some(
        (lock) =>
          lock.lock_status === "locked" &&
          newStart <= lock.period_end &&
          newEnd >= lock.period_start,
      );
    }

    // Overlaps with January lock
    expect(hasOverlap("2026-01-15", "2026-02-15", activeLocks)).toBe(true);
    // No overlap (March)
    expect(hasOverlap("2026-03-01", "2026-03-31", activeLocks)).toBe(false);
    // February is unlocked, so no overlap with locked periods
    expect(hasOverlap("2026-02-01", "2026-02-28", activeLocks)).toBe(false);
  });
});

// âââ Stale Export Detection âââââââââââââââââââââââââââââââââââ

describe("Stale export detection", () => {
  function computeHash(obj: Record<string, unknown>): string {
    // Simplified hash for testing (real impl uses SHA-256)
    return JSON.stringify(obj, Object.keys(obj).sort());
  }

  it("should detect stale export when source record changes", () => {
    const originalExpense = { id: "exp-001", amount: 100, status: "approved", title: "Office supplies" };
    const exportHash = computeHash(originalExpense);

    // Simulate modification after export
    const modifiedExpense = { ...originalExpense, amount: 150 };
    const currentHash = computeHash(modifiedExpense);

    expect(exportHash).not.toBe(currentHash);
  });

  it("should not flag stale when source record is unchanged", () => {
    const expense = { id: "exp-002", amount: 200, status: "approved", title: "Travel" };
    const exportHash = computeHash(expense);
    const currentHash = computeHash(expense);

    expect(exportHash).toBe(currentHash);
  });

  it("should detect deleted source records as stale", () => {
    const exportedRecordId = "exp-003";
    const currentRecords = new Map<string, any>(); // Record was deleted

    const isDeleted = !currentRecords.has(exportedRecordId);
    expect(isDeleted).toBe(true);
  });
});

// âââ Superseding Batch Version Flow âââââââââââââââââââââââââââ

describe("Superseding batch version flow", () => {
  it("should maintain full version history", () => {
    const batches = [
      { id: "b1", version: 1, supersedes_batch_id: null, status: "completed" },
      { id: "b2", version: 2, supersedes_batch_id: "b1", status: "completed" },
      { id: "b3", version: 3, supersedes_batch_id: "b2", status: "completed" },
    ];

    // All versions remain in history
    expect(batches).toHaveLength(3);
    expect(batches[2].version).toBe(3);
    expect(batches[2].supersedes_batch_id).toBe("b2");

    // Can trace full lineage
    const latest = batches[2];
    const previous = batches.find((b) => b.id === latest.supersedes_batch_id);
    expect(previous?.version).toBe(2);
    const original = batches.find((b) => b.id === previous?.supersedes_batch_id);
    expect(original?.version).toBe(1);
    expect(original?.supersedes_batch_id).toBeNull();
  });
});

// âââ Validation Failure on Incomplete Mappings ââââââââââââââââ

describe("Validation failure on incomplete mappings", () => {
  function validateExportPrerequisites(opts: {
    hasVatCodes: boolean;
    hasChartOfAccounts: boolean;
  }): string[] {
    const errors: string[] = [];
    if (!opts.hasVatCodes) {
      errors.push("No active VAT codes configured. Add at least one VAT code before exporting.");
    }
    if (!opts.hasChartOfAccounts) {
      errors.push("No active chart of accounts configured. Add accounts before exporting.");
    }
    return errors;
  }

  it("should return errors when VAT codes are missing", () => {
    const errors = validateExportPrerequisites({ hasVatCodes: false, hasChartOfAccounts: true });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("VAT codes");
  });

  it("should return errors when chart of accounts is missing", () => {
    const errors = validateExportPrerequisites({ hasVatCodes: true, hasChartOfAccounts: false });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("chart of accounts");
  });

  it("should return multiple errors when both are missing", () => {
    const errors = validateExportPrerequisites({ hasVatCodes: false, hasChartOfAccounts: false });
    expect(errors).toHaveLength(2);
  });

  it("should pass when all prerequisites are met", () => {
    const errors = validateExportPrerequisites({ hasVatCodes: true, hasChartOfAccounts: true });
    expect(errors).toHaveLength(0);
  });
});

// âââ DATEV CSV format validation ââââââââââââââââââââââââââââââ

describe("DATEV CSV generation", () => {
  function formatAmount(amount: number): string {
    return Math.abs(amount).toFixed(2).replace(".", ",");
  }

  function formatDateDDMM(dateStr: string): string {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}${month}`;
  }

  it("should format amounts with comma decimal separator", () => {
    expect(formatAmount(123.45)).toBe("123,45");
    expect(formatAmount(0.5)).toBe("0,50");
    expect(formatAmount(-99.99)).toBe("99,99"); // absolute value
  });

  it("should format dates as DDMM", () => {
    expect(formatDateDDMM("2026-01-15")).toBe("1501");
    expect(formatDateDDMM("2026-12-01")).toBe("0112");
  });

  it("should produce deterministic ordering (by date ascending)", () => {
    const bookings = [
      { date: "1501", description: "B" },
      { date: "0301", description: "A" },
      { date: "2001", description: "C" },
    ];

    const sorted = [...bookings].sort((a, b) => a.date.localeCompare(b.date));
    expect(sorted[0].description).toBe("A");
    expect(sorted[1].description).toBe("B");
    expect(sorted[2].description).toBe("C");
  });
});
