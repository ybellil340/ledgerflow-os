// supabase/functions/card-issue/index.ts
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

    const {
      orgId,
      holderId,
      cardName,
      cardType = "virtual",
      spendingLimit = 5000,
      spendPeriod = "monthly",
      walletId,
      allowedCategoryIds = [],
      allowedCountries = [],
    } = await req.json();

    if (!orgId || !cardName) return err(400, "orgId and cardName are required");

    const provider = getBankProvider("mock");
    const result = await provider.issueCard({
      orgId,
      holderId: holderId ?? user.id,
      cardName,
      cardType,
      spendingLimitCents: Math.round(spendingLimit * 100),
      spendPeriod,
      walletId,
      allowedCategoryIds,
      allowedCountries,
    });

    const { data: card, error: insertErr } = await supabaseAdmin
      .from("cards")
      .insert({
        org_id: orgId,
        holder_id: holderId ?? user.id,
        card_name: cardName,
        last_four: result.lastFour,
        card_type: cardType,
        spending_limit: spendingLimit,
        spend_period: spendPeriod,
        wallet_id: walletId ?? null,
        allowed_category_ids: allowedCategoryIds,
        allowed_countries: allowedCountries,
        provider: "mock",
        provider_card_id: result.providerCardId,
        expiry_month: result.expiryMonth,
        expiry_year: result.expiryYear,
        status: "active",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    await writeAuditLog({
      orgId,
      userId: user.id,
      action: "card.issued",
      entityType: "card",
      entityId: card.id,
      metadata: { cardName, cardType, provider: "mock" },
    });

    return ok({ card });
  } catch (e: any) {
    console.error("[card-issue]", e);
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
