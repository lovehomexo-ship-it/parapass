
-- Fix handle_new_user trigger: remove the UPDATE auth.users self-write.
-- Writing to auth.users from inside an AFTER INSERT trigger on auth.users
-- causes "Database error querying schema" in GoTrue because GoTrue's internal
-- transaction cannot complete while the trigger modifies the same row.
-- Email confirmation is handled at account creation time via direct SQL migrations.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
