import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl, imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userContent: any[] = [
      {
        type: "text",
        text: `Analyze this receipt/invoice image and extract the following information as accurately as possible. Return ONLY a valid JSON object with these fields:

{
  "merchant_name": "Name of the merchant/vendor",
  "amount": 0.00,
  "currency": "EUR",
  "date": "YYYY-MM-DD",
  "description": "Brief description of the purchase",
  "vat_amount": 0.00,
  "vat_rate": 0.0,
  "tax_registration_number": "VAT/TRN number if visible",
  "category_suggestion": "One of: Travel, Software & SaaS, Meals & Entertainment, Equipment, Marketing, Office Supplies, Training & Education, Consulting Fees, Other"
}

Rules:
- If a field is not visible, use null
- amount should be the total including VAT
- vat_rate should be a percentage number (e.g. 19 for 19%)
- date should be in YYYY-MM-DD format
- Return ONLY the JSON, no markdown or extra text`
      }
    ];

    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64 }
      });
    } else if (imageUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    } else {
      throw new Error("No image provided");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response, handling potential markdown wrapping
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = null;
    }

    return new Response(JSON.stringify({ success: true, data: parsed, raw: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-receipt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
