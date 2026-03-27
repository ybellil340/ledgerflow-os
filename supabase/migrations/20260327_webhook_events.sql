-- supabase/migrations/20260327_webhook_events.sql
-- Webhook ingestion + transaction event architecture.
-- Depends on: 20260327_cards_v2.sql (provider column on cards).

CREATE TABLE IF NOT EXISTS webhook_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         text        NOT NULL,
  event_type       text        NOT NULL,
  idempotency_key  text        NOT NULL,
  raw_payload      jsonb       NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','processing','processed','failed','dead')),
  attempts         int         NOT NULL DEFAULT 0,
  last_error       text,
  org_id           uuid        REFERENCES organizations(id),
  processed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency
  ON webhook_events (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_created
  ON webhook_events (status, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
  ON webhook_events (provider, event_type);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS provider_tx_id    text,
  ADD COLUMN IF NOT EXISTS webhook_event_id  uuid REFERENCES webhook_events(id),
  ADD COLUMN IF NOT EXISTS tx_status         text NOT NULL DEFAULT 'pending'
    CHECK (tx_status IN ('pending','authorized','cleared','settled','failed','reversed','disputed')),
  ADD COLUMN IF NOT EXISTS merchant_name     text,
  ADD COLUMN IF NOT EXISTS merchant_mcc      text,
  ADD COLUMN IF NOT EXISTS currency          text DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS authorized_at     timestamptz,
  ADD COLUMN IF NOT EXISTS cleared_at        timestamptz,
  ADD COLUMN IF NOT EXISTS settled_at        timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_tx_id
  ON transactions (org_id, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_webhook_event
  ON transactions (webhook_event_id)
  WHERE webhook_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_tx_status
  ON transactions (org_id, tx_status, transaction_date DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_events_select ON webhook_events
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role = 'company_admin'
    )
  );

CREATE POLICY webhook_events_no_browser_write ON webhook_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
