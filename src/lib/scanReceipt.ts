export async function scanReceipt(base64: string) {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_KEY || "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: "Extract receipt data. Return ONLY valid JSON: {\"merchant_name\":\"\",\"amount\":0,\"currency\":\"EUR\",\"date\":\"\",\"description\":\"\"}" }
        ]
      }]
    })
  });
  if (!res.ok) return { data: null, error: new Error("OCR failed: " + res.status) };
  try {
    const j = await res.json();
    const text = j.content[0].text.trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const data = JSON.parse(text.slice(start, end + 1));
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
