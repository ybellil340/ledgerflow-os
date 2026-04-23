// src/lib/scanReceipt.ts
// Phase D: REWIRED — all OCR processing now happens server-side.
// This client helper uploads the image and calls the receipt-ocr edge function.
// NO secrets are used or exposed in the browser.

import { supabase } from "@/integrations/supabase/client";
import type { OcrRequest, OcrResponse } from "@/types/ocr";

function stripDataUrl(s: string): string {
  // Remove data URL prefix like "data:image/jpeg;base64," if present
  const comma = s.lastIndexOf(",");
  return comma !== -1 ? s.substring(comma + 1) : s;
}

function getMime(s: string, fallback: string): string {
  if (!s.startsWith("data:")) return fallback;
  const colon = s.indexOf(":");
  const semi = s.indexOf(";");
  return s.substring(colon + 1, semi);
}

/**
 * Send a receipt image to the server-side OCR edge function.
 * Returns the normalized extraction result.
 *
 * @param base64 - Raw base64 or data-url encoded image
 * @param mimeType - MIME type hint (default: image/jpeg)
 * @param expenseId - Optional expense to link the extraction to
 */
export async function scanReceipt(
  base64: string,
  mimeType = "image/jpeg",
  expenseId?: string,
): Promise<{
  merchant_name: string;
  amount: number;
  date: string;
  currency: string;
  category: string;
  tax_amount: number | null;
  receipt_number: string | null;
  confidence: number;
  extraction_id: string;
  warnings: string[];
}> {
  const cleanBase64 = stripDataUrl(base64);
  const cleanMime = getMime(base64, mimeType);

  const payload: OcrRequest = {
    image_base64: cleanBase64,
    mime_type: cleanMime,
    expense_id: expenseId,
  };

  const { data, error } = await supabase.functions.invoke<OcrResponse>("receipt-ocr", {
    body: payload,
  });

  if (error) {
    throw new Error(`OCR request failed: ${error.message}`);
  }

  if (!data || data.status === "failed") {
    throw new Error(data?.error ?? "OCR extraction failed — no result returned");
  }

  const r = data.result;
  if (!r) {
    throw new Error("OCR completed but returned no extraction result");
  }

  // Map to the shape the existing UI expects (backward compat)
  return {
    merchant_name: r.merchant_name ?? "Unknown",
    amount: r.amount ?? 0,
    date: r.transaction_date ?? new Date().toISOString().split("T")[0],
    currency: r.currency ?? "EUR",
    category: "", // category assignment remains client-side
    tax_amount: r.tax_amount,
    receipt_number: r.receipt_number ?? r.invoice_number,
    confidence: r.confidence_score,
    extraction_id: data.extraction_id,
    warnings: r.warnings,
  };
}
