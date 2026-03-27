// supabase/functions/webhook-process/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseWebhookEvent, NormalizedEvent } from "../_shared/eventParser.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";

const MAX_ATTEMPTS = 5;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");

  let eventId: string | undefined;
  try { const body = await req.json(); eventId = body.eventId; }
  catch { return err(400, "Invalid JSON"); }
  if (!eventId) return err(400, "eventId is required");

  const { data: event, error: claimErr } = await supabaseAdmin
    .from("webhook_events")
    .update({ status: "processing" })
    .eq("id", eventId)
    .in("status", ["pending", "failed"])
    .select("id, provider, raw_payload, attempts, org_id")
    .single();

  if (claimErr || !event) return ok({ skipped: true, reason: "not in processable state" });

  try {
    const normalized: NormalizedEvent = parseWebhookEvent(event.provider, event.raw_payload as Record<string, unknown>);

    let orgId: string | null = event.org_id ?? null;
    if (!orgId && normalized.providerCardId) {
      const { data: card } = await supabaseAdmin.from("cards").select("org_id").eq("provider_card_id", normalized.providerCardId).single();
      orgId = card?.org_id ?? null;
    }

    let cardDbId: string | null = null;
    if (normalized.providerCardId) {
      const { data: card } = await supabaseAdmin.from("cards").select("id").eq("provider_card_id", normalized.providerCardId).single();
      cardDbId = card?.id ?? null;
    }

    if (normalized.providerTxId && normalized.txStatus && normalized.eventClass.startsWith("transaction.")) {
      await upsertTransaction(normalized, event.id, orgId, cardDbId);
    }

    await supabaseAdmin.from("webhook_events").update({
      status: "processed", processed_at: new Date().toISOString(),
      org_id: orgId, attempts: event.attempts + 1, last_error: null,
    }).eq("id", eventId);

    if (orgId) {
      await writeAuditLog({ orgId, userId: "system", action: "webhook." + normalized.eventClass,
        entityType: "webhook_event", entityId: eventId,
        metadata: { provider: event.provider, providerTxId: normalized.providerTxId, eventClass: normalized.eventClass, txStatus: normalized.txStatus },
      });
    }
    return ok({ processed: true, eventId, eventClass: normalized.eventClass });

  } catch (e: any) {
    console.error("[webhook-process] error:", e);
    const newAttempts = (event.attempts ?? 0) + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? "dead" : "failed";
    await supabaseAdmin.from("webhook_events").update({ status: newStatus, attempts: newAttempts, last_error: e.message ?? String(e) }).eq("id", eventId);
    return err(500, e.message ?? "Processing failed");
  }
});

async function upsertTransaction(ev: NormalizedEvent, webhookEventId: string, orgId: string | null, cardId: string | null): Promise<void> {
  if (!orgId) return;
  const tsMap: Record<string, string> = { authorized: "authorized_at", cleared: "cleared_at", settled: "settled_at" };
  const tsKey = ev.txStatus ? tsMap[ev.txStatus] : null;
  const payload: Record<string, unknown> = {
    org_id: orgId, card_id: cardId, provider_tx_id: ev.providerTxId,
    webhook_event_id: webhookEventId, tx_status: ev.txStatus,
    amount: ev.amountCents != null ? ev.amountCents / 100 : null,
    currency: ev.currency, merchant_name: ev.merchantName, merchant_mcc: ev.merchantMcc,
    transaction_date: ev.eventTimestamp ?? new Date().toISOString(),
  };
  if (tsKey) payload[tsKey] = ev.eventTimestamp ?? new Date().toISOString();
  const { error } = await supabaseAdmin.from("transactions").upsert(payload, { onConflict: "org_id,provider_tx_id", ignoreDuplicates: false });
  if (error) throw error;
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...CORS, "Content-Type": "application/json" } });
}
function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS });
}
