import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses } from "@/hooks/useExpenses";
import { useCategories } from "@/hooks/useCategories";
import { scanReceipt } from "@/lib/scanReceipt";
import { getFxRate } from "@/lib/getFxRate";
import { DownloadMenu } from "@/components/expenses/DownloadMenu";
import { ExpenseDetailView } from "@/components/ExpenseDetailView";
import { DataPageHeader } from "@/components/DataPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ScanLine } from "lucide-react";
import { fmtCurrency, fmtDate } from "@/lib/formatters";
import type { Expense } from "@/types";

const CURRENCIES = ["EUR","USD","GBP","CHF","AED","SAR","TND","CAD","AUD","JPY","CNY","INR","BRL","SEK","NOK","DKK","PLN","CZK","HUF","TRY","SGD","HKD","NZD","MXN","ZAR","KRW"];
const STATUS_TABS = ["All Expenses","Pending Approval","Approved","Rejected","Drafts","Reimbursed"];
const STATUS_MAP: Record<string,string> = { "Pending Approval":"submitted","Approved":"approved","Rejected":"rejected","Drafts":"draft","Reimbursed":"reimbursed" };

const emptyForm = { title:"", description:"", amount:"", expense_date: new Date().toISOString().split("T")[0], category_id:"", currency:"EUR", vat_amount:"", vat_rate:"", tax_registration_number:"" };

export default function ExpensesPage() {
  const { user } = useAuth();
  const { expenses, isLoading, createExpense, isCreating } = useExpenses();
  const { categories, matchCategory } = useCategories();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState("All Expenses");
  const [search, setSearch] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = expenses.filter(e => {
    const matchTab = tab === "All Expenses" || e.status === STATUS_MAP[tab];
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  async function handleScan(file: File) {
    setScanning(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => { const s = reader.result as string; res(s.indexOf(",") !== -1 ? s.split(",")[1] : s); };
        reader.onerror = () => rej(new Error("Read failed"));
        reader.readAsDataURL(file);
      });
      const { data, error } = await scanReceipt(dataUrl, file.type);
      if (error || !data) { toast({ title:"Scan failed", description: error?.message, variant:"destructive" }); return; }
      const catId = matchCategory(data.category_suggestion);
      setForm(f => ({ ...f,
        title: data.merchant_name || f.title,
        amount: String(data.amount || f.amount),
        currency: data.currency || f.currency,
        expense_date: data.date || f.expense_date,
        description: data.description || f.description,
        category_id: catId || f.category_id,
        vat_amount: String(data.vat_amount || ""),
        vat_rate: String(data.vat_rate || ""),
        tax_registration_number: data.tax_registration_number || f.tax_registration_number,
      }));
    } finally { setScanning(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount) || 0;
    const fxRate = await getFxRate(form.currency, "EUR", form.expense_date);
    createExpense({
      org_id: user?.id, user_id: user?.id, title: form.title,
      description: form.description || null, amount: amt,
      expense_date: form.expense_date, category_id: form.category_id || null,
      currency: form.currency, fx_rate: fxRate,
      base_amount: Math.round(amt * fxRate * 100) / 100,
      base_currency: "EUR",
      vat_amount: parseFloat(form.vat_amount) || null,
      vat_rate: parseFloat(form.vat_rate) || null,
      tax_registration_number: form.tax_registration_number || null,
      status: "submitted",
    } as any);
    setOpen(false);
    setForm(emptyForm);
    toast({ title: "Expense submitted" });
  }

  const statusColor: Record<string,string> = { submitted:"bg-orange-100 text-orange-700", approved:"bg-green-100 text-green-700", rejected:"bg-red-100 text-red-700", draft:"bg-gray-100 text-gray-700", reimbursed:"bg-blue-100 text-blue-700" };

  return (
    <div className="p-6"><DataPageHeader title="Expenses" />
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <Input placeholder="Search by title, merchant..." value={search} onChange={e=>setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex gap-2">
          <DownloadMenu expenses={filtered} />
          <Button onClick={()=>setOpen(true)} className="gap-2"><Plus className="h-4 w-4"/>New expense</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          {STATUS_TABS.map(s=>(
            <TabsTrigger key={s} value={s}>
              {s}
              {s==="All Expenses" && <Badge variant="secondary" className="ml-1">{expenses.length}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Title","Date","Amount","Base (EUR)","Category","Status",""].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e=>(
                <tr key={e.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={()=>{setSelectedExpense(e);setDetailOpen(true);}}>
                  <td className="px-4 py-3 font-medium">{e.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(e.expense_date)}</td>
                  <td className="px-4 py-3">{fmtCurrency(e.amount, e.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.base_amount ? fmtCurrency(e.base_amount,"EUR") : "â"}</td>
                  <td className="px-4 py-3">{e.expense_categories?.name || "â"}</td>
                  <td className="px-4 py-3"><span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (statusColor[e.status]||"")}>{e.status}</span></td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No expenses found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* New Expense Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submit expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required /></div>
              <div><Label>Currency *</Label>
                <Select value={form.currency} onValueChange={v=>setForm({...form,currency:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date *</Label><Input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} required /></div>
            </div>
            <div><Label>Category</Label>
              <Select value={form.category_id} onValueChange={v=>setForm({...form,category_id:v})}>
                <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><textarea className="w-full border rounded px-3 py-2 text-sm min-h-[80px] resize-none" value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>)=>setForm({...form,description:e.target.value})}></textarea></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>VAT Amount</Label><Input type="number" step="0.01" value={form.vat_amount} onChange={e=>setForm({...form,vat_amount:e.target.value})}/></div>
              <div><Label>VAT Rate %</Label><Input type="number" step="0.01" value={form.vat_rate} onChange={e=>setForm({...form,vat_rate:e.target.value})}/></div>
              <div><Label>TRN</Label><Input value={form.tax_registration_number} onChange={e=>setForm({...form,tax_registration_number:e.target.value})}/></div>
            </div>
            <div>
              <Label>Receipt / Invoice</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm hover:bg-muted/50">
                  {scanning ? <span className="animate-spin">â³</span> : <ScanLine className="h-4 w-4"/>}
                  {scanning ? "Scanning..." : "Choose File"}
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e=>{ const f=e.target.files?.[0]; if(f) handleScan(f); }} disabled={scanning}/>
                </label>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isCreating}>{isCreating?"Submitting...":"Submit expense"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[900px] p-0 overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Expense details</DialogTitle></DialogHeader>
          {selectedExpense && (
            <ExpenseDetailView
              expense={expenses.find((e:any)=>e.id===selectedExpense.id)||selectedExpense}
              onClose={()=>setDetailOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
