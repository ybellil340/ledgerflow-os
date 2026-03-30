// supabase/functions/webhook-process/index.ts
// Phase B: Transaction lifecycle state machine + card/account event handlers.
// Changes from Phase A:
//   • ALLOWED_TRANSITIONS enforced before any DB write
//   • upsertTransactionLifecycle() replaces upsertTransaction()
//   • handleCardEvent() updates cards table on card.* events
//   • handleAccountEvent() logs account.updated events
//   • Per-event audit log entry with lifecycle timestamp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseWebhookEvent, NormalizedEvent } from "../_shared/eventParser.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";

const MAX_ATTEMPTS = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── State machine ─────────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  authorized: ["pending"],
  cleared:    ["authorized"],
  settled:    ["cleared", "disputed"],
  failed:     ["pending", "authorized"],
  reversed:   ["authorized", "cleared", "disputed"],
  disputed:   ["authorized", "cleared", "settled"],
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer "))
    return errRes(401, "Unauthorized");

  let eventId: string | undefined;
  try {
    const body = await req.json();
    eventId = body.eventId;
  } catch {
    return errRes(400, "Invalid JSON");
  }

  if (!eventId) return errRes(400, "eventId is required");

  // Claim the event atomically
  const { data: event, error: claimErr } = await supabaseAdmin
    .from("webhook_events")
    .update({ status: "processing" })
    .eq("id", eventId)
    .in("status", ["pending", "failed"])
    .select("id, provider, raw_payload, attempts, org_id")
    .single();

  if (claimErr || !event)
    return okRes({ skipped: true, reason: "not in processable state" });

  try {
    const normalized: NormalizedEvent = parseWebhookEvent(
      event.provider,
      event.raw_payload as Record<string, unknown>
    );

    // Resolve org_id if not already on the event
    let orgId: string | null = event.org_id ?? null;
    if (!orgId && normalized.providerCardId) {
      const { data: card } = await supabaseAdmin
        .from("cards")
        .select("org_id")
        .eq("provider_card_id", normalized.providerCardId)
        .single();
      orgId = card?.org_id ?? null;
    }

    // Resolve card DB id
    let cardDbId: string | null = null;
    if (normalized.providerCardId) {
      const { data: card } = await supabaseAdmin
        .from("cards")
        .select("id")
        .eq("provider_card_id", normalized.providerCardId)
        .single();
      cardDbId = card?.id ?? null;
    }

    // ── Route by event class ──────────────────────────────────────────────────
    const ec = normalized.eventClass;

    if (ec.startsWith("transaction.") && normalized.providerTxId && normalized.txStatus) {
      await upsertTransactionLifecycle(normalized, event.id, orgId, cardDbId);
    } else if (ec.startsWith("card.") && cardDbId) {
      await handleCardEvent(normalized, cardDbId, orgId);
    } else if (ec === "account.updated") {
      await handleAccountEvent(normalized, orgId);
    }
    // "unknown" events are accepted and logged but not acted upon

    // Mark event as processed
    await supabaseAdmin
      .from("webhook_events")
      .update({
        status:       "processed",
        processed_at: new Date().toISOString(),
        org_id:       orgId,
        attempts:     event.attempts + 1,
        last_error:   null,
      })
      .eq("id", eventId);

    // Audit log
    if (orgId) {
      await writeAuditLog({
        orgId,
        userId:     "system",
        action:     "webhook." + ec,
        entityType: "webhook_event",
        entityId:   eventId,
        metadata: {
          provider:      event.provider,
          providerTxId:  normalized.providerTxId,
          providerCardId: normalized.providerCardId,
          eventClass:    ec,
          txStatus:      normalized.txStatus,
        },
      });
    }

    return okRes({ processed: true, eventId, eventClass: ec });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webhook-process] error:", msg);

    const newAttempts = (event.attempts ?? 0) + 1;
    const newStatus   = newAttempts >= MAX_ATTEMPTS ? "dead" : "failed";

    await supabaseAdmin
      .from("webhook_events")
      .update({ status: newStatus, attempts: newAttempts, last_error: msg })
      .eq("id", eventId);

    return errRes(500, msg);
  }
});

