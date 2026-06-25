-- Reset Maxime Leroy password to Test1234!
UPDATE auth.users
SET encrypted_password = crypt('Test1234!', gen_salt('bf'))
WHERE id = '11111111-1111-1111-1111-111111111105';
