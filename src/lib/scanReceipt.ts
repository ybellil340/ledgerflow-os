export async function scanReceipt(base64: string, mimeType = "image/jpeg") {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_KEY || "";

  // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
  const cleanBase64 = base64.indexOf("base64,") !== -1 ? base64.split("base64,")[1] : base64;
  const cleanMime = base64.startsWith("data:") ? base64.split(":")[1].split(";")[0] : mimeType;
  const isPdf = cleanMime === "application/pdf";

  const prompt = `Extract data from this receipt/invoice. Return ONLY valid JSON:
{"merchant_name":"","amount":0,"currency":"EUR","date":"YYYY-MM-DD","description":"","category_suggestion":"Other","vat_amount":0,"vat_rate":0}
Fill in actual values. category_suggestion must be one of: Travel, Software & SaaS, Meals & Entertainment, Equipment, Marketing, Office Supplies, Utilities, Professional Services, Other.`;

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
