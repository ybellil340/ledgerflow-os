
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS allowed_countries text[] DEFAULT '{}';
