// src/hooks/useOcrExtraction.ts
// Phase D: React hook for OCR extraction workflow

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scanReceipt } from "@/lib/scanReceipt";
import type { OcrExtraction, OcrStatus } from "@/types/ocr";

interface UseOcrExtractionReturn {
  /** Current status of the OCR operation */
  status: OcrStatus | "idle";
  /** Extraction result after successful OCR */
  extraction: Partial<OcrExtraction> | null;
  /** Parsed receipt fields for form pre-fill */
  fields: {
    merchant_name: string;
    amount: number;
    date: string;
    currency: string;
    tax_amount: number | null;
    receipt_number: string | null;
    confidence: number;
    warnings: string[];
  } | null;
  /** Error message if OCR failed */
  error: string | null;
  /** Extraction ID for linking */
  extractionId: string | null;
  /** Trigger OCR on an image */
  processReceipt: (base64: string, mimeType?: string, expenseId?: string) => Promise<void>;
  /** Retry last failed OCR */
  retry: () => Promise<void>;
  /** Submit manual corrections to an extraction */
  correctExtraction: (corrections: Partial<OcrExtraction>) => Promise<void>;
  /** Reset state */
  reset: () => void;
}

export function useOcrExtraction(): UseOcrExtractionReturn {
  const [status, setStatus] = useState<OcrStatus | "idle">("idle");
  const [extraction, setExtraction] = useState<Partial<OcrExtraction> | null>(null);
  const [fields, setFields] = useState<UseOcrExtractionReturn["fields"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<{ base64: string; mimeType: string; expenseId?: string } | null>(null);

  const processReceipt = useCallback(async (base64: string, mimeType = "image/jpeg", expenseId?: string) => {
    setStatus("processing");
    setError(null);
    setFields(null);
    setExtraction(null);
    setLastInput({ base64, mimeType, expenseId });

    try {
      const result = await scanReceipt(base64, mimeType, expenseId);

      setExtractionId(result.extraction_id);
      setFields({
        merchant_name: result.merchant_name,
        amount: result.amount,
        date: result.date,
        currency: result.currency,
        tax_amount: result.tax_amount,
        receipt_number: result.receipt_number,
        confidence: result.confidence,
        warnings: result.warnings,
      });
      setExtraction({
        id: result.extraction_id,
        merchant_name: result.merchant_name,
        amount: result.amount,
        currency: result.currency,
        tax_amount: result.tax_amount,
        receipt_number: result.receipt_number,
        transaction_date: result.date,
        confidence_score: result.confidence,
        warnings: result.warnings,
        status: "completed",
      });
      setStatus("completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("failed");
    }
  }, []);

  const retry = useCallback(async () => {
    if (!lastInput) return;
    await processReceipt(lastInput.base64, lastInput.mimeType, lastInput.expenseId);
  }, [lastInput, processReceipt]);

  const correctExtraction = useCallback(async (corrections: Partial<OcrExtraction>) => {
    if (!extractionId) return;

    const { error: updateErr } = await supabase
      .from("ocr_extractions")
      .update({
        ...corrections,
        manually_corrected: true,
        corrected_at: new Date().toISOString(),
      })
      .eq("id", extractionId);

    if (updateErr) {
      throw new Error(`Failed to save corrections: ${updateErr.message}`);
    }

    // Audit: manual correction
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "ocr.corrected",
        entity: "ocr_extraction",
        entity_id: extractionId,
        metadata: { corrected_fields: Object.keys(corrections) },
      });
    }

    // Update local state
    setExtraction((prev) => prev ? { ...prev, ...corrections, manually_corrected: true } : prev);
    if (fields) {
      setFields({
        ...fields,
        ...(corrections.merchant_name != null ? { merchant_name: corrections.merchant_name } : {}),
        ...(corrections.amount != null ? { amount: corrections.amount } : {}),
        ...(corrections.currency != null ? { currency: corrections.currency } : {}),
        ...(corrections.tax_amount !== undefined ? { tax_amount: corrections.tax_amount ?? null } : {}),
        ...(corrections.transaction_date != null ? { date: corrections.transaction_date } : {}),
        ...(corrections.receipt_number != null ? { receipt_number: corrections.receipt_number } : {}),
      });
    }
  }, [extractionId, fields]);

  const reset = useCallback(() => {
    setStatus("idle");
    setExtraction(null);
    setFields(null);
    setError(null);
    setExtractionId(null);
    setLastInput(null);
  }, []);

  return {
    status,
    extraction,
    fields,
    error,
    extractionId,
    processReceipt,
    retry,
    correctExtraction,
    reset,
  };
}
