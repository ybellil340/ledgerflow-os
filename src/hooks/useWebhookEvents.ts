// src/hooks/useWebhookEvents.ts
// React Query hooks for webhook_events (read-only from browser).
// Separated from useTransactions to keep concerns isolated.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { WebhookEvent } from "@/types/transactions";

const PAGE_SIZE = 50;

// ── useWebhookEvents ──────────────────────────────────────────────────────────
// Paginated list of webhook events for the current org (company_admin only via RLS).

interface UseWebhookEventsOptions {
  status?: WebhookEvent["status"] | "all";
  page?: number;
}

export function useWebhookEvents(options: UseWebhookEventsOptions = {}) {
  const { orgId } = useOrganization();
  const page = options.page ?? 0;
  const status = options.status ?? "all";

  return useQuery({
    queryKey: ["webhook-events", orgId, status, page],
    queryFn: async (): Promise<{ data: WebhookEvent[]; count: number }> => {
      let query = supabase
        .from("webhook_events")
        .select("*", { count: "exact" })
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as WebhookEvent[], count: count ?? 0 };
    },
    enabled: !!orgId,
    staleTime: 15_000,
    refetchInterval: 30_000, // poll for real-time feel without a subscription
  });
}

// ── useWebhookEvent ───────────────────────────────────────────────────────────
// Single webhook event by id (for detail view / debugging).

export function useWebhookEvent(eventId: string | null) {
  return useQuery({
    queryKey: ["webhook-event", eventId],
    queryFn: async (): Promise<WebhookEvent> => {
      const { data, error } = await supabase
        .from("webhook_events")
        .select("*")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data as WebhookEvent;
    },
    enabled: !!eventId,
    staleTime: 15_000,
  });
}
