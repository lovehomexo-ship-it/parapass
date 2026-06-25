/*
  # Auto-confirm emails: confirm existing accounts + RPC + updated trigger

  ## Changes

  1. Confirm all unconfirmed auth users immediately (including kevin.lorin@gmail.com)
  2. Create `public.confirm_user_email(text)` — SECURITY DEFINER RPC callable by
     anon/authenticated so the frontend can confirm a user before retrying sign-in
  3. Replace `public.handle_new_user` trigger to:
     - Auto-set email_confirmed_at on the new auth.users row (AFTER INSERT means
       we UPDATE immediately so the row is confirmed before any sign-in attempt)
     - Upsert the public.profiles row with nom/prenom/role from metadata

  ## Security
  - confirm_user_email is intentionally callable by anon; it only sets
    email_confirmed_at when it is NULL (no-op if already confirmed)
  - handle_new_user remains SECURITY DEFINER so it can write to auth.users
*/

-- 1. Confirm all currently unconfirmed accounts
UPDATE auth.users
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email_confirmed_at IS NULL;

-- 2. RPC: confirm a user email by address (idempotent)
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE email = lower(trim(user_email));
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_user_email(text) TO anon, authenticated;

-- 3. Updated handle_new_user: auto-confirm + upsert profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-confirm email so sign-in works immediately after signUp()
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = NEW.id;

  -- Upsert profile (trigger fires AFTER INSERT so auth.uid() = NEW.id)
  INSERT INTO public.profiles (id, email, nom, prenom, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'parachutiste')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
