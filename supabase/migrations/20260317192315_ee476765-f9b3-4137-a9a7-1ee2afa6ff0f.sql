
-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add PIN hash to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash text;

-- Add full card details to cards (for virtual card simulation)
ALTER TABLE public.cards 
  ADD COLUMN IF NOT EXISTS card_number_encrypted text,
  ADD COLUMN IF NOT EXISTS expiry_month smallint DEFAULT EXTRACT(MONTH FROM (now() + interval '3 years'))::smallint,
  ADD COLUMN IF NOT EXISTS expiry_year smallint DEFAULT EXTRACT(YEAR FROM (now() + interval '3 years'))::smallint,
  ADD COLUMN IF NOT EXISTS cvv_encrypted text;

-- Generate card details for existing cards that don't have them
UPDATE public.cards 
SET 
  card_number_encrypted = lpad(floor(random() * 10000)::text, 4, '0') || lpad(floor(random() * 10000)::text, 4, '0') || lpad(floor(random() * 10000)::text, 4, '0') || last_four,
  cvv_encrypted = lpad(floor(random() * 1000)::text, 3, '0')
WHERE card_number_encrypted IS NULL;

-- Function to set PIN (hashed with bcrypt)
CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE user_id = auth.uid();
  RETURN FOUND;
END;
$$;

-- Function to verify PIN
CREATE OR REPLACE FUNCTION public.verify_user_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hash text;
BEGIN
  SELECT pin_hash INTO _hash FROM public.profiles WHERE user_id = auth.uid();
  IF _hash IS NULL THEN RETURN FALSE; END IF;
  RETURN _hash = crypt(_pin, _hash);
END;
$$;

-- Function to check if user has PIN set
CREATE OR REPLACE FUNCTION public.has_pin_set()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND pin_hash IS NOT NULL
  );
END;
$$;

-- Function to get card sensitive details after PIN verification
CREATE OR REPLACE FUNCTION public.get_card_details(_card_id uuid, _pin text)
RETURNS TABLE(card_number text, expiry_month smallint, expiry_year smallint, cvv text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hash text;
  _card_org uuid;
  _card_holder uuid;
  _user_role app_role;
BEGIN
  -- Verify PIN
  SELECT p.pin_hash INTO _hash FROM public.profiles p WHERE p.user_id = auth.uid();
  IF _hash IS NULL OR _hash != crypt(_pin, _hash) THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  -- Get card info
  SELECT c.org_id, c.holder_id INTO _card_org, _card_holder FROM public.cards c WHERE c.id = _card_id;
  IF _card_org IS NULL THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  -- Check: must be card holder OR admin of the org
  SELECT om.role INTO _user_role FROM public.org_members om 
  WHERE om.user_id = auth.uid() AND om.org_id = _card_org AND om.is_active = true;

  IF _user_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF auth.uid() != _card_holder AND _user_role != 'company_admin' THEN
    RAISE EXCEPTION 'Not authorized to view this card';
  END IF;

  RETURN QUERY
  SELECT c.card_number_encrypted, c.expiry_month, c.expiry_year, c.cvv_encrypted
  FROM public.cards c WHERE c.id = _card_id;
END;
$$;
