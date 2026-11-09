ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interested_in TEXT;

COMMENT ON COLUMN public.profiles.interested_in IS 'Apartment type chosen at signup.';
