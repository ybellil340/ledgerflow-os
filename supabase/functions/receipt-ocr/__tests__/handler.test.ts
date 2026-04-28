// supabase/functions/receipt-ocr/__tests__/handler.test.ts
// Phase D — Commit 4: Edge function handler tests — metadata persistence & audit logging

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Test the handler logic patterns without requiring Deno runtime ──────────

/**
 * Simulates the edge function's processing pipeline:
 * 1. Insert pending extraction
 * 2. Run OCR provider
 * 3. Update extraction with result
 * 4. Log audit events
 */
interface MockDb {
  insertedExtractions: Record<string, unknown>[];
  updatedExtractions: { id: string; data: Record<string, unknown> }[];
  auditEntries: Record<string, unknown>[];
}

function createMockDb(): MockDb {
  return {
    insertedExtractions: [],
    updatedExtractions: [],
    auditEntries: [],
  };
}

async function simulateHandler(
  db: MockDb,
  userId: string,
  body: { image_base64: string; mime_type: string; expense_id?: string },
  providerResult: Record<string, unknown> | Error,
) {
  // Step 1: Insert pending extraction
  const extractionId = `ext-${Date.now()}`;
  db.insertedExtractions.push({
    id: extractionId,
    user_id: userId,
    expense_id: body.expense_id ?? null,
    status: "processing",
    provider_name: "pending",
  });

  // Step 2: Audit OCR requested
  db.auditEntries.push({
    user_id: userId,
    action: "ocr.requested",
    entity: "ocr_extraction",
    entity_id: extractionId,
    metadata: {
      mime_type: body.mime_type,
      expense_id: body.expense_id ?? null,
      image_size_bytes: body.image_base64.length,
    },
  });

  // Step 3: Run OCR
  if (providerResult instanceof Error) {
    // Failed
    db.updatedExtractions.push({
      id: extractionId,
      data: {
        status: "failed",
        provider_name: "anthropic-vision",
        failure_reason: providerResult.message,
        processed_at: new Date().toISOString(),
      },
    });

    db.auditEntries.push({
      user_id: userId,
      action: "ocr.failed",
      entity: "ocr_extraction",
      entity_id: extractionId,
      metadata: { provider: "anthropic-vision", reason: providerResult.message },
    });

    return { extraction_id: extractionId, status: "failed", result: null, error: providerResult.message };
  }

  // Success
  db.updatedExtractions.push({
    id: extractionId,
    data: {
      status: "completed",
      ...providerResult,
    },
  });

  db.auditEntries.push({
    user_id: userId,
    action: "ocr.succeeded",
    entity: "ocr_extraction",
    entity_id: extractionId,
    metadata: {
      provider: providerResult.provider_name,
      confidence: providerResult.confidence_score,
      merchant: providerResult.merchant_name,
      amount: providerResult.amount,
      warnings_count: (providerResult.warnings as string[])?.length ?? 0,
    },
  });

  return { extraction_id: extractionId, status: "completed", result: providerResult, error: null };
}

describe("Receipt OCR Handler — Metadata Persistence", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("creates pending extraction before running OCR", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc123", mime_type: "image/jpeg" },
      { merchant_name: "Test", amount: 10, confidence_score: 0.9, warnings: [], provider_name: "mock" },
    );

    expect(db.insertedExtractions).toHaveLength(1);
    expect(db.insertedExtractions[0].status).toBe("processing");
    expect(db.insertedExtractions[0].provider_name).toBe("pending");
  });

  it("updates extraction with completed status on success", async () => {
    const result = await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc123", mime_type: "image/jpeg" },
      {
        merchant_name: "REWE",
        amount: 23.45,
        currency: "EUR",
        confidence_score: 0.9,
        warnings: [],
        provider_name: "anthropic-vision",
      },
    );

    expect(result.status).toBe("completed");
    expect(db.updatedExtractions).toHaveLength(1);
    expect(db.updatedExtractions[0].data.status).toBe("completed");
    expect(db.updatedExtractions[0].data.merchant_name).toBe("REWE");
  });

  it("updates extraction with failed status on provider error", async () => {
    const result = await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc123", mime_type: "image/jpeg" },
      new Error("API rate limit exceeded"),
    );

    expect(result.status).toBe("failed");
    expect(result.error).toBe("API rate limit exceeded");
    expect(db.updatedExtractions).toHaveLength(1);
    expect(db.updatedExtractions[0].data.status).toBe("failed");
    expect(db.updatedExtractions[0].data.failure_reason).toBe("API rate limit exceeded");
  });

  it("links extraction to expense_id when provided", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc", mime_type: "image/png", expense_id: "exp-42" },
      { merchant_name: "T", amount: 1, confidence_score: 1, warnings: [], provider_name: "mock" },
    );

    expect(db.insertedExtractions[0].expense_id).toBe("exp-42");
  });

  it("sets expense_id to null when not provided", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc", mime_type: "image/jpeg" },
      { merchant_name: "T", amount: 1, confidence_score: 1, warnings: [], provider_name: "mock" },
    );

    expect(db.insertedExtractions[0].expense_id).toBeNull();
  });
});

