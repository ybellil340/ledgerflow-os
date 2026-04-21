// src/hooks/usePeriodLocks.ts
// Phase C: React hook for period lock management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import type { PeriodLock, CreatePeriodLockRequest } from "@/types/accounting";

export function usePeriodLocks() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // âââ List period locks ââââââââââââââââââââââââââââââââââââââ
  const {
    data: locks = [],
    isLoading,
    error,
  } = useQuery<PeriodLock[]>({
    queryKey: ["period-locks", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_locks")
        .select("*")
        .eq("org_id", orgId!)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as PeriodLock[];
    },
    enabled: !!orgId,
  });

  // âââ Lock a period ââââââââââââââââââââââââââââââââââââââââââ
  const lockPeriod = useMutation<PeriodLock, Error, CreatePeriodLockRequest>({
    mutationFn: async (request) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke("period-lock", {
        body: {
          org_id: orgId,
          action: "lock",
          period_start: request.period_start,
          period_end: request.period_end,
          notes: request.notes,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data as PeriodLock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-locks"] });
      toast({ title: "Period locked", description: "Accounting period has been locked." });
    },
    onError: (e) => {
      toast({ title: "Lock failed", description: e.message, variant: "destructive" });
    },
  });

  // âââ Unlock a period ââââââââââââââââââââââââââââââââââââââââ
  const unlockPeriod = useMutation<PeriodLock, Error, { lockId: string; notes?: string }>({
    mutationFn: async ({ lockId, notes }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke("period-lock", {
        body: {
          org_id: orgId,
          action: "unlock",
          lock_id: lockId,
          notes,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data as PeriodLock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-locks"] });
      toast({ title: "Period unlocked", description: "Accounting period has been unlocked." });
    },
    onError: (e) => {
      toast({ title: "Unlock failed", description: e.message, variant: "destructive" });
    },
  });

  // âââ Helper: check if a date falls in a locked period ââââââ
  const isDateLocked = (date: string): boolean => {
    return locks.some(
      (lock) =>
        lock.lock_status === "locked" &&
        date >= lock.period_start &&
        date <= lock.period_end,
    );
  };

  return {
    locks,
    isLoading,
    error,
    lockPeriod,
    unlockPeriod,
    isDateLocked,
  };
}
