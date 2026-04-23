// supabase/functions/_shared/ocrProvider.ts
// Phase D: OCR provider abstraction — server-side only

/** Normalized extraction result (mirrors src/types/ocr.ts for server use) */
export interface OcrExtractionResult {
  merchant_name: string | null;
  receipt_number: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  tax_amount: number | null;
  transaction_date: string | null;
  confidence_score: number;
  warnings: string[];
  raw_provider_metadata: Record<string, unknown> | null;
  provider_name: string;
  processed_at: string;
}

/** Provider interface */
export interface OcrProvider {
  readonly name: string;
  extract(imageBase64: string, mimeType: string): Promise<OcrExtractionResult>;
}

// ─── Anthropic Vision Provider ─────────────────────────────────────────────

const EXTRACTION_PROMPT = `Extract all data from this receipt or invoice. Return ONLY valid JSON:
{
  "merchant_name": "string or null",
  "receipt_number": "string or null",
  "invoice_number": "string or null",
  "amount": number_or_null,
  "currency": "EUR",
  "tax_amount": number_or_null,
  "transaction_date": "YYYY-MM-DD or null"
}
If a field cannot be determined, use null. Use ISO date format. Amount should be a number, not a string.`;

export class AnthropicVisionProvider implements OcrProvider {
  readonly name = "anthropic-vision";
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Anthropic API key is required");
    this.apiKey = apiKey;
  }

  async extract(imageBase64: string, mimeType: string): Promise<OcrExtractionResult> {
    const mediaType = mimeType === "application/pdf" ? "application/pdf" : mimeType;
    const sourceType = mimeType === "application/pdf" ? "base64" : "base64";

    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: sourceType, media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const text: string = data.content?.[0]?.text ?? "";

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Anthropic response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const warnings: string[] = [];

    // Validate and normalize
    if (parsed.amount != null && typeof parsed.amount === "string") {
      const num = parseFloat(parsed.amount.replace(/[^\d.,-]/g, "").replace(",", "."));
      parsed.amount = isNaN(num) ? null : num;
      warnings.push("Amount was string, auto-converted to number");
    }

    if (parsed.tax_amount != null && typeof parsed.tax_amount === "string") {
      const num = parseFloat(parsed.tax_amount.replace(/[^\d.,-]/g, "").replace(",", "."));
      parsed.tax_amount = isNaN(num) ? null : num;
      warnings.push("Tax amount was string, auto-converted to number");
    }

    // Confidence heuristic: count non-null fields
    const extractedFields = [
      parsed.merchant_name, parsed.amount, parsed.currency,
      parsed.transaction_date, parsed.receipt_number ?? parsed.invoice_number,
    ];
    const filledCount = extractedFields.filter((f) => f != null).length;
    const confidence = Math.min(filledCount / extractedFields.length, 1);

    if (confidence < 0.5) {
      warnings.push("Low confidence extraction — manual review recommended");
    }

    return {
      merchant_name: parsed.merchant_name ?? null,
      receipt_number: parsed.receipt_number ?? null,
      invoice_number: parsed.invoice_number ?? null,
      amount: parsed.amount ?? null,
      currency: parsed.currency ?? "EUR",
      tax_amount: parsed.tax_amount ?? null,
      transaction_date: parsed.transaction_date ?? null,
      confidence_score: confidence,
      warnings,
      raw_provider_metadata: { model: "claude-sonnet-4-20250514", usage: data.usage ?? null },
      provider_name: this.name,
      processed_at: new Date().toISOString(),
    };
  }
}

// ─── Mock Provider (dev/test) ──────────────────────────────────────────────

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock";

  async extract(_imageBase64: string, _mimeType: string): Promise<OcrExtractionResult> {
    return {
      merchant_name: "Mock GmbH",
      receipt_number: "MOCK-001",
      invoice_number: null,
      amount: 42.99,
      currency: "EUR",
      tax_amount: 6.86,
      transaction_date: new Date().toISOString().split("T")[0],
      confidence_score: 0.95,
      warnings: ["Mock provider — not for production use"],
      raw_provider_metadata: { mock: true },
      provider_name: this.name,
      processed_at: new Date().toISOString(),
    };
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

export function createOcrProvider(): OcrProvider {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (key) {
    return new AnthropicVisionProvider(key);
  }
  console.warn("[OCR] No ANTHROPIC_API_KEY set — falling back to MockOcrProvider");
  return new MockOcrProvider();
}
