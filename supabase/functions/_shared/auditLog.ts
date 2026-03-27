// _shared/auditLog.ts
// Shared audit writer for all card edge functions.
// Uses the service-role key to bypass RLS — never exposed to the browser.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export interface AuditEntry {
  orgId: string;
  userId: string;
  action: string;       // e.g. "card.issued", "card.frozen"
  entityType: string;   // e.g. "card"
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    org_id: entry.orgId,
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata ?? {},
  });
  if (error) {
    // Audit failures are non-fatal but must be visible in function logs
    console.error("[auditLog] write failed:", error.message);
  }
}
