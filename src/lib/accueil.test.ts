import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { accueilDuRole } from './accueil';

// L'ÉCRAN BLANC DU TÉLÉPHONE. La garde des routes renvoyait tout rôle refusé
// vers « /dashboard », qui refuse les comptes centre : boucle, page vide. La
// règle qui l'empêche : l'accueil d'un rôle est une page que ce rôle a le
// droit d'ouvrir. On la vérifie contre les routes réellement déclarées.
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

function rolesDeLaRoute(chemin: string): string[] | null {
  const ligne = app.split('\n').find(l => l.includes(`path="${chemin}"`));
  if (!ligne) return null;
  const m = ligne.match(/roles=\{\[([^\]]*)\]\}/);
  // Sans liste de rôles, la route admet tout utilisateur connecté.
  return m ? m[1].split(',').map(r => r.trim().replace(/'/g, '')) : [];
}

describe('accueilDuRole', () => {
  for (const role of ['admin_centre', 'admin', 'parachutiste', 'moniteur', 'moniteur_delegue']) {
    it(`mène « ${role} » vers une page qu'il peut ouvrir`, () => {
      const accueil = accueilDuRole(role);
      // La route déclarée est le premier segment pour l'espace centre
      // (« /centre/:section »), le chemin exact sinon.
      const roles = rolesDeLaRoute(accueil) ?? rolesDeLaRoute(accueil.split('/').slice(0, 2).join('/'));
      expect(roles, `aucune route déclarée pour ${accueil}`).not.toBeNull();
      if (roles!.length) expect(roles).toContain(role);
    });
  }

  it("ne renvoie jamais un compte centre vers le tableau de bord parachutiste", () => {
    expect(accueilDuRole('admin_centre')).not.toBe('/dashboard');
    expect(rolesDeLaRoute('/dashboard')).not.toContain('admin_centre');
  });

  it('est bien la table qu’utilise la garde des routes', () => {
    const garde = readFileSync(new URL('../components/ProtectedRoute.tsx', import.meta.url), 'utf8');
    expect(garde).toContain('accueilDuRole(profile.role)');
    expect(garde).not.toMatch(/<Navigate to="\/dashboard"/);
  });
});
