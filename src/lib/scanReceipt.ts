export async function scanReceipt(imageBase64: string): Promise<{ data: any; error: any }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY || "",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
        { type: "text", text: 'Extract receipt data. Reply ONLY with JSON: {"merchant_name":"string","amount":0.00,"currency":"EUR","date":"YYYY-MM-DD","description":"string"}' }
      ]}]
    }),
  });
  if (!res.ok) return { data: null, error: new Error(`OCR failed: ${res.status}`) };
  const json = await res.json();
  try { return { data: JSON.parse(json.content[0].text.replace(/```json\n?/g,"").replace(/```/g,"")), error: null }; }
  catch { return { data: null, error: new Error("Could not parse OCR response") }; }
}
