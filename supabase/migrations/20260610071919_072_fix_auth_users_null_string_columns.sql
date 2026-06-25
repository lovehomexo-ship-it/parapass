
-- Fix auth.users columns that must be '' not NULL for GoTrue to serialize the user correctly.
-- When these columns are NULL instead of '', GoTrue throws "Database error querying schema"
-- during signInWithPassword because the user object fails internal serialization.

UPDATE auth.users
SET
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, ''),
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  updated_at                 = now()
WHERE email IN ('maxime.leroy@demo.fr', 'nicolas.girard@demo.fr');
