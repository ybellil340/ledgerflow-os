// supabase/functions/card-update-limit/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBankProvider } from "../_shared/bankProvider.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return err(401, "Unauthorized");

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
    if (authErr || !user) return err(401, "Unauthorized");

    const { cardId, orgId, spendingLimit, spendPeriod } = await req.json();
    if (!cardId || !orgId || spendingLimit === undefined) {
      return err(400, "cardId, orgId and spendingLimit are required");
    }

    const { data: card, error: fetchErr } = await supabaseAdmin
      .from("cards")
      .select("provider, provider_card_id, status, spending_limit, spend_period")
      .eq("id", cardId)
      .eq("org_id", orgId)
      .single();

    if (fetchErr || !card) return err(404, "Card not found");
    if (card.status === "cancelled") return err(409, "Cannot update a cancelled card");

    const provider = getBankProvider(card.provider ?? "mock");
    await provider.updateLimit(card.provider_card_id, Math.round(spendingLimit * 100));

    const update: Record<string, unknown> = { spending_limit: spendingLimit };
    if (spendPeriod) update.spend_period = spendPeriod;

    const { error: updateErr } = await supabaseAdmin
      .from("cards")
      .update(update)
      .eq("id", cardId);

    if (updateErr) throw updateErr;

    await writeAuditLog({
      orgId,
      userId: user.id,
      action: "card.limit_updated",
      entityType: "card",
      entityId: cardId,
      metadata: {
        previousLimit: card.spending_limit,
        newLimit: spendingLimit,
        spendPeriod: spendPeriod ?? card.spend_period,
      },
    });

    return ok({ cardId, spendingLimit, spendPeriod: spendPeriod ?? card.spend_period });
  } catch (e: any) {
    console.error("[card-update-limit]", e);
    return err(500, e.message);
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS });
}
