/**
 * La page d'accueil de chaque rôle — UNE définition, partagée par la connexion
 * et par la garde des routes.
 *
 * La garde renvoyait tout rôle non autorisé vers « /dashboard », qui n'admet
 * que les parachutistes et moniteurs : un compte centre y était renvoyé… vers
 * « /dashboard », sans fin, et React Router n'affichait plus rien. C'est l'écran
 * blanc de l'application installée sur téléphone, qui s'ouvre justement sur
 * « /dashboard » (start_url du manifeste).
 */
export function accueilDuRole(role: string | null | undefined): string {
  if (role === 'admin_centre') return '/centre/journee';
  if (role === 'admin') return '/admin';
  // moniteur et parachutiste partagent le tableau de bord unifié
  return '/dashboard';
}
