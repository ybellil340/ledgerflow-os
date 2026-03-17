import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2, Database, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "running" | "done" | "error";
type Step = { label: string; status: StepStatus };

export default function SeedPage() {
  const { user } = useAuth();
  const { orgId } = useOrganization();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([
    { label: "Organization & membership", status: "pending" },
    { label: "Expense categories & VAT codes", status: "pending" },
    { label: "Departments & cost centers", status: "pending" },
    { label: "Bank accounts", status: "pending" },
    { label: "Suppliers & customers", status: "pending" },
    { label: "Corporate cards", status: "pending" },
    { label: "Expenses (draft, submitted, approved)", status: "pending" },
    { label: "AP & AR invoices", status: "pending" },
    { label: "Transactions", status: "pending" },
    { label: "Budgets & chart of accounts", status: "pending" },
  ]);

  const setStep = (i: number, status: StepStatus) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status } : s)));

  const progress = Math.round(
    (steps.filter((s) => s.status === "done").length / steps.length) * 100
  );

  const d = (daysAgo: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - daysAgo);
    return dt.toISOString().split("T")[0];
  };

  async function runSeed() {
    if (!user) return;
    setRunning(true);
    setError(null);

    try {
      // STEP 0: Organization
      setStep(0, "running");
      let oid = orgId;
      if (!oid) {
        const { data: org, error: e } = await supabase
          .from("organizations")
          .insert({ name: "Mueller Consulting GmbH", legal_name: "Mueller Consulting GmbH", tax_id: "DE123456789", currency: "EUR", country: "DE" })
          .select().single();
        if (e) throw e;
        oid = org.id;
        const { error: me } = await supabase.from("org_members").insert({ org_id: oid, user_id: user.id, role: "company_admin", is_active: true });
        if (me) throw me;
      }
      await supabase.from("profiles").upsert({ user_id: user.id, first_name: "Katrin", last_name: "Mueller" }, { onConflict: "user_id" });
      setStep(0, "done");

      // STEP 1: Categories & VAT
      setStep(1, "running");
      const { data: cats, error: ce } = await supabase.from("expense_categories")
        .insert([
          { org_id: oid!, name: "Travel", code: "TRAVEL" },
          { org_id: oid!, name: "Software & SaaS", code: "SOFTWARE" },
          { org_id: oid!, name: "Meals & Entertainment", code: "MEALS" },
          { org_id: oid!, name: "Equipment", code: "EQUIPMENT" },
          { org_id: oid!, name: "Marketing", code: "MARKETING" },
          { org_id: oid!, name: "Office Supplies", code: "OFFICE" },
          { org_id: oid!, name: "Training & Education", code: "TRAINING" },
          { org_id: oid!, name: "Consulting Fees", code: "CONSULTING" },
        ]).select();
      if (ce) throw ce;
      await supabase.from("vat_codes").insert([
        { org_id: oid!, code: "VSt19", description: "Vorsteuer 19%", rate: 19 },
        { org_id: oid!, code: "VSt7", description: "Vorsteuer 7%", rate: 7 },
        { org_id: oid!, code: "USt19", description: "Umsatzsteuer 19%", rate: 19 },
        { org_id: oid!, code: "VSt0", description: "Steuerfrei 0%", rate: 0 },
      ]);
      setStep(1, "done");
      const cm: Record<string, string> = {};
      for (const c of cats ?? []) cm[c.code ?? ""] = c.id;

      // STEP 2: Departments & cost centers
      setStep(2, "running");
      await supabase.from("departments").insert([
        { org_id: oid!, name: "Sales & Business Development" },
        { org_id: oid!, name: "Technology & Product" },
        { org_id: oid!, name: "Finance & Operations" },
      ]);
      const { data: ccs } = await supabase.from("cost_centers")
        .insert([
          { org_id: oid!, name: "Sales", code: "CC-100" },
          { org_id: oid!, name: "Technology", code: "CC-200" },
          { org_id: oid!, name: "Operations", code: "CC-300" },
        ]).select();
      setStep(2, "done");
      const cc = (ccs ?? []).map(c => c.id);

      // STEP 3: Bank accounts
      setStep(3, "running");
      await supabase.from("bank_accounts").insert([
        { org_id: oid!, account_name: "Geschaeftskonto", bank_name: "Deutsche Bank", iban: "DE89370400440532013000", bic: "DEUTDEDB", balance: 124580.42, currency: "EUR", is_primary: true },
        { org_id: oid!, account_name: "Tagesgeldkonto", bank_name: "Commerzbank", iban: "DE27200400600521013800", bic: "COBADEFFXXX", balance: 48200.00, currency: "EUR", is_primary: false },
      ]);
      setStep(3, "done");

      // STEP 4: Suppliers & customers
      setStep(4, "running");
      const { data: sups } = await supabase.from("suppliers").insert([
        { org_id: oid!, name: "Lufthansa AG", email: "invoices@lufthansa.com", tax_id: "DE118501118", city: "Frankfurt", country: "DE" },
        { org_id: oid!, name: "Amazon Web Services EMEA", email: "aws-billing@amazon.com", city: "Dublin", country: "IE" },
        { org_id: oid!, name: "KPMG Deutschland GmbH", email: "billing@kpmg.de", tax_id: "DE811202280", city: "Berlin", country: "DE" },
        { org_id: oid!, name: "Marriott Hotels Deutschland", email: "accounts@marriott.de", city: "Muenchen", country: "DE" },
        { org_id: oid!, name: "Conrad Electronic SE", email: "business@conrad.de", tax_id: "DE129273398", city: "Hirschau", country: "DE" },
      ]).select();
      const { data: custs } = await supabase.from("customers").insert([
        { org_id: oid!, name: "Techcorp Berlin GmbH", email: "ap@techcorp-berlin.de", tax_id: "DE111222333", city: "Berlin", country: "DE" },
        { org_id: oid!, name: "Bavarian Motors AG", email: "accounts@bm-ag.de", tax_id: "DE987654321", city: "Muenchen", country: "DE" },
        { org_id: oid!, name: "FinanzTech Holding GmbH", email: "finance@finanztech.de", city: "Frankfurt", country: "DE" },
      ]).select();
      setStep(4, "done");
      const si = (sups ?? []).map(s => s.id);
      const ci = (custs ?? []).map(c => c.id);

      // STEP 5: Cards
      setStep(5, "running");
      const { data: cards } = await supabase.from("cards").insert([
        { org_id: oid!, holder_id: user.id, card_name: "Katrin Mueller - Platinum", card_type: "virtual", last_four: "4521", spending_limit: 5000, status: "active", currency: "EUR" },
        { org_id: oid!, holder_id: user.id, card_name: "Travel Card", card_type: "physical", last_four: "8834", spending_limit: 10000, status: "active", currency: "EUR" },
        { org_id: oid!, holder_id: user.id, card_name: "Marketing Card", card_type: "virtual", last_four: "2276", spending_limit: 2000, status: "frozen", currency: "EUR" },
      ]).select();
      setStep(5, "done");
      const cardId = cards?.[0]?.id;

      // STEP 6: Expenses
      setStep(6, "running");
      const now = new Date().toISOString();
      await supabase.from("expenses").insert([
        { org_id: oid!, submitter_id: user.id, title: "Lufthansa Frankfurt - London", amount: 842, expense_date: d(3), status: "submitted", submitted_at: now, category_id: cm["TRAVEL"], cost_center_id: cc[0] },
        { org_id: oid!, submitter_id: user.id, title: "Marriott Business Hotel Berlin", amount: 420, expense_date: d(7), status: "submitted", submitted_at: now, category_id: cm["TRAVEL"], cost_center_id: cc[0] },
        { org_id: oid!, submitter_id: user.id, title: "AWS Cloud Infrastructure March", amount: 1240, expense_date: d(4), status: "submitted", submitted_at: now, category_id: cm["SOFTWARE"], cost_center_id: cc[1] },
        { org_id: oid!, submitter_id: user.id, title: "Conrad Electronics - Headphones", amount: 249, expense_date: d(10), status: "approved", submitted_at: now, approved_at: now, approver_id: user.id, category_id: cm["EQUIPMENT"] },
        { org_id: oid!, submitter_id: user.id, title: "Google Workspace Annual License", amount: 1188, expense_date: d(14), status: "approved", submitted_at: now, approved_at: now, approver_id: user.id, category_id: cm["SOFTWARE"], cost_center_id: cc[1] },
        { org_id: oid!, submitter_id: user.id, title: "Client Dinner - Techcorp Team", amount: 385.50, expense_date: d(5), status: "submitted", submitted_at: now, category_id: cm["MEALS"], cost_center_id: cc[0] },
        { org_id: oid!, submitter_id: user.id, title: "Salesforce CRM License Q1", amount: 2400, expense_date: d(30), status: "reimbursed", submitted_at: now, approved_at: now, approver_id: user.id, category_id: cm["SOFTWARE"] },
        { org_id: oid!, submitter_id: user.id, title: "LinkedIn Marketing Campaign", amount: 850, expense_date: d(20), status: "approved", submitted_at: now, approved_at: now, approver_id: user.id, category_id: cm["MARKETING"], cost_center_id: cc[0] },
        { org_id: oid!, submitter_id: user.id, title: "Office Supplies Q1 2025", amount: 124.80, expense_date: d(8), status: "draft", category_id: cm["OFFICE"] },
        { org_id: oid!, submitter_id: user.id, title: "React Advanced Training", amount: 299, expense_date: d(12), status: "rejected", submitted_at: now, rejected_at: now, approver_id: user.id, rejection_reason: "Q1 training budget exceeded", category_id: cm["TRAINING"], cost_center_id: cc[1] },
      ]);
      setStep(6, "done");

      // STEP 7: Invoices
      setStep(7, "running");
      if (si.length) await supabase.from("ap_invoices").insert([
        { org_id: oid!, created_by: user.id, invoice_number: "LH-2025-0234", supplier_id: si[0], amount: 4200, tax_amount: 798, issue_date: d(20), due_date: d(10), status: "overdue" },
        { org_id: oid!, created_by: user.id, invoice_number: "AWS-EU-2503", supplier_id: si[1], amount: 1890, tax_amount: 0, issue_date: d(5), due_date: d(-25), status: "pending" },
        { org_id: oid!, created_by: user.id, invoice_number: "KPMG-Q1-2025", supplier_id: si[2], amount: 8500, tax_amount: 1615, issue_date: d(30), due_date: d(0), status: "approved" },
        { org_id: oid!, created_by: user.id, invoice_number: "CONV-2025-118", supplier_id: si[3], amount: 1260, tax_amount: 239.40, issue_date: d(45), due_date: d(-15), status: "paid" },
      ]);
      if (ci.length) await supabase.from("ar_invoices").insert([
        { org_id: oid!, created_by: user.id, invoice_number: "MC-2025-0042", customer_id: ci[0], amount: 18500, tax_amount: 3515, issue_date: d(15), due_date: d(5), status: "overdue" },
        { org_id: oid!, created_by: user.id, invoice_number: "MC-2025-0043", customer_id: ci[1], amount: 24000, tax_amount: 4560, issue_date: d(10), due_date: d(-20), status: "pending" },
        { org_id: oid!, created_by: user.id, invoice_number: "MC-2025-0044", customer_id: ci[2], amount: 9800, tax_amount: 1862, issue_date: d(3), due_date: d(-27), status: "draft" },
      ]);
      setStep(7, "done");

      // STEP 8: Transactions
      setStep(8, "running");
      await supabase.from("transactions").insert([
        { org_id: oid!, merchant_name: "Lufthansa", amount: -842, transaction_date: d(3), status: "completed", notes: "Flight FRA-LHR", category: "Travel", card_id: cardId },
        { org_id: oid!, merchant_name: "Amazon Web Services", amount: -1240, transaction_date: d(4), status: "completed", notes: "Cloud services March", category: "Software" },
        { org_id: oid!, merchant_name: "TECHCORP BERLIN", amount: 18500, transaction_date: d(5), status: "completed", notes: "Invoice MC-2025-0042" },
        { org_id: oid!, merchant_name: "Marriott Munich", amount: -420, transaction_date: d(7), status: "completed", notes: "Hotel accommodation", category: "Travel", card_id: cardId },
        { org_id: oid!, merchant_name: "Google Ireland Ltd", amount: -99, transaction_date: d(8), status: "completed", notes: "Workspace subscription", category: "Software" },
        { org_id: oid!, merchant_name: "Restaurant Tantris", amount: -385.50, transaction_date: d(9), status: "completed", notes: "Client dinner", category: "Meals", card_id: cardId },
        { org_id: oid!, merchant_name: "BAVARIAN MOTORS AG", amount: 24000, transaction_date: d(2), status: "pending", notes: "Invoice MC-2025-0043" },
        { org_id: oid!, merchant_name: "DB Bahn", amount: -89.50, transaction_date: d(1), status: "completed", notes: "ICE Frankfurt-Berlin", category: "Travel" },
      ]);
      setStep(8, "done");

      // STEP 9: Budgets & chart of accounts
      setStep(9, "running");
      await supabase.from("budgets").insert([
        { org_id: oid!, created_by: user.id, name: "Q1 2025 Travel Budget", amount: 15000, currency: "EUR", period: "quarterly", start_date: "2025-01-01", end_date: "2025-03-31", category_id: cm["TRAVEL"] },
        { org_id: oid!, created_by: user.id, name: "Software & Tools 2025", amount: 24000, currency: "EUR", period: "yearly", start_date: "2025-01-01", end_date: "2025-12-31", category_id: cm["SOFTWARE"] },
        { org_id: oid!, created_by: user.id, name: "Marketing Q2 2025", amount: 8000, currency: "EUR", period: "quarterly", start_date: "2025-04-01", end_date: "2025-06-30", category_id: cm["MARKETING"] },
      ]);
      await supabase.from("chart_of_accounts").insert([
        { org_id: oid!, account_number: "1200", name: "Forderungen aus Lieferungen und Leistungen", account_type: "asset" },
        { org_id: oid!, account_number: "1600", name: "Verbindlichkeiten aus Lieferungen und Leistungen", account_type: "liability" },
        { org_id: oid!, account_number: "4600", name: "Reisekosten Arbeitnehmer", account_type: "expense" },
        { org_id: oid!, account_number: "4980", name: "EDV-Kosten und Software", account_type: "expense" },
        { org_id: oid!, account_number: "6300", name: "Fremdleistungen", account_type: "expense" },
        { org_id: oid!, account_number: "8400", name: "Erloese 19% Umsatzsteuer", account_type: "revenue" },
        { org_id: oid!, account_number: "8300", name: "Erloese 7% Umsatzsteuer", account_type: "revenue" },
      ]);
      await supabase.from("notifications").insert([
        { org_id: oid!, user_id: user.id, title: "3 expenses pending approval", message: "Lufthansa, Marriott, and AWS expenses need your review", type: "expense_approval", link: "/expenses" },
        { org_id: oid!, user_id: user.id, title: "Invoice overdue: LH-2025-0234", message: "Lufthansa invoice for EUR 4,200 is 10 days overdue", type: "invoice_overdue", link: "/ap-invoices" },
        { org_id: oid!, user_id: user.id, title: "AR Invoice overdue: MC-2025-0042", message: "Techcorp Berlin invoice EUR 18,500 is past due", type: "invoice_overdue", link: "/ar-invoices" },
      ]);
      setStep(9, "done");
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
      setSteps(prev => prev.map(s => s.status === "running" ? { ...s, status: "error" } : s));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Database className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-1">Set up demo workspace</h1>
          <p className="text-muted-foreground text-sm">
            Populate LedgerFlow with 3 months of realistic German SME data.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Mueller Consulting GmbH</CardTitle>
            <CardDescription className="text-xs">
              5 suppliers, 3 customers, 10 expenses, 7 invoices, 8 transactions, 3 budgets, and full chart of accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {step.status === "done" && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {step.status === "running" && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                  {step.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                  {step.status === "pending" && <div className={cn("w-2 h-2 rounded-full", running ? "bg-muted" : "bg-muted-foreground/30")} />}
                </div>
                <span className={cn("text-sm",
                  step.status === "done" && "text-foreground",
                  step.status === "running" && "text-foreground font-medium",
                  step.status === "pending" && "text-muted-foreground",
                  step.status === "error" && "text-destructive",
                )}>
                  {step.label}
                </span>
              </div>
            ))}

            {running && (
              <div className="pt-2">
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1.5">{progress}% complete</p>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive font-medium">Something went wrong</p>
                <p className="text-xs text-destructive/80 mt-0.5 font-mono break-all">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  If data already exists, try going to /dashboard directly.
                </p>
              </div>
            )}

            {done ? (
              <div className="pt-3 space-y-2">
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-sm font-medium text-green-700">Workspace ready!</p>
                  <p className="text-xs text-green-600 mt-0.5">All data created successfully.</p>
                </div>
                <Button className="w-full" onClick={() => navigate("/dashboard")}>Open Dashboard</Button>
              </div>
            ) : (
              <div className="pt-3 space-y-2">
                <Button className="w-full" onClick={runSeed} disabled={running}>
                  {running
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Setting up workspace...</>
                    : "Set up demo workspace"
                  }
                </Button>
                {!running && (
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => navigate("/dashboard")}>
                    Skip
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          All data is private to your account.
        </p>
      </div>
    </div>
  );
}
