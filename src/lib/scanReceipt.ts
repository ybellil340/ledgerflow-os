export async function scanReceipt(base64: string, mimeType = "image/jpeg") {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_KEY || "";
  const isPdf = mimeType === "application/pdf";
  const content: any[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
    {
      type: "text",
      text: `Extract all data from this receipt or invoice. Return ONLY valid JSON with these exact fields:
{
  "merchant_name": "string",
  "amount": number (total amount as number),
  "currency": "EUR",
  "date": "YYYY-MM-DD",
  "description": "brief description of what was purchased",
  "category_suggestion": "one of: Travel, Software & SaaS, Meals & Entertainment, Equipment, Marketing, Office Supplies, Utilities, Professional Services, Other",
  "vat_amount": number (VAT/MwSt amount as number, 0 if not found),
  "vat_rate": number (VAT rate as percentage number e.g. 19, 0 if not found)
}
No markdown, no explanation, just the JSON object.`
    }
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, messages: [{ role: "user", content }] })
  });

  if (!res.ok) return { data: null, error: new Error("OCR failed: " + res.status) };
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
