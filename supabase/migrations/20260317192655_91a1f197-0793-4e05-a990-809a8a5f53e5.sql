
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate functions using extensions.crypt and extensions.gen_salt
CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf'))
  WHERE user_id = auth.uid();
  RETURN FOUND;
END;
$$;

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
  RETURN _hash = extensions.crypt(_pin, _hash);
END;
$$;

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
  SELECT p.pin_hash INTO _hash FROM public.profiles p WHERE p.user_id = auth.uid();
  IF _hash IS NULL OR _hash != extensions.crypt(_pin, _hash) THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT c.org_id, c.holder_id INTO _card_org, _card_holder FROM public.cards c WHERE c.id = _card_id;
  IF _card_org IS NULL THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

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
