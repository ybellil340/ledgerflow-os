// src/hooks/__tests__/useOcrExtraction.test.ts
// Phase D — Commit 4: Hook state management, retry, corrections, audit logging

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockScanReceipt = vi.fn();
vi.mock("@/lib/scanReceipt", () => ({
  scanReceipt: (...args: unknown[]) => mockScanReceipt(...args),
}));

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "user-123" } },
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "ocr_extractions") return { update: mockUpdate };
      if (table === "audit_log") return { insert: mockInsert };
      return {};
    },
    auth: { getUser: mockGetUser },
  },
}));

import { useOcrExtraction } from "@/hooks/useOcrExtraction";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useOcrExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useOcrExtraction());

    expect(result.current.status).toBe("idle");
    expect(result.current.fields).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.extractionId).toBeNull();
  });

  it("transitions idle → processing → completed on success", async () => {
    mockScanReceipt.mockResolvedValueOnce({
      merchant_name: "REWE",
      amount: 23.45,
      date: "2026-04-20",
      currency: "EUR",
      tax_amount: 3.75,
      receipt_number: "R-1",
      confidence: 0.9,
      extraction_id: "ext-1",
      warnings: [],
    });

    const { result } = renderHook(() => useOcrExtraction());

    await act(async () => {
      await result.current.processReceipt("base64", "image/jpeg");
    });

    expect(result.current.status).toBe("completed");
    expect(result.current.fields).toEqual({
      merchant_name: "REWE",
      amount: 23.45,
      date: "2026-04-20",
      currency: "EUR",
      tax_amount: 3.75,
      receipt_number: "R-1",
      confidence: 0.9,
      warnings: [],
    });
    expect(result.current.extractionId).toBe("ext-1");
    expect(result.current.error).toBeNull();
  });

  it("transitions to failed on error", async () => {
    mockScanReceipt.mockRejectedValueOnce(new Error("Timeout"));

    const { result } = renderHook(() => useOcrExtraction());

    await act(async () => {
      await result.current.processReceipt("base64", "image/jpeg");
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("Timeout");
    expect(result.current.fields).toBeNull();
  });

  it("retry re-processes with last input", async () => {
    mockScanReceipt
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        merchant_name: "Aldi",
        amount: 10,
        date: "2026-04-21",
        currency: "EUR",
        tax_amount: null,
        receipt_number: null,
        confidence: 0.8,
        extraction_id: "ext-2",
        warnings: [],
      });

    const { result } = renderHook(() => useOcrExtraction());

    // First attempt fails
    await act(async () => {
      await result.current.processReceipt("b64data", "image/png", "exp-1");
    });
    expect(result.current.status).toBe("failed");

    // Retry succeeds
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.status).toBe("completed");
    expect(result.current.fields?.merchant_name).toBe("Aldi");

    // Verify retry used same arguments
    expect(mockScanReceipt).toHaveBeenCalledTimes(2);
    expect(mockScanReceipt.mock.calls[1]).toEqual(["b64data", "image/png", "exp-1"]);
  });

  it("retry does nothing when no previous input", async () => {
    const { result } = renderHook(() => useOcrExtraction());

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe("idle");
    expect(mockScanReceipt).not.toHaveBeenCalled();
  });

  it("reset returns to idle state", async () => {
    mockScanReceipt.mockResolvedValueOnce({
      merchant_name: "Test",
      amount: 1,
      date: "2026-01-01",
      currency: "EUR",
      tax_amount: null,
      receipt_number: null,
      confidence: 1,
      extraction_id: "ext-3",
      warnings: [],
    });

    const { result } = renderHook(() => useOcrExtraction());

    await act(async () => {
      await result.current.processReceipt("b64");
    });
    expect(result.current.status).toBe("completed");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.fields).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.extractionId).toBeNull();
  });

  it("correctExtraction updates DB and logs audit event", async () => {
    mockScanReceipt.mockResolvedValueOnce({
      merchant_name: "Wrong Name",
      amount: 99,
      date: "2026-04-20",
      currency: "EUR",
      tax_amount: null,
      receipt_number: null,
      confidence: 0.7,
      extraction_id: "ext-4",
      warnings: [],
    });

    const eqMock = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: eqMock });

    const { result } = renderHook(() => useOcrExtraction());

    await act(async () => {
      await result.current.processReceipt("b64");
    });

    await act(async () => {
      await result.current.correctExtraction({
        merchant_name: "Correct Name",
        amount: 100,
      });
    });

    // Verify DB update was called
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_name: "Correct Name",
        amount: 100,
        manually_corrected: true,
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "ext-4");

    // Verify audit log entry
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        action: "ocr.corrected",
        entity: "ocr_extraction",
        entity_id: "ext-4",
        metadata: { corrected_fields: ["merchant_name", "amount"] },
      }),
    );
  });

  it("correctExtraction does nothing without extractionId", async () => {
    const { result } = renderHook(() => useOcrExtraction());

    await act(async () => {
      await result.current.correctExtraction({ merchant_name: "Test" });
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
