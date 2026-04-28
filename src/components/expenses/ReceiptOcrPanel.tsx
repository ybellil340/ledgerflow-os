// src/components/expenses/ReceiptOcrPanel.tsx
// Phase D: Receipt upload + OCR processing UI component
// Shows upload → processing → success/failure states with extracted field preview

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, CheckCircle2, AlertTriangle, RotateCcw, Pencil, X } from "lucide-react";
import { useOcrExtraction } from "@/hooks/useOcrExtraction";

interface ReceiptOcrPanelProps {
  expenseId?: string;
  onExtractionComplete?: (fields: {
    merchant_name: string;
    amount: number;
    date: string;
    currency: string;
    tax_amount: number | null;
    receipt_number: string | null;
  }) => void;
}

export function ReceiptOcrPanel({ expenseId, onExtractionComplete }: ReceiptOcrPanelProps) {
  const { status, fields, error, processReceipt, retry, correctExtraction, reset } = useOcrExtraction();
  const [preview, setPreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string | number | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Create preview
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        setPreview(dataUrl);
        await processReceipt(dataUrl, file.type, expenseId);
      };
      reader.readAsDataURL(file);
    },
    [processReceipt, expenseId],
  );

  const handleApply = useCallback(() => {
    if (!fields) return;
    onExtractionComplete?.({
      merchant_name: fields.merchant_name,
      amount: fields.amount,
      date: fields.date,
      currency: fields.currency,
      tax_amount: fields.tax_amount,
      receipt_number: fields.receipt_number,
    });
  }, [fields, onExtractionComplete]);

  const handleStartEdit = useCallback(() => {
    if (!fields) return;
    setEditFields({
      merchant_name: fields.merchant_name,
      amount: fields.amount,
      date: fields.date,
      currency: fields.currency,
      tax_amount: fields.tax_amount,
      receipt_number: fields.receipt_number,
    });
    setIsEditing(true);
  }, [fields]);

  const handleSaveCorrections = useCallback(async () => {
    await correctExtraction({
      merchant_name: editFields.merchant_name as string,
      amount: Number(editFields.amount),
      currency: editFields.currency as string,
      tax_amount: editFields.tax_amount != null ? Number(editFields.tax_amount) : null,
      transaction_date: editFields.date as string,
      receipt_number: editFields.receipt_number as string | null,
    });
    setIsEditing(false);
  }, [correctExtraction, editFields]);

  const handleReset = useCallback(() => {
    reset();
    setPreview(null);
    setIsEditing(false);
    setEditFields({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Receipt Scanner
          {status !== "idle" && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Upload state */}
        {status === "idle" && (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click to upload receipt</span>
            <span className="text-xs text-muted-foreground mt-1">JPG, PNG, or PDF</span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {/* Processing state */}
        {status === "processing" && (
          <div className="flex flex-col items-center justify-center h-32 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Extracting receipt data...</span>
          </div>
        )}

        {/* Failed state */}
        {status === "failed" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Extraction failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={retry}>
                <RotateCcw className="h-4 w-4 mr-1" /> Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Upload different image
              </Button>
            </div>
          </div>
        )}

        {/* Success state */}
        {status === "completed" && fields && !isEditing && (
          <div className="space-y-3">
            {/* Confidence badge */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Extracted</span>
              <Badge variant={fields.confidence >= 0.7 ? "default" : "secondary"}>
                {Math.round(fields.confidence * 100)}% confidence
              </Badge>
            </div>

            {/* Warnings */}
            {fields.warnings.length > 0 && (
              <div className="p-2 bg-yellow-500/10 rounded text-xs space-y-1">
                {fields.warnings.map((w, i) => (
                  <div key={i} className="flex gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Extracted fields preview */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Merchant</span>
                <p className="font-medium">{fields.merchant_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Amount</span>
                <p className="font-medium">
                  {fields.amount.toFixed(2)} {fields.currency}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Date</span>
                <p className="font-medium">{fields.date}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Tax</span>
                <p className="font-medium">
                  {fields.tax_amount != null ? `${fields.tax_amount.toFixed(2)} ${fields.currency}` : "—"}
                </p>
              </div>
              {fields.receipt_number && (
                <div className="col-span-2">
                  <span className="text-muted-foreground text-xs">Receipt #</span>
                  <p className="font-medium">{fields.receipt_number}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleApply}>
                Apply to expense
              </Button>
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Pencil className="h-3 w-3 mr-1" /> Correct
              </Button>
            </div>
          </div>
        )}

        {/* Manual correction mode */}
        {isEditing && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Manual correction</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Merchant"
                value={editFields.merchant_name ?? ""}
                onChange={(e) => setEditFields({ ...editFields, merchant_name: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={editFields.amount ?? ""}
                onChange={(e) => setEditFields({ ...editFields, amount: e.target.value })}
              />
              <Input
                type="date"
                value={editFields.date ?? ""}
                onChange={(e) => setEditFields({ ...editFields, date: e.target.value })}
              />
              <Input
                placeholder="Currency"
                value={editFields.currency ?? ""}
                onChange={(e) => setEditFields({ ...editFields, currency: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Tax amount"
                value={editFields.tax_amount ?? ""}
                onChange={(e) => setEditFields({ ...editFields, tax_amount: e.target.value || null })}
              />
              <Input
                placeholder="Receipt #"
                value={editFields.receipt_number ?? ""}
                onChange={(e) => setEditFields({ ...editFields, receipt_number: e.target.value || null })}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveCorrections}>
                Save corrections
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Receipt image preview */}
        {preview && status !== "idle" && (
          <div className="mt-2">
            <img src={preview} alt="Receipt" className="w-full max-h-48 object-contain rounded border" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
