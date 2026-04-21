// supabase/functions/export-generate/index.ts
// Phase C: Server-side export generation edge function
// Replaces browser-side CSV generation with auditable, batch-tracked exports.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// âââ DATEV helpers (ported from src/lib/datevExport.ts) âââââ

interface DatevBooking {
  amount: number;
  isCredit: boolean;
  account: string;
  contraAccount: string;
  date: string; // DDMM
  documentNumber: string;
  description: string;
  taxKey?: string;
  currency?: string;
}

function formatDateDDMM(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}${month}`;
}

function formatAmount(amount: number): string {
  return Math.abs(amount).toFixed(2).replace(".", ",");
}

function truncate(str: string, maxLen: number): string {
  return (str || "").substring(0, maxLen);
}

function escapeField(val: string): string {
  if (val.includes(";") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function generateHeader(opts: {
  consultantNumber: string;
  clientNumber: string;
  fiscalYearStart: string;
  dateFrom: string;
  dateTo: string;
}): string {
  const fields = [
    '"EXTF"', "700", "21", '"Buchungsstapel"', "12",
    `"${new Date().toISOString().slice(0, 10).replace(/-/g, "")}"`,
    "", "", "", "",
    `"${opts.consultantNumber}"`, `"${opts.clientNumber}"`,
    `"${opts.fiscalYearStart}0101"`, "4",
    `"${opts.dateFrom}"`, `"${opts.dateTo}"`,
    '""', '""', "0", "0", "0", '""',
  ];
  return fields.join(";");
}

function generateColumnHeaders(): string {
  const headers = [
    "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz",
    "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto",
    "Gegenkonto (ohne BU-SchlÃ¼ssel)", "BU-SchlÃ¼ssel", "Belegdatum",
    "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext",
    "Postensperre", "Diverse Adressnummer", "GeschÃ¤ftspartnerbank",
    "Sachverhalt", "Zinssperre", "Beleglink",
  ];
  return headers.map((h) => `"${h}"`).join(";");
}

function generateBookingRow(b: DatevBooking): string {
  const fields = [
    formatAmount(b.amount), b.isCredit ? '"H"' : '"S"',
    `"${b.currency || "EUR"}"`, "", "", "",
    escapeField(b.account), escapeField(b.contraAccount),
    escapeField(b.taxKey || ""), b.date,
    escapeField(truncate(b.documentNumber, 36)), "", "",
    escapeField(truncate(b.description, 60)),
    "", "", "", "", "", "",
  ];
  return fields.join(";");
}

function generateDatevCSV(opts: {
  consultantNumber: string;
  clientNumber: string;
  fiscalYearStart: string;
  dateFrom: string;
  dateTo: string;
  bookings: DatevBooking[];
}): string {
  const lines: string[] = [];
  lines.push(generateHeader(opts));
  lines.push(generateColumnHeaders());
  for (const b of opts.bookings) {
    lines.push(generateBookingRow(b));
  }
  return lines.join("\r\n") + "\r\n";
}

// âââ Hash utility for source record snapshots âââââââââââââââ

async function hashRecord(record: Record<string, unknown>): Promise<string> {
  const json = JSON.stringify(record, Object.keys(record).sort());
  const encoded = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// âââ Validation helpers âââââââââââââââââââââââââââââââââââââ

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

async function validateMappings(
  supabaseAdmin: ReturnType<typeof createClient>,
  orgId: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Check VAT codes exist
  const { data: vatCodes, error: vatErr } = await supabaseAdmin
    .from("vat_codes")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .limit(1);
  if (vatErr || !vatCodes?.length) {
    errors.push("No active VAT codes configured. Add at least one VAT code before exporting.");
  }

  // Check chart of accounts exist
  const { data: accounts, error: coaErr } = await supabaseAdmin
    .from("chart_of_accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .limit(1);
  if (coaErr || !accounts?.length) {
    errors.push("No active chart of accounts configured. Add accounts before exporting.");
  }

  return { valid: errors.length === 0, errors };
}

// âââ Main handler âââââââââââââââââââââââââââââââââââââââââââ

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: extract user from JWT
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
    const {
      org_id,
      export_type = "datev_journal",
      period_start,
      period_end,
      include_expenses = true,
      include_ap = true,
      include_ar = true,
      include_reimbursements = false,
      consultant_number = "1234567",
      client_number = "12345",
    } = body;

    if (!org_id || !period_start || !period_end) {
      return new Response(JSON.stringify({ error: "Missing org_id, period_start, or period_end" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to org with admin/accountant role
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["company_admin", "accountant"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions. Admin or accountant role required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate accounting mappings
    const validation = await validateMappings(supabaseAdmin, org_id);
    if (!validation.valid) {
      await writeAuditLog({
        orgId: org_id,
        userId: user.id,
        action: "export.validation_failed",
        entityType: "export_batch",
        entityId: "pre-creation",
        metadata: { errors: validation.errors },
      });

      return new Response(JSON.stringify({
        batch_id: null,
        status: "failed",
        record_count: 0,
        file_path: null,
        download_url: null,
        validation_errors: validation.errors,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for superseded batch (re-export)
    const { data: existingBatches } = await supabaseAdmin
      .from("export_batches")
      .select("id, version")
      .eq("org_id", org_id)
      .eq("export_type", export_type)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .eq("status", "completed")
      .order("version", { ascending: false })
      .limit(1);

    const supersedes = existingBatches?.[0] ?? null;
    const newVersion = supersedes ? supersedes.version + 1 : 1;

    // Create batch record
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("export_batches")
      .insert({
        org_id,
        export_type,
        period_start,
        period_end,
        status: "processing",
        created_by: user.id,
        version: newVersion,
        supersedes_batch_id: supersedes?.id ?? null,
        metadata: { consultant_number, client_number, include_expenses, include_ap, include_ar, include_reimbursements },
      })
      .select()
      .single();

    if (batchErr || !batch) {
      throw new Error(`Failed to create export batch: ${batchErr?.message}`);
    }

    await writeAuditLog({
      orgId: org_id,
      userId: user.id,
      action: "export.batch_created",
      entityType: "export_batch",
      entityId: batch.id,
      metadata: { export_type, period_start, period_end, version: newVersion },
    });

    // If superseding, audit that
    if (supersedes) {
      await writeAuditLog({
        orgId: org_id,
        userId: user.id,
        action: "export.batch_superseded",
        entityType: "export_batch",
        entityId: supersedes.id,
        metadata: { superseded_by: batch.id, new_version: newVersion },
      });
    }

    // âââ Collect source records âââââââââââââââââââââââââââââââ
    const bookings: DatevBooking[] = [];
    const exportRecords: Array<{
      batch_id: string;
      source_table: string;
      source_id: string;
      source_status_snapshot: string;
      source_hash: string;
    }> = [];

    if (include_expenses) {
      const { data: expenses } = await supabaseAdmin
        .from("expenses")
        .select("*")
        .eq("org_id", org_id)
        .in("status", ["approved", "reimbursed"])
        .gte("expense_date", period_start)
        .lte("expense_date", period_end)
        .order("expense_date", { ascending: true });

      if (expenses) {
        for (const e of expenses) {
          bookings.push({
            amount: Number(e.amount),
            isCredit: false,
            account: "6300",
            contraAccount: "1200",
            date: formatDateDDMM(e.expense_date),
            documentNumber: e.id?.substring(0, 8) || "",
            description: truncate(e.title || "Ausgabe", 60),
            currency: e.currency || "EUR",
          });
          exportRecords.push({
            batch_id: batch.id,
            source_table: "expenses",
            source_id: e.id,
            source_status_snapshot: e.status,
            source_hash: await hashRecord(e),
          });
        }
      }
    }

    if (include_ap) {
      const { data: apInvoices } = await supabaseAdmin
        .from("ap_invoices")
        .select("*")
        .eq("org_id", org_id)
        .in("status", ["approved", "paid"])
        .gte("issue_date", period_start)
        .lte("issue_date", period_end)
        .order("issue_date", { ascending: true });

      if (apInvoices) {
        for (const inv of apInvoices) {
          bookings.push({
            amount: Number(inv.amount),
            isCredit: false,
            account: "6300",
            contraAccount: "1600",
            date: formatDateDDMM(inv.issue_date),
            documentNumber: inv.invoice_number || "",
            description: truncate(`ER ${inv.invoice_number}`, 60),
            currency: inv.currency || "EUR",
          });
          exportRecords.push({
            batch_id: batch.id,
            source_table: "ap_invoices",
            source_id: inv.id,
            source_status_snapshot: inv.status,
            source_hash: await hashRecord(inv),
          });
        }
      }
    }

    if (include_ar) {
      const { data: arInvoices } = await supabaseAdmin
        .from("ar_invoices")
        .select("*")
        .eq("org_id", org_id)
        .in("status", ["approved", "paid"])
        .gte("issue_date", period_start)
        .lte("issue_date", period_end)
        .order("issue_date", { ascending: true });

      if (arInvoices) {
        for (const inv of arInvoices) {
          bookings.push({
            amount: Number(inv.amount),
            isCredit: true,
            account: "4400",
            contraAccount: "1400",
            date: formatDateDDMM(inv.issue_date),
            documentNumber: inv.invoice_number || "",
            description: truncate(`AR ${inv.invoice_number}`, 60),
            currency: inv.currency || "EUR",
          });
          exportRecords.push({
            batch_id: batch.id,
            source_table: "ar_invoices",
            source_id: inv.id,
            source_status_snapshot: inv.status,
            source_hash: await hashRecord(inv),
          });
        }
      }
    }

    if (include_reimbursements) {
      const { data: reimbursements } = await supabaseAdmin
        .from("reimbursements")
        .select("*")
        .eq("org_id", org_id)
        .in("status", ["approved", "paid"])
        .gte("created_at", period_start)
        .lte("created_at", period_end + "T23:59:59Z")
        .order("created_at", { ascending: true });

      if (reimbursements) {
        for (const r of reimbursements) {
          bookings.push({
            amount: Number(r.amount),
            isCredit: false,
            account: "6300",
            contraAccount: "1200",
            date: formatDateDDMM(r.created_at),
            documentNumber: r.id?.substring(0, 8) || "",
            description: truncate(`Erstattung ${r.id?.substring(0, 8)}`, 60),
            currency: "EUR",
          });
          exportRecords.push({
            batch_id: batch.id,
            source_table: "reimbursements",
            source_id: r.id,
            source_status_snapshot: r.status,
            source_hash: await hashRecord(r),
          });
        }
      }
    }

    if (bookings.length === 0) {
      // Mark batch as completed with 0 records
      await supabaseAdmin
        .from("export_batches")
        .update({ status: "completed", completed_at: new Date().toISOString(), record_count: 0 })
        .eq("id", batch.id);

      return new Response(JSON.stringify({
        batch_id: batch.id,
        status: "completed",
        record_count: 0,
        file_path: null,
        download_url: null,
        validation_errors: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // âââ Generate CSV âââââââââââââââââââââââââââââââââââââââââ
    const fiscalYear = new Date(period_start).getFullYear().toString();
    const csv = generateDatevCSV({
      consultantNumber: consultant_number,
      clientNumber: client_number,
      fiscalYearStart: fiscalYear,
      dateFrom: period_start.replace(/-/g, ""),
      dateTo: period_end.replace(/-/g, ""),
      bookings,
    });

    // Hash the CSV for integrity
    const csvHash = await hashRecord({ csv });

    // Upload CSV to Supabase Storage
    const filename = `exports/${org_id}/${batch.id}/EXTF_Buchungsstapel_${period_start}_${period_end}_v${newVersion}.csv`;
    const BOM = "\uFEFF";
    const csvBlob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const csvBuffer = await csvBlob.arrayBuffer();

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("exports")
      .upload(filename, new Uint8Array(csvBuffer), {
        contentType: "text/csv",
        upsert: true,
      });

    // Storage upload is best-effort; if bucket doesn't exist, store file_path as null
    const filePath = uploadErr ? null : filename;
    if (uploadErr) {
      console.warn("[export-generate] Storage upload failed (non-fatal):", uploadErr.message);
    }

    // âââ Register export records ââââââââââââââââââââââââââââââ
    if (exportRecords.length > 0) {
      const { error: recordsErr } = await supabaseAdmin
        .from("export_records")
        .insert(exportRecords);
      if (recordsErr) {
        console.error("[export-generate] Failed to insert export records:", recordsErr.message);
      }
    }

    // âââ Mark batch completed âââââââââââââââââââââââââââââââââ
    await supabaseAdmin
      .from("export_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        file_path: filePath,
        file_hash: csvHash,
        record_count: bookings.length,
      })
      .eq("id", batch.id);

    await writeAuditLog({
      orgId: org_id,
      userId: user.id,
      action: "export.batch_completed",
      entityType: "export_batch",
      entityId: batch.id,
      metadata: { record_count: bookings.length, version: newVersion, file_path: filePath },
    });

    // âââ Generate signed download URL if file exists ââââââââââ
    let downloadUrl: string | null = null;
    if (filePath) {
      const { data: signedData } = await supabaseAdmin.storage
        .from("exports")
        .createSignedUrl(filePath, 3600); // 1 hour
      downloadUrl = signedData?.signedUrl ?? null;
    }

    return new Response(JSON.stringify({
      batch_id: batch.id,
      status: "completed",
      record_count: bookings.length,
      file_path: filePath,
      download_url: downloadUrl,
      validation_errors: [],
      // Include CSV as fallback if storage failed
      ...(filePath ? {} : { csv_content: csv }),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[export-generate] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
