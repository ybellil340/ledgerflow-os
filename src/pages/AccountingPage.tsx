// src/pages/AccountingPage.tsx
// Phase C: Refactored accounting page with server-side export, period locks, batch history

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useExportBatches } from "@/hooks/useExportBatches";
import { usePeriodLocks } from "@/hooks/usePeriodLocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Download,
  FileSpreadsheet,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  History,
} from "lucide-react";
import type { ExportBatch } from "@/types/accounting";

export default function AccountingPage() {
  const { orgId, role } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "company_admin" || role === "accountant";

  // Phase C hooks
  const { batches, isLoading: batchesLoading, generateExport, checkStale } = useExportBatches();
  const { locks, lockPeriod, unlockPeriod, isDateLocked } = usePeriodLocks();

  // âââ VAT Codes (preserved from existing) ââââââââââââââââââââ
  const [vatOpen, setVatOpen] = useState(false);
  const [vatForm, setVatForm] = useState({ code: "", description: "", rate: "" });

  const { data: vatCodes = [] } = useQuery({
    queryKey: ["vat-codes", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vat_codes").select("*").eq("org_id", orgId!).order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const createVat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vat_codes").insert({
        org_id: orgId!,
        code: vatForm.code,
        description: vatForm.description,
        rate: parseFloat(vatForm.rate),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-codes"] });
      setVatOpen(false);
      setVatForm({ code: "", description: "", rate: "" });
      toast({ title: "VAT code created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // âââ Chart of Accounts (preserved from existing) ââââââââââââ
  const [coaOpen, setCoaOpen] = useState(false);
  const [coaForm, setCoaForm] = useState({ account_number: "", name: "", account_type: "expense" });

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("*").eq("org_id", orgId!).order("account_number");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chart_of_accounts").insert({ org_id: orgId!, ...coaForm });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setCoaOpen(false);
      setCoaForm({ account_number: "", name: "", account_type: "expense" });
      toast({ title: "Account created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // âââ DATEV Export (Phase C: server-side) ââââââââââââââââââââ
  const [datevOpen, setDatevOpen] = useState(false);
  const [datevFrom, setDatevFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [datevTo, setDatevTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [consultantNr, setConsultantNr] = useState("1234567");
  const [clientNr, setClientNr] = useState("12345");
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeAP, setIncludeAP] = useState(true);
  const [includeAR, setIncludeAR] = useState(true);
  const [includeReimbursements, setIncludeReimbursements] = useState(false);

  const handleServerExport = () => {
    generateExport.mutate({
      export_type: "datev_journal",
      period_start: datevFrom,
      period_end: datevTo,
      include_expenses: includeExpenses,
      include_ap: includeAP,
      include_ar: includeAR,
      include_reimbursements: includeReimbursements,
      consultant_number: consultantNr,
      client_number: clientNr,
    });
    setDatevOpen(false);
  };

  // âââ Period Lock Dialog âââââââââââââââââââââââââââââââââââââ
  const [lockOpen, setLockOpen] = useState(false);
  const [lockFrom, setLockFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [lockTo, setLockTo] = useState(() => {
    const d = new Date();
    d.setDate(0); // last day of previous month
    return d.toISOString().slice(0, 10);
  });
  const [lockNotes, setLockNotes] = useState("");

  const handleLockPeriod = () => {
    lockPeriod.mutate({ period_start: lockFrom, period_end: lockTo, notes: lockNotes || undefined });
    setLockOpen(false);
    setLockNotes("");
  };

  // âââ Status helpers âââââââââââââââââââââââââââââââââââââââââ
  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
      locked: "default",
      unlocked: "secondary",
    };
    return <Badge variant={variants[status] || "outline"} className="text-xs">{status}</Badge>;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Accounting</h1>
          <p className="text-muted-foreground text-sm">
            VAT codes, chart of accounts, exports & period locks
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={lockOpen} onOpenChange={setLockOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Lock className="h-4 w-4 mr-1.5" />
                  Lock Period
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Lock Accounting Period</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>From</Label>
                      <Input type="date" value={lockFrom} onChange={(e) => setLockFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>To</Label>
                      <Input type="date" value={lockTo} onChange={(e) => setLockTo(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes (optional)</Label>
                    <Input
                      value={lockNotes}
                      onChange={(e) => setLockNotes(e.target.value)}
                      placeholder="e.g. Q1 2026 closing"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Locking a period prevents modifications to expenses, AP invoices, and AR invoices
                    within that date range.
                  </p>
                  <Button className="w-full" onClick={handleLockPeriod} disabled={lockPeriod.isPending}>
                    <Lock className="h-4 w-4 mr-1.5" />
                    {lockPeriod.isPending ? "Locking..." : "Lock Period"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={datevOpen} onOpenChange={setDatevOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                DATEV Export
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>DATEV Buchungsstapel Export</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300">
                  Exports are now generated server-side with full audit trail and batch tracking.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Von</Label>
                    <Input type="date" value={datevFrom} onChange={(e) => setDatevFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bis</Label>
                    <Input type="date" value={datevTo} onChange={(e) => setDatevTo(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Beraternr.</Label>
                    <Input value={consultantNr} onChange={(e) => setConsultantNr(e.target.value)} placeholder="1234567" maxLength={7} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mandantennr.</Label>
                    <Input value={clientNr} onChange={(e) => setClientNr(e.target.value)} placeholder="12345" maxLength={5} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Daten einschlieÃen</Label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={includeExpenses} onCheckedChange={(v) => setIncludeExpenses(!!v)} />
                      Ausgaben (genehmigte/erstattete)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={includeAP} onCheckedChange={(v) => setIncludeAP(!!v)} />
                      Eingangsrechnungen (genehmigt/bezahlt)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={includeAR} onCheckedChange={(v) => setIncludeAR(!!v)} />
                      Ausgangsrechnungen (genehmigt/bezahlt)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={includeReimbursements} onCheckedChange={(v) => setIncludeReimbursements(!!v)} />
                      Erstattungen (genehmigt/bezahlt)
                    </label>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleServerExport}
                  disabled={generateExport.isPending || (!includeExpenses && !includeAP && !includeAR && !includeReimbursements)}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  {generateExport.isPending ? "Exportiere..." : "Server-Export starten"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="vat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vat">VAT Codes</TabsTrigger>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="exports">Export History</TabsTrigger>
          <TabsTrigger value="periods">Period Locks</TabsTrigger>
        </TabsList>

        {/* âââ VAT Codes Tab (preserved) âââââââââââââââââââââââ */}
        <TabsContent value="vat">
          <div className="flex justify-end mb-3">
            {isAdmin && (
              <Dialog open={vatOpen} onOpenChange={setVatOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add VAT code</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add VAT code</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createVat.mutate(); }} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Code *</Label><Input value={vatForm.code} onChange={(e) => setVatForm({ ...vatForm, code: e.target.value })} required placeholder="USt19" /></div>
                      <div className="space-y-1.5"><Label>Rate (%) *</Label><Input type="number" step="0.01" value={vatForm.rate} onChange={(e) => setVatForm({ ...vatForm, rate: e.target.value })} required placeholder="19" /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Description *</Label><Input value={vatForm.description} onChange={(e) => setVatForm({ ...vatForm, description: e.target.value })} required placeholder="Standard VAT 19%" /></div>
                    <Button type="submit" className="w-full" disabled={createVat.isPending}>{createVat.isPending ? "Creating..." : "Add VAT code"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {vatCodes.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No VAT codes configured.</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b text-left">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Rate</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {vatCodes.map((v: any) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-medium">{v.code}</td>
                        <td className="px-4 py-3 text-sm">{v.description}</td>
                        <td className="px-4 py-3 text-sm">{v.rate}%</td>
                        <td className="px-4 py-3">
                          <Badge variant={v.is_active ? "default" : "secondary"} className="text-xs">{v.is_active ? "Active" : "Inactive"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* âââ Chart of Accounts Tab (preserved) âââââââââââââââ */}
        <TabsContent value="coa">
          <div className="flex justify-end mb-3">
            {isAdmin && (
              <Dialog open={coaOpen} onOpenChange={setCoaOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add account</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createAccount.mutate(); }} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Account # *</Label><Input value={coaForm.account_number} onChange={(e) => setCoaForm({ ...coaForm, account_number: e.target.value })} required placeholder="4000" /></div>
                      <div className="space-y-1.5"><Label>Type</Label><Input value={coaForm.account_type} onChange={(e) => setCoaForm({ ...coaForm, account_type: e.target.value })} placeholder="expense" /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Name *</Label><Input value={coaForm.name} onChange={(e) => setCoaForm({ ...coaForm, name: e.target.value })} required placeholder="UmsatzerlÃ¶se" /></div>
                    <Button type="submit" className="w-full" disabled={createAccount.isPending}>{createAccount.isPending ? "Creating..." : "Add account"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {accounts.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No accounts configured.</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b text-left">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Account #</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {accounts.map((a: any) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-medium">{a.account_number}</td>
                        <td className="px-4 py-3 text-sm">{a.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{a.account_type}</td>
                        <td className="px-4 py-3">
                          <Badge variant={a.is_active ? "default" : "secondary"} className="text-xs">{a.is_active ? "Active" : "Inactive"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* âââ Export History Tab (Phase C new) âââââââââââââââââ */}
        <TabsContent value="exports">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Export Batch History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {batchesLoading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading export history...</div>
              ) : batches.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No exports yet. Use the DATEV Export button to create your first server-side export.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Period</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Records</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Version</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch: ExportBatch) => (
                      <tr key={batch.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {batch.export_type.replace("datev_", "DATEV ").replace("csv_", "CSV ")}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {batch.period_start} â {batch.period_end}
                        </td>
                        <td className="px-4 py-3 text-sm">{batch.record_count}</td>
                        <td className="px-4 py-3 text-sm">
                          v{batch.version}
                          {batch.supersedes_batch_id && (
                            <span className="text-xs text-muted-foreground ml-1">(re-export)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{statusBadge(batch.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {batch.status === "completed" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => checkStale.mutate(batch.id)}
                                  disabled={checkStale.isPending}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Check
                                </Button>
                                {batch.file_path && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={async () => {
                                      const { data } = await supabase.storage
                                        .from("exports")
                                        .createSignedUrl(batch.file_path!, 3600);
                                      if (data?.signedUrl) {
                                        const a = document.createElement("a");
                                        a.href = data.signedUrl;
                                        a.download = `export_${batch.id.substring(0, 8)}.csv`;
                                        a.click();
                                      }
                                    }}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </Button>
                                )}
                              </>
                            )}
                            {batch.status === "failed" && batch.failure_reason && (
                              <span className="text-xs text-destructive">{batch.failure_reason}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* âââ Period Locks Tab (Phase C new) âââââââââââââââââââ */}
        <TabsContent value="periods">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Accounting Period Locks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {locks.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No period locks. Lock an accounting period to prevent modifications to records in that
                  date range.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Period</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Locked At</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Notes</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locks.map((lock) => (
                      <tr key={lock.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-medium">
                          {lock.period_start} â {lock.period_end}
                        </td>
                        <td className="px-4 py-3">
                          {lock.lock_status === "locked" ? (
                            <Badge variant="default" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Locked
                            </Badge>
                             ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Unlock className="h-3 w-3 mr-1" />
                              Unlocked
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(lock.locked_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {lock.notes || "â"}
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin && lock.lock_status === "locked" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={() => unlockPeriod.mutate({ lockId: lock.id })}
                              disabled={unlockPeriod.isPending}
                            >
                              <Unlock className="h-3 w-3 mr-1" />
                              Unlock
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
