export async function scanReceipt(base64: string, mimeType = "image/jpeg") {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_KEY || "";
  const isPdf = mimeType === "application/pdf";

  const prompt = `Extract all data from this receipt or invoice. Return ONLY valid JSON with these exact fields:
{"merchant_name":"","amount":0,"currency":"EUR","date":"YYYY-MM-DD","description":"","category_suggestion":"Travel","vat_amount":0,"vat_rate":0}
Use the actual values from the document. category_suggestion must be one of: Travel, Software & SaaS, Meals & Entertainment, Equipment, Marketing, Office Supplies, Utilities, Professional Services, Other.
Return ONLY the JSON, no markdown, no explanation.`;

  const content: any[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
    { type: "text", text: prompt }
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (isPdf) headers["anthropic-beta"] = "pdfs-2024-09-25";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
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
