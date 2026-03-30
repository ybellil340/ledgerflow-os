// supabase/functions/transaction-link-expense/index.ts
// Reconciliation write boundary — the ONLY path that sets expense_id / is_reconciled.
// POST { transactionId, expenseId }  → link transaction to expense
// POST { transactionId }             → unlink (clear expense_id + is_reconciled)
//
// Guards:
//   • Caller must be company_admin in the transaction's org
//   • Transaction must be in 'cleared' or 'settled' state to link
//   • Expense must belong to the same org
//
// Uses service-role key → bypasses RLS (transactions_no_direct_write RESTRICTIVE policy).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeAuditLog } from "../_shared/auditLog.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return errRes(405, "Method not allowed");

  // ── Authenticate caller ───────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return errRes(401, "Unauthorized");

  const jwt = authHeader.replace("Bearer ", "");

  // Create a user-scoped client to verify identity
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) return errRes(401, "Invalid token");

  // ── Parse body ────────────────────────────────────────────────────────────
  let transactionId: string | undefined;
  let expenseId: string | undefined;
  try {
    const body = await req.json();
    transactionId = body.transactionId;
    expenseId     = body.expenseId; // undefined = unlink
  } catch {
    return errRes(400, "Invalid JSON");
  }

  if (!transactionId) return errRes(400, "transactionId is required");

  // ── Fetch transaction ─────────────────────────────────────────────────────
  const { data: tx, error: txErr } = await supabaseAdmin
    .from("transactions")
    .select("id, org_id, tx_status, expense_id, is_reconciled, amount")
    .eq("id", transactionId)
    .single();

  if (txErr || !tx) return errRes(404, "Transaction not found");

  // ── Verify caller is company_admin in this org ────────────────────────────
  const { data: membership } = await supabaseAdmin
    .from("org_members")
    .select("role")
    .eq("org_id", tx.org_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!membership || membership.role !== "company_admin") {
    return errRes(403, "Only company admins can reconcile transactions");
  }

  // ── Link ──────────────────────────────────────────────────────────────────
  if (expenseId) {
    // Validate tx status
    if (!["cleared", "settled"].includes(tx.tx_status)) {
      return errRes(
        422,
        `Transaction must be cleared or settled to link (current: ${tx.tx_status})`
      );
    }

    // Validate expense belongs to same org
    const { data: expense, error: expErr } = await supabaseAdmin
      .from("expenses")
      .select("id, org_id, amount")
      .eq("id", expenseId)
      .single();

    if (expErr || !expense) return errRes(404, "Expense not found");
    if (expense.org_id !== tx.org_id) {
      return errRes(403, "Expense belongs to a different organisation");
    }

    // Write reconciliation
    const { error: updateErr } = await supabaseAdmin
      .from("transactions")
      .update({ expense_id: expenseId, is_reconciled: true })
      .eq("id", transactionId);

    if (updateErr) throw updateErr;

    // Audit log (non-blocking)
    writeAuditLog({
      orgId:      tx.org_id,
      userId:     user.id,
      action:     "transaction.linked_expense",
      entityType: "transaction",
      entityId:   transactionId,
      metadata: {
        expenseId,
        txStatus:      tx.tx_status,
        txAmount:      tx.amount,
        expenseAmount: expense.amount,
      },
    }).catch(console.error);

    return okRes({
      linked:        true,
      transactionId,
      expenseId,
      is_reconciled: true,
    });
  }

  // ── Unlink ────────────────────────────────────────────────────────────────
  const prevExpenseId = tx.expense_id;

  const { error: updateErr } = await supabaseAdmin
    .from("transactions")
    .update({ expense_id: null, is_reconciled: false })
    .eq("id", transactionId);

  if (updateErr) throw updateErr;

  writeAuditLog({
    orgId:      tx.org_id,
    userId:     user.id,
    action:     "transaction.unlinked_expense",
    entityType: "transaction",
    entityId:   transactionId,
    metadata:   { previousExpenseId: prevExpenseId },
  }).catch(console.error);

  return okRes({
    linked:        false,
    transactionId,
    expenseId:     null,
    is_reconciled: false,
  });
});

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