describe("Receipt OCR Handler — Audit Logging", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("logs ocr.requested event with image metadata", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "a]".repeat(500), mime_type: "image/jpeg", expense_id: "exp-1" },
      { merchant_name: "X", amount: 1, confidence_score: 1, warnings: [], provider_name: "mock" },
    );

    const requestedEvents = db.auditEntries.filter((e) => e.action === "ocr.requested");
    expect(requestedEvents).toHaveLength(1);
    expect(requestedEvents[0].metadata).toEqual(
      expect.objectContaining({
        mime_type: "image/jpeg",
        expense_id: "exp-1",
      }),
    );
    expect((requestedEvents[0].metadata as Record<string, unknown>).image_size_bytes).toBeGreaterThan(0);
  });

  it("logs ocr.succeeded on success", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc", mime_type: "image/jpeg" },
      {
        merchant_name: "Lidl",
        amount: 55.0,
        confidence_score: 0.85,
        warnings: ["Amount was string, auto-converted to number"],
        provider_name: "anthropic-vision",
      },
    );

    const succeededEvents = db.auditEntries.filter((e) => e.action === "ocr.succeeded");
    expect(succeededEvents).toHaveLength(1);
    expect(succeededEvents[0].metadata).toEqual(
      expect.objectContaining({
        provider: "anthropic-vision",
        confidence: 0.85,
        merchant: "Lidl",
        amount: 55.0,
        warnings_count: 1,
      }),
    );
  });

  it("logs ocr.failed on provider error", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc", mime_type: "image/jpeg" },
      new Error("Connection refused"),
    );

    const failedEvents = db.auditEntries.filter((e) => e.action === "ocr.failed");
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].metadata).toEqual(
      expect.objectContaining({
        provider: "anthropic-vision",
        reason: "Connection refused",
      }),
    );
  });

  it("success flow generates exactly 2 audit events (requested + succeeded)", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc", mime_type: "image/jpeg" },
      { merchant_name: "T", amount: 1, confidence_score: 1, warnings: [], provider_name: "mock" },
    );

    expect(db.auditEntries).toHaveLength(2);
    expect(db.auditEntries.map((e) => e.action)).toEqual(["ocr.requested", "ocr.succeeded"]);
  });

  it("failure flow generates exactly 2 audit events (requested + failed)", async () => {
    await simulateHandler(
      db,
      "user-1",
      { image_base64: "abc", mime_type: "image/jpeg" },
      new Error("Oops"),
    );

    expect(db.auditEntries).toHaveLength(2);
    expect(db.auditEntries.map((e) => e.action)).toEqual(["ocr.requested", "ocr.failed"]);
  });

  it("all audit entries include correct user_id and entity info", async () => {
    await simulateHandler(
      db,
      "user-42",
      { image_base64: "abc", mime_type: "image/jpeg" },
      { merchant_name: "T", amount: 1, confidence_score: 1, warnings: [], provider_name: "mock" },
    );

    for (const entry of db.auditEntries) {
      expect(entry.user_id).toBe("user-42");
      expect(entry.entity).toBe("ocr_extraction");
      expect(entry.entity_id).toBeTruthy();
    }
  });
});
