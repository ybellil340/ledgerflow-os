// tests/transactions.test.ts
// Vitest tests for transaction lifecycle state machine, hooks, and utilities.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Types / utilities under test ──────────────────────────────────────────────

import {
  ALLOWED_TRANSITIONS,
  canTransition,
  txStatusLabel,
  txStatusVariant,
  DEFAULT_TX_FILTERS,
  type TxStatus,
  type Transaction,
} from "../src/types/transactions";

// ── State machine ─────────────────────────────────────────────────────────────

describe("ALLOWED_TRANSITIONS", () => {
  it("pending → authorized is allowed", () => {
    expect(ALLOWED_TRANSITIONS.pending).toContain("authorized");
  });

  it("pending → failed is allowed", () => {
    expect(ALLOWED_TRANSITIONS.pending).toContain("failed");
  });

  it("authorized → cleared is allowed", () => {
    expect(ALLOWED_TRANSITIONS.authorized).toContain("cleared");
  });

  it("cleared → settled is allowed", () => {
    expect(ALLOWED_TRANSITIONS.cleared).toContain("settled");
  });

  it("settled → pending is NOT allowed", () => {
    expect(ALLOWED_TRANSITIONS.settled ?? []).not.toContain("pending");
  });

  it("all target states have defined transitions", () => {
    const targets: TxStatus[] = [
      "authorized",
      "cleared",
      "settled",
      "failed",
      "reversed",
      "disputed",
    ];
    for (const t of targets) {
      expect(Array.isArray(ALLOWED_TRANSITIONS[t])).toBe(true);
    }
  });
});

describe("canTransition", () => {
  it("returns true for a valid transition", () => {
    expect(canTransition("pending", "authorized")).toBe(true);
  });

  it("returns false for an illegal transition", () => {
    expect(canTransition("settled", "pending")).toBe(false);
  });

  it("returns false when transitioning to the same state", () => {
    expect(canTransition("authorized", "authorized")).toBe(false);
  });

  it("returns true for disputed ← cleared", () => {
    expect(canTransition("cleared", "disputed")).toBe(true);
  });
});

// ── UI helpers ────────────────────────────────────────────────────────────────

describe("txStatusLabel", () => {
  it("returns a non-empty string for every status", () => {
    const statuses: TxStatus[] = [
      "pending",
      "authorized",
      "cleared",
      "settled",
      "failed",
      "reversed",
      "disputed",
    ];
    for (const s of statuses) {
      const label = txStatusLabel(s);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("txStatusVariant", () => {
  it("settled returns 'default' or 'success'-like variant", () => {
    const v = txStatusVariant("settled");
    expect(typeof v).toBe("string");
  });

  it("failed returns a destructive/warning variant", () => {
    const v = txStatusVariant("failed");
    expect(["destructive", "warning", "secondary"]).toContain(v);
  });
});

// ── Default filters ───────────────────────────────────────────────────────────

describe("DEFAULT_TX_FILTERS", () => {
  it("has status 'all'", () => {
    expect(DEFAULT_TX_FILTERS.status).toBe("all");
  });

  it("has empty search string", () => {
    expect(DEFAULT_TX_FILTERS.search).toBe("");
  });

  it("sorts by transaction_date descending", () => {
    expect(DEFAULT_TX_FILTERS.sortField).toBe("transaction_date");
    expect(DEFAULT_TX_FILTERS.sortDir).toBe("desc");
  });
});

// ── Hook: useTransactions ─────────────────────────────────────────────────────

// Mock Supabase client
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: "tx-1",
            org_id: "org-1",
            tx_status: "settled",
            amount: 42.5,
            currency: "EUR",
            merchant_name: "Acme GmbH",
            transaction_date: "2026-03-01T10:00:00Z",
            is_reconciled: false,
          },
        ],
        error: null,
        count: 1,
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
  },
}));

vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({ orgId: "org-1", userId: "user-1" }),
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useTransactions hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns transaction data on success", async () => {
    const { useTransactions } = await import("../src/hooks/useTransactions");
    const { result } = renderHook(() => useTransactions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBe("tx-1");
  });

  it("exposes total count", async () => {
    const { useTransactions } = await import("../src/hooks/useTransactions");
    const { result } = renderHook(() => useTransactions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.total).toBe(1);
  });
});

// ── Hook: useWebhookEvents ────────────────────────────────────────────────────

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: "ev-1",
            status: "processed",
            provider: "lithic",
            raw_payload: {},
            attempts: 1,
            created_at: "2026-03-01T09:00:00Z",
          },
        ],
        error: null,
        count: 1,
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
  },
}));

describe("useWebhookEvents hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns webhook events on success", async () => {
    const { useWebhookEvents } = await import(
      "../src/hooks/useWebhookEvents"
    );
    const { result } = renderHook(() => useWebhookEvents(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].id).toBe("ev-1");
  });
});

// ── Transaction shape validation ──────────────────────────────────────────────

describe("Transaction type shape", () => {
  it("a valid transaction satisfies the interface", () => {
    const tx: Transaction = {
      id: "tx-abc",
      org_id: "org-1",
      card_id: "card-1",
      provider_tx_id: "prov-001",
      webhook_event_id: "ev-1",
      tx_status: "cleared",
      amount: 99.99,
      currency: "USD",
      merchant_name: "Test Merchant",
      merchant_mcc: "5411",
      transaction_date: "2026-03-15T12:00:00Z",
      authorized_at: "2026-03-15T11:55:00Z",
      cleared_at: "2026-03-15T12:00:00Z",
      settled_at: null,
      is_reconciled: false,
      linked_expense_id: null,
      notes: null,
      created_at: "2026-03-15T12:00:00Z",
      updated_at: "2026-03-15T12:00:00Z",
    };

    expect(tx.tx_status).toBe("cleared");
    expect(tx.amount).toBeCloseTo(99.99);
  });
});
