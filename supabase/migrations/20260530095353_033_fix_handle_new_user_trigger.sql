/*
  # Fix handle_new_user trigger for auto-profile creation

  ## Summary
  Creates or replaces the trigger function that automatically creates a profile row
  in the `profiles` table when a new user signs up via Supabase Auth.
  This prevents "profile not found" issues for newly registered users.

  ## Details
  - Trigger fires AFTER INSERT on auth.users
  - Uses NEW.raw_user_meta_data to populate nom/prenom if provided during signup
  - Falls back to safe defaults for all required fields
  - Uses INSERT ... ON CONFLICT DO NOTHING to be idempotent
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    nom,
    prenom,
    numero_licence,
    role,
    type_pratiquant,
    nationalite,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'numero_licence', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'parachutiste'),
    COALESCE(NEW.raw_user_meta_data->>'type_pratiquant', 'amateur'),
    COALESCE(NEW.raw_user_meta_data->>'nationalite', 'Française'),
    now()
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
