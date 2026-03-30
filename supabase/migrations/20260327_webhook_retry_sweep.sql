-- supabase/migrations/20260327_webhook_retry_sweep.sql
-- Retry sweep infrastructure for failed webhook events.
-- Creates a SQL helper function + optional pg_cron schedule.
-- The webhook-retry-sweep edge function is the primary retry driver;
-- this cron job acts as a fallback sweeper every 5 minutes.
-- Depends on: 20260327_webhook_events.sql
-- Safe to re-run: uses OR REPLACE / conditional schedule insert.

-- ── 1. Reset eligible failed events back to pending ───────────────────────────
CREATE OR REPLACE FUNCTION sweep_failed_webhooks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  swept integer;
BEGIN
  WITH eligible AS (
    SELECT id FROM webhook_events
    WHERE status = 'failed'
      AND attempts < 5
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  )
  UPDATE webhook_events we
  SET
    status     = 'pending',
    last_error = coalesce(last_error, '') || ' [swept ' || now()::text || ']'
  FROM eligible
  WHERE we.id = eligible.id;

  GET DIAGNOSTICS swept = ROW_COUNT;
  RETURN swept;
END;
$$;

-- ── 2. pg_cron schedule (no-op if extension unavailable) ─────────────────────
DO $$
BEGIN
  -- Check whether pg_cron is available
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- Idempotent: remove old schedule then re-add
    BEGIN
      PERFORM cron.unschedule('webhook-retry-sweep');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'webhook-retry-sweep',
      '*/5 * * * *',
      $$SELECT sweep_failed_webhooks()$$
    );
  END IF;
END $$;