// ── Transaction lifecycle upsert with state machine ───────────────────────────

async function upsertTransactionLifecycle(
  ev: NormalizedEvent,
  webhookEventId: string,
  orgId: string | null,
  cardId: string | null
): Promise<void> {
  if (!orgId || !ev.providerTxId || !ev.txStatus) return;

  // Check existing status for transition validation
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id, tx_status")
    .eq("org_id", orgId)
    .eq("provider_tx_id", ev.providerTxId)
    .maybeSingle();

  const targetStatus = ev.txStatus;

  if (existing) {
    const currentStatus = existing.tx_status as string;

    if (currentStatus === targetStatus) {
      // Idempotent — already in target state, skip
      return;
    }

    const allowedOrigins = ALLOWED_TRANSITIONS[targetStatus] ?? [];
    if (!allowedOrigins.includes(currentStatus)) {
      // Log skipped transition but do not throw — event still marks processed
      console.warn(
        `[webhook-process] Skipping illegal transition ${currentStatus} → ${targetStatus} ` +
        `for provider_tx_id=${ev.providerTxId}`
      );
      return;
    }
  }

  // Build lifecycle timestamp field
  const TS_MAP: Record<string, string> = {
    authorized: "authorized_at",
    cleared:    "cleared_at",
    settled:    "settled_at",
  };
  const tsKey = TS_MAP[targetStatus] ?? null;

  const payload: Record<string, unknown> = {
    org_id:           orgId,
    card_id:          cardId,
    provider_tx_id:   ev.providerTxId,
    webhook_event_id: webhookEventId,
    tx_status:        targetStatus,
    amount:           ev.amountCents != null ? ev.amountCents / 100 : null,
    currency:         ev.currency,
    merchant_name:    ev.merchantName,
    merchant_mcc:     ev.merchantMcc,
    transaction_date: ev.eventTimestamp ?? new Date().toISOString(),
  };

  if (tsKey) {
    payload[tsKey] = ev.eventTimestamp ?? new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("transactions")
    .upsert(payload, { onConflict: "org_id,provider_tx_id", ignoreDuplicates: false });

  if (error) throw error;
}

// ── Card event handler ────────────────────────────────────────────────────────

async function handleCardEvent(
  ev: NormalizedEvent,
  cardDbId: string,
  orgId: string | null
): Promise<void> {
  const updates: Record<string, unknown> = {};

  switch (ev.eventClass) {
    case "card.frozen_by_provider":
      updates.status = "frozen";
      break;

    case "card.unfrozen_by_provider":
      updates.status = "active";
      break;

    case "card.limit_breach":
      // No status change — just an alert event; audit log handles the record
      break;

    case "card.updated":
      // Sync new spend limit if provided
      if (ev.newLimitCents != null) {
        updates.spending_limit = ev.newLimitCents / 100;
      }
      break;

    default:
      break;
  }

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabaseAdmin
    .from("cards")
    .update(updates)
    .eq("id", cardDbId);

  if (error) throw error;
}

// ── Account event handler ─────────────────────────────────────────────────────

async function handleAccountEvent(
  ev: NormalizedEvent,
  orgId: string | null
): Promise<void> {
  if (!orgId || !ev.providerAccountId) return;

  // account.updated: write to a provider_accounts table if it exists,
  // otherwise just let the audit log capture the event.
  // Future: upsert into provider_accounts(org_id, provider_account_id, status, ...)
  console.log(
    `[webhook-process] account.updated for org=${orgId} ` +
    `account=${ev.providerAccountId} status=${ev.accountStatus}`
  );
}

// ── Response helpers ──────────────────────────────────────────────────────────

function okRes(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function errRes(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: CORS,
  });
}
