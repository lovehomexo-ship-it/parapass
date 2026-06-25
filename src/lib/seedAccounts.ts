// This module is intentionally kept as a no-op on the client side.
//
// The moniteur demo accounts (nicolas.girard@demo.fr, maxime.leroy@demo.fr) are
// created and maintained exclusively through Supabase migrations (069+).
// Attempting to signIn/signUp on behalf of other users from the client disrupts
// the active session and causes "Database error querying schema" in GoTrue.
//
// To reset or recreate these accounts, apply a new SQL migration instead.

export async function ensureTestAccounts(): Promise<void> {
  // No-op: accounts are managed via migrations, not client-side seeding.
  return Promise.resolve();
}
