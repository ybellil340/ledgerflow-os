// src/hooks/useExportBatches.ts
// Phase C: React hook for export batch management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import type {
  ExportBatch,
  CreateExportBatchRequest,
  ExportGenerateResponse,
} from "@/types/accounting";

export function useExportBatches() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // âââ List export batches ââââââââââââââââââââââââââââââââââââ
  const {
    data: batches = [],
    isLoading,
    error,
  } = useQuery<ExportBatch[]>({
    queryKey: ["export-batches", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_batches")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExportBatch[];
    },
    enabled: !!orgId,
  });

  // âââ Trigger server-side export âââââââââââââââââââââââââââââ
  const generateExport = useMutation<ExportGenerateResponse, Error, CreateExportBatchRequest>({
    mutationFn: async (request) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke("export-generate", {
        body: {
          org_id: orgId,
          export_type: request.export_type,
          period_start: request.period_start,
          period_end: request.period_end,
          include_expenses: request.include_expenses ?? true,
          include_ap: request.include_ap ?? true,
          include_ar: request.include_ar ?? true,
          include_reimbursements: request.include_reimbursements ?? false,
          consultant_number: request.consultant_number ?? "1234567",
          client_number: request.client_number ?? "12345",
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.error) {
        throw new Error(response.error.message || "Export generation failed");
      }

      return response.data as ExportGenerateResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["export-batches"] });

      if (data.validation_errors?.length) {
        toast({
          title: "Export validation failed",
          description: data.validation_errors.join("; "),
          variant: "destructive",
        });
        return;
      }

      if (data.record_count === 0) {
        toast({
          title: "No records found",
          description: "No bookings found in the selected period.",
        });
        return;
      }

      // Trigger download if URL available
      if (data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = `EXTF_export_${data.batch_id}.csv`;
        a.click();
      }

      toast({
        title: "DATEV Export",
        description: `${data.record_count} Buchungen exportiert (Batch v${data.batch_id?.substring(0, 8)}).`,
      });
    },
    onError: (e) => {
      toast({
        title: "Export failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  // âââ Check if a batch is stale ââââââââââââââââââââââââââââââ
  const checkStale = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke("export-stale-check", {
        body: { batch_id: batchId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.is_stale) {
        toast({
          title: "Export is stale",
          description: `${data.changed_count} of ${data.total_records} records have changed since export.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Export is current",
          description: "No source records have changed since this export.",
        });
      }
    },
  });

  return {
    batches,
    isLoading,
    error,
    generateExport,
    checkStale,
  };
}
