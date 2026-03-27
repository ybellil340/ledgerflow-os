// supabase/functions/webhook-ingest/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function verifySignature(provider: string, req: Request, rawBody: string): Promise<boolean> {
  if (provider === "mock") {
    const secret = req.headers.get("x-webhook-signature");
    const expected = Deno.env.get("MOCK_WEBHOOK_SECRET") ?? "mock-dev-secret";
    return secret === expected;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return err(405, "Method not allowed");

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") ?? "mock";
  const rawBody = await req.text();

  const valid = await verifySignature(provider, req, rawBody);
  if (!valid) return err(401, "Invalid webhook signature");

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); }
  catch { return err(400, "Invalid JSON payload"); }

  const providerEventId = (payload["id"] ?? payload["event_id"] ?? payload["webhook_id"]) as string | undefined;
  if (!providerEventId) return err(400, "Payload missing event ID");

  const idempotencyKey = provider + "::" + providerEventId;

  const { data: event, error: insertErr } = await supabaseAdmin
    .from("webhook_events")
    .upsert(
      { provider, event_type: (payload["type"] as string) ?? "unknown", idempotency_key: idempotencyKey, raw_payload: payload, status: "pending" },
      { onConflict: "idempotency_key", ignoreDuplicates: true }
    )
    .select("id, status")
    .single();

  if (insertErr) {
    console.error("[webhook-ingest] DB insert error:", insertErr);
    return err(500, "Failed to persist event");
  }

  if (!event || event.status !== "pending") return ok({ received: true, duplicate: true });

  const processUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/webhook-process";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const processPromise = fetch(processUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + serviceKey },
    body: JSON.stringify({ eventId: event.id }),
  }).catch((e: any) => console.error("[webhook-ingest] failed to trigger processor:", e.message));

  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined") { // @ts-ignore
    EdgeRuntime.waitUntil(processPromise);
  }

  return ok({ received: true, eventId: event.id });
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...CORS, "Content-Type": "application/json" } });
}
function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS });
}
