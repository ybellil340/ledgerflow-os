-- supabase/migrations/20260327_cards_v2b_fix_rpc.sql
-- Patch 1: Fix get_card_details RPC after card_number_encrypted / cvv_encrypted columns dropped.
-- Also adds RESTRICTIVE UPDATE policy as defense-in-depth (Issue 9).
-- Commit this AFTER 20260327_cards_v2.sql.

DROP FUNCTION IF EXISTS get_card_details(uuid, uuid, text);

CREATE OR REPLACE FUNCTION get_card_details(
  p_card_id   uuid,
  p_user_id   uuid,
  p_pin       text
)
RETURNS TABLE (
  card_id       uuid,
  card_name     text,
  last_four     text,
  expiry_month  int,
  expiry_year   int,
  card_type     text,
  status        text,
  spending_limit numeric,
  spend_period  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin_hash text;
BEGIN
  SELECT c.pin_hash
  INTO   v_pin_hash
  FROM   cards c
  WHERE  c.id      = p_card_id
    AND  c.holder_id = p_user_id
    AND  c.status  != 'cancelled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found or access denied';
  END IF;

  IF NOT (crypt(p_pin, v_pin_hash) = v_pin_hash) THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  RETURN QUERY
    SELECT
      c.id,
      c.card_name,
      c.last_four,
      c.expiry_month,
      c.expiry_year,
      c.card_type,
      c.status,
      c.spending_limit,
      c.spend_period
    FROM   cards c
    WHERE  c.id = p_card_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_card_details(uuid, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_card_details(uuid, uuid, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cards'
      AND policyname = 'cards_no_direct_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY cards_no_direct_update ON cards
        AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (false)
        WITH CHECK (false);
    $policy$;
  END IF;
END;
$$;
