// src/types/ocr.ts
// Phase D: OCR provider abstraction types — shared between client and server

/** Normalized fields extracted from a receipt/invoice by any OCR provider */
export interface OcrExtractionResult {
  merchant_name: string | null;
  receipt_number: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  tax_amount: number | null;
  transaction_date: string | null; // ISO date string
  confidence_score: number; // 0–1
  warnings: string[];
  raw_provider_metadata: Record<string, unknown> | null;
  provider_name: string;
  processed_at: string; // ISO timestamp
}

/** Status of an OCR extraction job */
export type OcrStatus = "pending" | "processing" | "completed" | "failed";

/** Row shape for the ocr_extractions table */
export interface OcrExtraction {
  id: string;
  receipt_id: string | null;
  expense_id: string | null;
  user_id: string;
  provider_name: string;
  status: OcrStatus;
  confidence_score: number | null;
  merchant_name: string | null;
  receipt_number: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  tax_amount: number | null;
  transaction_date: string | null;
  warnings: string[];
  raw_provider_metadata: Record<string, unknown> | null;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  manually_corrected: boolean;
  corrected_at: string | null;
  corrected_by: string | null;
}

/** Input for the receipt-ocr edge function */
export interface OcrRequest {
  /** base64 image data (without data-url prefix) */
  image_base64: string;
  /** MIME type of the image */
  mime_type: string;
  /** Optional expense ID to link to */
  expense_id?: string;
  /** Optional receipt storage path */
  receipt_path?: string;
}

/** Response from the receipt-ocr edge function */
export interface OcrResponse {
  extraction_id: string;
  status: OcrStatus;
  result: OcrExtractionResult | null;
  error: string | null;
}

/** Provider interface — implemented by each OCR backend */
export interface OcrProvider {
  readonly name: string;
  extract(imageBase64: string, mimeType: string): Promise<OcrExtractionResult>;
}
