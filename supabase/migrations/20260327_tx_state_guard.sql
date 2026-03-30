-- supabase/migrations/20260327_tx_state_guard.sql
-- DB-level transaction status state machine enforcement.
-- BEFORE UPDATE trigger that rejects illegal tx_status transitions.
-- Allowed transition map:
--
--   pending      → authorized  (payment terminal approved pre-auth)
--   pending      → failed      (declined at authorization)
--
--   authorized   → cleared     (issuer clears funds for settlement)
--   authorized   → failed      (post-auth failure — timeout, processor error)
--   authorized   → reversed    (merchant-initiated void before settlement)
--   authorized   → disputed    (chargeback filed while authorized)
--
--   cleared      → settled     (funds actually move to merchant)
--   cleared      → reversed    (late void / refund before settlement completes)
--   cleared      → disputed    (chargeback filed while cleared)
--
--   settled      → disputed    (chargeback filed after settlement)
--   disputed     → settled     (dispute resolved in merchant favour)
--   disputed     → reversed    (dispute resolved in cardholder favour)
--
--   failed       → (terminal — no further transitions)
--   reversed     → (terminal — no further transitions)
--
-- Depends on: 20260327_webhook_events.sql (tx_status column on transactions)
-- Safe to re-run: uses OR REPLACE / DROP IF EXISTS.

CREATE OR REPLACE FUNCTION enforce_tx_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  allowed_origins text[];
BEGIN
  -- No-op if status unchanged
  IF NEW.tx_status = OLD.tx_status THEN
    RETURN NEW;
  END IF;

  -- Map target status → valid origin statuses
  allowed_origins := CASE NEW.tx_status
    WHEN 'authorized' THEN ARRAY['pending']
    WHEN 'cleared'    THEN ARRAY['authorized']
    WHEN 'settled'    THEN ARRAY['cleared', 'disputed']
    WHEN 'failed'     THEN ARRAY['pending', 'authorized']
    WHEN 'reversed'   THEN ARRAY['authorized', 'cleared', 'disputed']
    WHEN 'disputed'   THEN ARRAY['authorized', 'cleared', 'settled']
    ELSE NULL  -- 'pending' is the initial state; no incoming transitions
  END;

  IF allowed_origins IS NULL OR NOT (OLD.tx_status = ANY(allowed_origins)) THEN
    RAISE EXCEPTION
      'Illegal tx_status transition: % → % (tx id: %)',
      OLD.tx_status, NEW.tx_status, OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tx_status_guard ON transactions;
CREATE TRIGGER trg_tx_status_guard
  BEFORE UPDATE OF tx_status ON transactions
  FOR EACH ROW EXECUTE FUNCTION enforce_tx_status_transition();
