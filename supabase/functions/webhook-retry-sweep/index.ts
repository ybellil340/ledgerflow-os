// supabase/functions/webhook-retry-sweep/index.ts
// Retry sweep edge function: re-queues failed webhook_events for reprocessing.
// Called by pg_cron every 5 min (fallback) OR triggered manually / by an external scheduler.
// Also invokable ad-hoc: POST /functions/v1/webhook-retry-sweep (service-role key required).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROCESS_URL =
  Deno.env.get("SUPABASE_URL") + "/functions/v1/webhook-process";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Only callable with the service-role key
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return res(401, { error: "Unauthorized" });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const callerToken = authHeader.replace("Bearer ", "");
  if (callerToken !== serviceKey) {
    return res(403, { error: "Forbidden — service-role key required" });
  }

  // ── Find eligible failed events ───────────────────────────────────────────
  const { data: events, error } = await supabaseAdmin
    .from("webhook_events")
    .select("id")
    .eq("status", "failed")
    .lt("attempts", 5)
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[webhook-retry-sweep] query error:", error.message);
    return res(500, { error: error.message });
  }

  if (!events || events.length === 0) {
    return res(200, { swept: 0, triggered: 0 });
  }

  // Reset status to pending
  const ids = events.map((e) => e.id);
  await supabaseAdmin
    .from("webhook_events")
    .update({ status: "pending" })
    .in("id", ids);

  // Fire process calls in parallel (max 10 concurrent)
  let triggered = 0;
  const batchSize = 10;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map((eventId) =>
        fetch(PROCESS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ eventId }),
        })
      )
    );
    triggered += batch.length;
  }

  console.log(
    `[webhook-retry-sweep] swept=${events.length} triggered=${triggered}`
  );

  return res(200, { swept: events.length, triggered });
});

function res(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
