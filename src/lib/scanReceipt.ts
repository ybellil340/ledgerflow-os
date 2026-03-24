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

export async function scanReceipt(base64: string, mimeType = "image/jpeg") {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_KEY || "";

  const cleanBase64 = stripDataUrl(base64);
  const cleanMime = getMime(base64, mimeType);
  const isPdf = cleanMime === "application/pdf";

  const prompt = `Extract all data from this receipt or invoice. Return ONLY valid JSON:
{
  "merchant_name": "",
  "amount": 0,
  "currency": "EUR",
  "date": "YYYY-MM-DD",
  "description": "",
  "category_suggestion": "Other",
  "vat_amount": 0,
  "vat_rate": 0,
  "tax_registration_number": ""
}
Fill actual values. category_suggestion: Travel, Software & SaaS, Meals & Entertainment, Equipment, Marketing, Office Supplies, Utilities, Professional Services, or Other.
Return ONLY JSON.`;

  const content: any[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: cleanBase64 } }
      : { type: "image", source: { type: "base64", media_type: cleanMime, data: cleanBase64 } },
    { type: "text", text: prompt }
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { data: null, error: new Error("OCR failed: " + (err?.error?.message || res.status)) };
  }
  try {
    const j = await res.json();
    const raw = j.content[0].text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    return { data: JSON.parse(raw.slice(start, end + 1)), error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
