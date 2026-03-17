import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/DataPageLayout";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Upload, Loader2, ChevronUp, ChevronDown, ScanLine, Pencil, RotateCcw } from "lucide-react";

interface ExpenseDetailViewProps {
  expense: any;
  onClose: () => void;
}

export default function ExpenseDetailView({ expense, onClose }: ExpenseDetailViewProps) {
  const { orgId, role } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isApprover = role === "company_admin" || role === "finance_manager" || role === "approver";

  const [accountingOpen, setAccountingOpen] = useState(true);
  const [taxOpen, setTaxOpen] = useState(true);
  const [scanning, setScanning] = useState(false);
  const isRejected = expense.status === "rejected";
  const isOwner = user?.id === expense.submitter_id;
  const canEdit = isOwner && (expense.status === "draft" || isRejected);
  const [editing, setEditing] = useState(false);

  // Editable core fields (for resubmit)
  const [editTitle, setEditTitle] = useState(expense.title);
  const [editAmount, setEditAmount] = useState(expense.amount?.toString() || "");
  const [editDate, setEditDate] = useState(expense.expense_date || "");
  const [editDescription, setEditDescription] = useState(expense.description || "");

  // Editable fields
  const [categoryId, setCategoryId] = useState(expense.category_id || "");
  const [costCenterId, setCostCenterId] = useState(expense.cost_center_id || "");
  const [vatAmount, setVatAmount] = useState(expense.vat_amount?.toString() || "0");
  const [vatRate, setVatRate] = useState(expense.vat_rate?.toString() || "0");
  const [trn, setTrn] = useState(expense.tax_registration_number || "");

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").eq("org_id", orgId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_centers").select("*").eq("org_id", orgId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const updateExpense = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("expenses").update(updates).eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Expense updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      const updates: any = {
        status,
        ...(status === "approved" ? { approved_at: new Date().toISOString(), approver_id: user!.id } : {}),
        ...(status === "rejected" ? { rejected_at: new Date().toISOString(), approver_id: user!.id, rejection_reason: reason } : {}),
      };
      const { error } = await supabase.from("expenses").update(updates).eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
      toast({ title: "Expense updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resubmitExpense = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").update({
        title: editTitle,
        amount: parseFloat(editAmount),
        expense_date: editDate,
        description: editDescription || null,
        category_id: categoryId || null,
        cost_center_id: costCenterId || null,
        vat_amount: parseFloat(vatAmount) || 0,
        vat_rate: parseFloat(vatRate) || 0,
        tax_registration_number: trn || null,
        status: "submitted" as any,
        submitted_at: new Date().toISOString(),
        rejection_reason: null,
        rejected_at: null,
        approver_id: null,
      }).eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
      toast({ title: "Expense resubmitted for approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleScanReceipt = async () => {
    if (!expense.receipt_url) {
      toast({ title: "No receipt", description: "Upload a receipt first", variant: "destructive" });
      return;
    }
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { imageUrl: expense.receipt_url },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.data;
      if (result) {
        // Auto-fill fields from OCR
        if (result.vat_amount != null) setVatAmount(result.vat_amount.toString());
        if (result.vat_rate != null) setVatRate(result.vat_rate.toString());
        if (result.tax_registration_number) setTrn(result.tax_registration_number);

        // Match category by suggestion
        if (result.category_suggestion) {
          const match = categories.find((c: any) =>
            c.name.toLowerCase().includes(result.category_suggestion.toLowerCase()) ||
            result.category_suggestion.toLowerCase().includes(c.name.toLowerCase())
          );
          if (match) setCategoryId(match.id);
        }

        // Save OCR results to DB
        await updateExpense.mutateAsync({
          vat_amount: result.vat_amount || 0,
          vat_rate: result.vat_rate || 0,
          tax_registration_number: result.tax_registration_number || null,
          ...(result.category_suggestion && categories.find((c: any) =>
            c.name.toLowerCase().includes(result.category_suggestion.toLowerCase())
          ) ? { category_id: categories.find((c: any) =>
            c.name.toLowerCase().includes(result.category_suggestion.toLowerCase())
          )!.id } : {}),
        });

        toast({ title: "Receipt scanned", description: "Fields auto-filled from receipt" });
      }
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleSaveAccountingFields = () => {
    updateExpense.mutate({
      category_id: categoryId || null,
      cost_center_id: costCenterId || null,
      vat_amount: parseFloat(vatAmount) || 0,
      vat_rate: parseFloat(vatRate) || 0,
      tax_registration_number: trn || null,
    });
  };

  const handleReceiptUpload = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    await updateExpense.mutateAsync({ receipt_url: urlData.publicUrl });
  };

  return (
    <div className="flex h-full min-h-[500px] max-h-[80vh]">
      {/* Left: Receipt viewer */}
      <div className="flex-1 bg-muted/30 border-r border-border flex flex-col items-center justify-center p-4 relative min-w-0">
        {expense.receipt_url ? (
          <div className="w-full h-full flex flex-col">
            {expense.receipt_url.toLowerCase().endsWith(".pdf") ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-24 rounded-lg bg-muted border border-border flex flex-col items-center justify-center">
                  <span className="text-2xl">📄</span>
                  <span className="text-[10px] font-medium text-muted-foreground mt-1">PDF</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {expense.receipt_url.split("/").pop()?.substring(0, 40)}
                </p>
                <Button size="sm" variant="outline" asChild>
                  <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">Open PDF receipt</a>
                </Button>
              </div>
            ) : (
              <img
                src={expense.receipt_url}
                alt="Receipt"
                className="max-w-full max-h-[calc(80vh-120px)] object-contain mx-auto rounded"
              />
            )}
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleScanReceipt} disabled={scanning}>
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                {scanning ? "Scanning..." : "Scan receipt"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No receipt uploaded</p>
            <label>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])}
              />
              <Button size="sm" variant="outline" asChild>
                <span className="cursor-pointer">Upload receipt</span>
              </Button>
            </label>
          </div>
        )}
      </div>

      {/* Right: Detail panel */}
      <div className="w-[380px] flex-shrink-0 overflow-y-auto">
        {/* Header: merchant + amount */}
        <div className="p-5 border-b border-border">
          {isRejected && isOwner && (
            <div className="mb-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                <X className="h-3.5 w-3.5" /> Rejected{expense.rejection_reason ? `: ${expense.rejection_reason}` : ""}
              </p>
            </div>
          )}
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Amount (€)</Label>
                  <Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="text-sm" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base">{expense.title}</h3>
                  {expense.expense_categories?.name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{expense.expense_categories.name}</p>
                  )}
                </div>
                <p className="text-lg font-bold">
                  {Number(expense.amount).toLocaleString("de-DE", { style: "currency", currency: expense.currency || "EUR" })}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Expense Date</p>
                  <p className="font-medium">
                    {new Date(expense.expense_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <StatusBadge status={expense.status} />
              </div>

              {expense.description && (
                <p className="text-sm text-muted-foreground mt-3">{expense.description}</p>
              )}
            </>
          )}
        </div>

        {/* Receipt match indicator */}
        {expense.receipt_url && (
          <div className="mx-5 mt-4 p-3 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                <ScanLine className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                {(expense.vat_amount > 0 || expense.vat_rate > 0) ? (
                  <p className="text-sm font-medium text-success flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Data extracted
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Scan receipt to extract data</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Accounting Fields */}
        <div className="border-t border-border mt-4">
          <button
            onClick={() => setAccountingOpen(!accountingOpen)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-muted/20"
          >
            Accounting Fields
            {accountingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {accountingOpen && (
            <div className="px-5 pb-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expense Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cost Center</Label>
                <Select value={costCenterId} onValueChange={setCostCenterId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select cost center" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Tax Fields */}
        <div className="border-t border-border">
          <button
            onClick={() => setTaxOpen(!taxOpen)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-muted/20"
          >
            Tax Fields
            {taxOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {taxOpen && (
            <div className="px-5 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">VAT Amount (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">VAT Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tax Registration No. (TRN)</Label>
                <Input
                  value={trn}
                  onChange={(e) => setTrn(e.target.value)}
                  placeholder="e.g. DE123456789"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-5 space-y-3">
          {canEdit && !editing && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {isRejected ? "Edit & Resubmit" : "Edit expense"}
            </Button>
          )}

          {editing && (
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1.5"
                size="sm"
                onClick={() => resubmitExpense.mutate()}
                disabled={resubmitExpense.isPending || !editTitle || !editAmount}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resubmitExpense.isPending ? "Submitting..." : "Resubmit"}
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          {!editing && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleSaveAccountingFields}
              disabled={updateExpense.isPending}
            >
              {updateExpense.isPending ? "Saving..." : "Save fields"}
            </Button>
          )}

          {isApprover && expense.status === "submitted" && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="sm"
                onClick={() => updateStatus.mutate({ status: "approved" })}
                disabled={updateStatus.isPending}
              >
                <Check className="h-4 w-4 mr-1.5" />Approve
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="outline"
                onClick={() => updateStatus.mutate({ status: "rejected", reason: "Rejected by approver" })}
                disabled={updateStatus.isPending}
              >
                <X className="h-4 w-4 mr-1.5" />Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
