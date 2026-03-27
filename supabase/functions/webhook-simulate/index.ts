// supabase/functions/webhook-simulate/index.ts
// DEV/TEST ONLY. Set SIMULATE_ENABLED=true to activate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Scenario = "authorize" | "clear" | "settle" | "fail" | "reverse" | "full_lifecycle";

interface SimulateRequest {
  scenario: Scenario;
  providerCardId?: string;
  orgId: string;
  amountCents?: number;
  merchantName?: string;
  merchantMcc?: string;
  providerTxId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (Deno.env.get("SIMULATE_ENABLED") !== "true") {
    return err(403, "Simulation disabled. Set SIMULATE_ENABLED=true.");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");

  let body: SimulateRequest;
  try { body = await req.json(); }
  catch { return err(400, "Invalid JSON"); }

  const { scenario, orgId, amountCents = 1000, merchantName = "Mock Merchant", merchantMcc = "5411" } = body;
  if (!scenario || !orgId) return err(400, "scenario and orgId are required");

  let providerCardId = body.providerCardId;
  if (!providerCardId) {
    const { data: card } = await supabaseAdmin.from("cards").select("provider_card_id")
      .eq("org_id", orgId).eq("provider", "mock").eq("status", "active").limit(1).single();
    if (!card?.provider_card_id) return err(404, "No active mock card found. Issue a card first.");
    providerCardId = card.provider_card_id;
  }

  const providerTxId = body.providerTxId ?? "mock_tx_" + crypto.randomUUID();
  const ingestUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/webhook-ingest?provider=mock";
  const webhookSecret = Deno.env.get("MOCK_WEBHOOK_SECRET") ?? "mock-dev-secret";
  const results: unknown[] = [];

  const sendEvent = async (type: string) => {
    const payload = {
      id: "mock_evt_" + crypto.randomUUID(), type,
      provider_tx_id: providerTxId, provider_card_id: providerCardId,
      amount_cents: amountCents, currency: "EUR",
      merchant_name: merchantName, merchant_mcc: merchantMcc,
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-signature": webhookSecret },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    results.push({ type, status: res.status, ...json });
    return res.ok;
  };

  switch (scenario) {
    case "authorize":  await sendEvent("mock.transaction.authorized"); break;
    case "clear":      await sendEvent("mock.transaction.cleared");    break;
    case "settle":     await sendEvent("mock.transaction.settled");    break;
    case "fail":       await sendEvent("mock.transaction.failed");     break;
    case "reverse":    await sendEvent("mock.transaction.reversed");   break;
    case "full_lifecycle":
      await sendEvent("mock.transaction.authorized");
      await new Promise((r) => setTimeout(r, 300));
      await sendEvent("mock.transaction.cleared");
      await new Promise((r) => setTimeout(r, 300));
      await sendEvent("mock.transaction.settled");
      break;
    default:
      return err(400, "Unknown scenario: " + scenario);
  }

  return new Response(JSON.stringify({ scenario, providerTxId, providerCardId, events: results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS });
}
