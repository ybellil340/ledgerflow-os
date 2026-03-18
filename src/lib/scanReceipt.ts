export async function scanReceipt(base64: string, mimeType = "image/jpeg") {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_KEY || "";
  
  // Anthropic API: images use "image" type, PDFs use "document" type
  const isPdf = mimeType === "application/pdf";
  const content: any[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
    { type: "text", text: "Extract receipt/invoice data. Return ONLY valid JSON: {\"merchant_name\":\"\",\"amount\":0,\"currency\":\"EUR\",\"date\":\"YYYY-MM-DD\",\"description\":\"\"}" }
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
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 512, messages: [{ role: "user", content }] })
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
