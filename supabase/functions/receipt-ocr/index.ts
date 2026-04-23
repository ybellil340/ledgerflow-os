// supabase/functions/receipt-ocr/index.ts
// Phase D: Server-side receipt OCR processing edge function
// Accepts image, runs OCR via provider, persists extraction, logs audit events.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOcrProvider } from "../_shared/ocrProvider.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface OcrRequestBody {
  image_base64: string;
  mime_type: string;
  expense_id?: string;
  receipt_path?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Authenticate caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: OcrRequestBody = await req.json();

    if (!body.image_base64 || !body.mime_type) {
      return new Response(
        JSON.stringify({ error: "image_base64 and mime_type are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 1. Create pending extraction record
    const { data: extraction, error: insertErr } = await supabase
      .from("ocr_extractions")
      .insert({
        user_id: user.id,
        expense_id: body.expense_id ?? null,
        status: "processing",
        provider_name: "pending", // updated after provider selected
      })
      .select("id")
      .single();

    if (insertErr || !extraction) {
      throw new Error(`Failed to create extraction record: ${insertErr?.message}`);
    }

    const extractionId = extraction.id;

    // 2. Audit: OCR requested
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "ocr.requested",
      entity: "ocr_extraction",
      entity_id: extractionId,
      metadata: {
        mime_type: body.mime_type,
        expense_id: body.expense_id ?? null,
        image_size_bytes: body.image_base64.length,
      },
    });

    // 3. Run OCR via provider
    const provider = createOcrProvider();
    let result;

    try {
      result = await provider.extract(body.image_base64, body.mime_type);
    } catch (ocrError: unknown) {
      const reason = ocrError instanceof Error ? ocrError.message : String(ocrError);

      // Update extraction as failed
      await supabase
        .from("ocr_extractions")
        .update({
          status: "failed",
          provider_name: provider.name,
          failure_reason: reason,
          processed_at: new Date().toISOString(),
        })
        .eq("id", extractionId);

      // Audit: OCR failed
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "ocr.failed",
        entity: "ocr_extraction",
        entity_id: extractionId,
        metadata: { provider: provider.name, reason },
      });

      return new Response(
        JSON.stringify({
          extraction_id: extractionId,
          status: "failed",
          result: null,
          error: reason,
        }),
        {
          status: 200, // 200 with status=failed so client can handle gracefully
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // 4. Persist successful extraction
    await supabase
      .from("ocr_extractions")
      .update({
        status: "completed",
        provider_name: result.provider_name,
        confidence_score: result.confidence_score,
        merchant_name: result.merchant_name,
        receipt_number: result.receipt_number,
        invoice_number: result.invoice_number,
        amount: result.amount,
        currency: result.currency,
        tax_amount: result.tax_amount,
        transaction_date: result.transaction_date,
        warnings: result.warnings,
        raw_provider_metadata: result.raw_provider_metadata,
        processed_at: result.processed_at,
      })
      .eq("id", extractionId);

    // 5. Audit: OCR succeeded
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "ocr.succeeded",
      entity: "ocr_extraction",
      entity_id: extractionId,
      metadata: {
        provider: result.provider_name,
        confidence: result.confidence_score,
        merchant: result.merchant_name,
        amount: result.amount,
        warnings_count: result.warnings.length,
      },
    });

    // 6. Return result
    return new Response(
      JSON.stringify({
        extraction_id: extractionId,
        status: "completed",
        result,
        error: null,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[receipt-ocr] Unexpected error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
