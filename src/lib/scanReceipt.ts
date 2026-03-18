export interface OcrResult {
  merchant_name: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
}

export async function scanReceipt(imageBase64: string): Promise<{ data: OcrResult | null; error: Error | null }> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY || "";
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_KEY not set") };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
          { type: "text", text: 'Extract data from this receipt or invoice. Reply ONLY with raw JSON, no markdown. Format: {"merchant_name":"string","amount":0.00,"currency":"EUR","date":"YYYY-MM-DD","description":"string"}' },
        ],
      }],
    }),
  });

  if (!res.ok) return { data: null, error: new Error("OCR request failed: " + res.status) };

  const json = await res.json();
  try {
    const raw = (json.content?.[0]?.text || "{}").replace(/```json
?/g, "").replace(/```/g, "").trim();
    return { data: JSON.parse(raw) as OcrResult, error: null };
  } catch {
    return { data: null, error: new Error("Could not parse OCR response") };
  }
}
