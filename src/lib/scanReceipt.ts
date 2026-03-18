export async function scanReceipt(base64: string, mimeType = "image/jpeg") {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_KEY || "";
  const isPdf = mimeType === "application/pdf";

  const prompt = `Extract all data from this receipt or invoice. Return ONLY valid JSON:
{
  "merchant_name": "string",
  "amount": number,
  "currency": "string (3-letter ISO code e.g. EUR USD AED TND GBP)",
  "date": "YYYY-MM-DD",
  "description": "brief description of purchase",
  "category_suggestion": "one of: Travel, Software & SaaS, Meals & Entertainment, Equipment, Marketing, Office Supplies, Utilities, Professional Services, Other",
  "vat_amount": number (0 if not found),
  "vat_rate": number (0 if not found)
}
No markdown, no explanation, just the JSON object.`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };

  if (isPdf) headers["anthropic-beta"] = "pdfs-2024-09-25";

  const content: any[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
    { type: "text", text: prompt }
  ];

  // Try models in order until one works
  const models = isPdf
    ? ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"]
    : ["claude-3-5-sonnet-20241022", "claude-opus-4-20250514", "claude-3-haiku-20240307"];

  for (const model of models) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content }] })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // If model not found, try next
      if (err?.error?.type === "not_found_error" || res.status === 404) continue;
      return { data: null, error: new Error("OCR failed: " + (err?.error?.message || res.status)) };
    }

    try {
      const j = await res.json();
      const text = j.content[0].text.trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      return { data: JSON.parse(text.slice(start, end + 1)), error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  }

  return { data: null, error: new Error("OCR failed: no available model") };
}
