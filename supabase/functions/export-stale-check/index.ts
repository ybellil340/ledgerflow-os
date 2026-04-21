// supabase/functions/export-stale-check/index.ts
// Phase C: Post-export modification detection
// Compares current source record hashes against export_records snapshots.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashRecord(record: Record<string, unknown>): Promise<string> {
  const json = JSON.stringify(record, Object.keys(record).sort());
  const encoded = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { batch_id } = await req.json();

    if (!batch_id) {
      return new Response(JSON.stringify({ error: "Missing batch_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch batch
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("export_batches")
      .select("*")
      .eq("id", batch_id)
      .single();

    if (batchErr || !batch) {
      return new Response(JSON.stringify({ error: "Batch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this org
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("org_id", batch.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch export records for this batch
    const { data: exportRecords, error: recErr } = await supabaseAdmin
      .from("export_records")
      .select("*")
      .eq("batch_id", batch_id);

    if (recErr) {
      throw new Error(`Failed to fetch export records: ${recErr.message}`);
    }

    if (!exportRecords || exportRecords.length === 0) {
      return new Response(JSON.stringify({
        batch_id,
        is_stale: false,
        changed_records: [],
        message: "No export records to check",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by source_table for efficient querying
    const byTable: Record<string, typeof exportRecords> = {};
    for (const rec of exportRecords) {
      if (!byTable[rec.source_table]) byTable[rec.source_table] = [];
      byTable[rec.source_table].push(rec);
    }

    const changedRecords: Array<{
      source_table: string;
      source_id: string;
      export_hash: string;
      current_hash: string;
    }> = [];

    for (const [table, records] of Object.entries(byTable)) {
      const ids = records.map((r) => r.source_id);
      const { data: currentRows, error: fetchErr } = await supabaseAdmin
        .from(table)
        .select("*")
        .in("id", ids);

      if (fetchErr) {
        console.error(`[stale-check] Failed to fetch ${table}:`, fetchErr.message);
        continue;
      }

      const currentMap = new Map((currentRows || []).map((r: any) => [r.id, r]));

      for (const rec of records) {
        const current = currentMap.get(rec.source_id);
        if (!current) {
          // Record was deleted
          changedRecords.push({
            source_table: table,
            source_id: rec.source_id,
            export_hash: rec.source_hash,
            current_hash: "DELETED",
          });
          continue;
        }

        const currentHash = await hashRecord(current);
        if (currentHash !== rec.source_hash) {
          changedRecords.push({
            source_table: table,
            source_id: rec.source_id,
            export_hash: rec.source_hash,
            current_hash: currentHash,
          });
        }
      }
    }

    return new Response(JSON.stringify({
      batch_id,
      is_stale: changedRecords.length > 0,
      changed_count: changedRecords.length,
      total_records: exportRecords.length,
      changed_records: changedRecords,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[export-stale-check] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
