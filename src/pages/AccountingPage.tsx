import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, FileSpreadsheet } from "lucide-react";
import {
  generateDatevCSV,
  downloadCSV,
  expensesToDatevBookings,
  apInvoicesToDatevBookings,
  arInvoicesToDatevBookings,
  type DatevBooking,
} from "@/lib/datevExport";

export default function AccountingPage() {
  const { orgId, role } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "company_admin";

  // VAT Codes
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
      const { error } = await supabase.from("vat_codes").insert({ org_id: orgId!, code: vatForm.code, description: vatForm.description, rate: parseFloat(vatForm.rate) });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vat-codes"] }); setVatOpen(false); setVatForm({ code: "", description: "", rate: "" }); toast({ title: "VAT code created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Chart of Accounts
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] }); setCoaOpen(false); setCoaForm({ account_number: "", name: "", account_type: "expense" }); toast({ title: "Account created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // DATEV Export
  const [datevOpen, setDatevOpen] = useState(false);
  const [datevFrom, setDatevFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [datevTo, setDatevTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [consultantNr, setConsultantNr] = useState("1234567");
  const [clientNr, setClientNr] = useState("12345");
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeAP, setIncludeAP] = useState(true);
  const [includeAR, setIncludeAR] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleDatevExport = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const bookings: DatevBooking[] = [];

      if (includeExpenses) {
        const { data } = await supabase
          .from("expenses")
          .select("*")
          .eq("org_id", orgId)
          .in("status", ["approved", "reimbursed"])
          .gte("expense_date", datevFrom)
          .lte("expense_date", datevTo);
        if (data) bookings.push(...expensesToDatevBookings(data));
      }

      if (includeAP) {
        const { data } = await supabase
          .from("ap_invoices")
          .select("*")
          .eq("org_id", orgId)
          .in("status", ["approved", "paid"])
          .gte("issue_date", datevFrom)
          .lte("issue_date", datevTo);
        if (data) bookings.push(...apInvoicesToDatevBookings(data));
      }

      if (includeAR) {
        const { data } = await supabase
          .from("ar_invoices")
          .select("*")
          .eq("org_id", orgId)
          .in("status", ["approved", "paid"])
          .gte("issue_date", datevFrom)
          .lte("issue_date", datevTo);
        if (data) bookings.push(...arInvoicesToDatevBookings(data));
      }

      if (bookings.length === 0) {
        toast({ title: "Keine Buchungen", description: "Im gewählten Zeitraum wurden keine Buchungen gefunden.", variant: "destructive" });
        setExporting(false);
        return;
      }

      const fiscalYear = new Date(datevFrom).getFullYear().toString();
      const csv = generateDatevCSV({
        consultantNumber: consultantNr,
        clientNumber: clientNr,
        fiscalYearStart: fiscalYear,
        dateFrom: datevFrom.replace(/-/g, ""),
        dateTo: datevTo.replace(/-/g, ""),
        bookings,
      });

      const filename = `EXTF_Buchungsstapel_${datevFrom}_${datevTo}.csv`;
      downloadCSV(csv, filename);
      toast({ title: "DATEV Export", description: `${bookings.length} Buchungen exportiert.` });
      setDatevOpen(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setExporting(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold">Accounting</h1><p className="text-muted-foreground text-sm">VAT codes, chart of accounts & DATEV export</p></div>
        <Dialog open={datevOpen} onOpenChange={setDatevOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><FileSpreadsheet className="h-4 w-4 mr-1.5" />DATEV Export</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>DATEV Buchungsstapel Export</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Von</Label><Input type="date" value={datevFrom} onChange={e => setDatevFrom(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Bis</Label><Input type="date" value={datevTo} onChange={e => setDatevTo(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Beraternr.</Label><Input value={consultantNr} onChange={e => setConsultantNr(e.target.value)} placeholder="1234567" maxLength={7} /></div>
                <div className="space-y-1.5"><Label>Mandantennr.</Label><Input value={clientNr} onChange={e => setClientNr(e.target.value)} placeholder="12345" maxLength={5} /></div>
              </div>
              <div className="space-y-2">
                <Label>Daten einschließen</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeExpenses} onCheckedChange={(v) => setIncludeExpenses(!!v)} />Ausgaben (genehmigte/erstattete)</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeAP} onCheckedChange={(v) => setIncludeAP(!!v)} />Eingangsrechnungen (genehmigt/bezahlt)</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeAR} onCheckedChange={(v) => setIncludeAR(!!v)} />Ausgangsrechnungen (genehmigt/bezahlt)</label>
                </div>
              </div>
              <Button className="w-full" onClick={handleDatevExport} disabled={exporting || (!includeExpenses && !includeAP && !includeAR)}>
                <Download className="h-4 w-4 mr-1.5" />{exporting ? "Exportiere..." : "CSV herunterladen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="vat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vat">VAT Codes</TabsTrigger>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="vat">
          <div className="flex justify-end mb-3">
            {isAdmin && (
              <Dialog open={vatOpen} onOpenChange={setVatOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add VAT code</Button></DialogTrigger>
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
              {vatCodes.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No VAT codes configured.</div> : (
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
                        <td className="px-4 py-3"><Badge variant={v.is_active ? "default" : "secondary"} className="text-xs">{v.is_active ? "Active" : "Inactive"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coa">
          <div className="flex justify-end mb-3">
            {isAdmin && (
              <Dialog open={coaOpen} onOpenChange={setCoaOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add account</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add account</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createAccount.mutate(); }} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Account # *</Label><Input value={coaForm.account_number} onChange={(e) => setCoaForm({ ...coaForm, account_number: e.target.value })} required placeholder="4000" /></div>
                      <div className="space-y-1.5"><Label>Type</Label><Input value={coaForm.account_type} onChange={(e) => setCoaForm({ ...coaForm, account_type: e.target.value })} placeholder="expense" /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Name *</Label><Input value={coaForm.name} onChange={(e) => setCoaForm({ ...coaForm, name: e.target.value })} required placeholder="Umsatzerlöse" /></div>
                    <Button type="submit" className="w-full" disabled={createAccount.isPending}>{createAccount.isPending ? "Creating..." : "Add account"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {accounts.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No accounts configured.</div> : (
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
                        <td className="px-4 py-3"><Badge variant={a.is_active ? "default" : "secondary"} className="text-xs">{a.is_active ? "Active" : "Inactive"}</Badge></td>
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
