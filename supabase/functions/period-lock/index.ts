// supabase/functions/period-lock/index.ts
// Phase C: Period lock/unlock edge function
// Manages accounting period locks with audit trail.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { org_id, action, period_start, period_end, notes, lock_id } = body;

    if (!org_id) {
      return new Response(JSON.stringify({ error: "Missing org_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin/accountant role
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["company_admin", "accountant"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // âââ LOCK action ââââââââââââââââââââââââââââââââââââââââââ
    if (action === "lock") {
      if (!period_start || !period_end) {
        return new Response(JSON.stringify({ error: "Missing period_start or period_end" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check for overlapping locks
      const { data: existing } = await supabaseAdmin
        .from("period_locks")
        .select("*")
        .eq("org_id", org_id)
        .eq("lock_status", "locked")
        .lte("period_start", period_end)
        .gte("period_end", period_start);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({
          error: "Overlapping period lock exists",
          existing_locks: existing.map((l: any) => ({
            id: l.id,
            period_start: l.period_start,
            period_end: l.period_end,
          })),
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: lock, error: lockErr } = await supabaseAdmin
        .from("period_locks")
        .insert({
          org_id,
          period_start,
          period_end,
          lock_status: "locked",
          locked_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (lockErr) {
        throw new Error(`Failed to create period lock: ${lockErr.message}`);
      }

      await writeAuditLog({
        orgId: org_id,
        userId: user.id,
        action: "period.locked",
        entityType: "period_lock",
        entityId: lock.id,
        metadata: { period_start, period_end, notes },
      });

      return new Response(JSON.stringify(lock), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // âââ UNLOCK action ââââââââââââââââââââââââââââââââââââââââ
    if (action === "unlock") {
      if (!lock_id) {
        return new Response(JSON.stringify({ error: "Missing lock_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: lock, error: fetchErr } = await supabaseAdmin
        .from("period_locks")
        .select("*")
        .eq("id", lock_id)
        .eq("org_id", org_id)
        .single();

      if (fetchErr || !lock) {
        return new Response(JSON.stringify({ error: "Period lock not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (lock.lock_status === "unlocked") {
        return new Response(JSON.stringify({ error: "Period is already unlocked" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("period_locks")
        .update({
          lock_status: "unlocked",
          unlocked_at: new Date().toISOString(),
          notes: notes ? `${lock.notes || ""}\n[Unlocked] ${notes}` : lock.notes,
        })
        .eq("id", lock_id)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Failed to unlock period: ${updateErr.message}`);
      }

      await writeAuditLog({
        orgId: org_id,
        userId: user.id,
        action: "period.unlocked",
        entityType: "period_lock",
        entityId: lock_id,
        metadata: { period_start: lock.period_start, period_end: lock.period_end, notes },
      });

      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // âââ LIST action ââââââââââââââââââââââââââââââââââââââââââ
    if (action === "list") {
      const { data: locks, error: listErr } = await supabaseAdmin
        .from("period_locks")
        .select("*")
        .eq("org_id", org_id)
        .order("period_start", { ascending: false });

      if (listErr) {
        throw new Error(`Failed to list period locks: ${listErr.message}`);
      }

      return new Response(JSON.stringify(locks), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: lock, unlock, or list" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[period-lock] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
