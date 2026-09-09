import { describe, it, expect } from 'vitest';
import {
  MODULES, LIVE_MODULE_IDS, STUDIO_MODULE_IDS, PRIX_MODULES_SEPARES,
  ECONOMIE_STUDIO, computeActiveModules,
} from './modules';

// ═══════════════════════════════════════════════════════════════════════════
// Le catalogue porte des règles COMMERCIALES. Une erreur ici ne casse aucun
// build : elle donne un module payant sans le facturer, ou fait payer deux
// fois. Ces tests sont la seule garde.
// ═══════════════════════════════════════════════════════════════════════════

const AV = MODULES.find(m => m.id === 'avionnage')!;

describe('Avionnage — module vendu seul, hors pack', () => {
  it('est disponible, à 49,97 €, et marqué hors Studio', () => {
    expect(AV.status).toBe('live');
    expect(AV.prix).toBe(49.97);
    expect(AV.horsStudio).toBe(true);
  });

  it('figure au catalogue live mais JAMAIS dans le pack', () => {
    expect(LIVE_MODULE_IDS).toContain('avionnage');
    expect(STUDIO_MODULE_IDS).not.toContain('avionnage');
  });

  it('n’entre pas dans le prix « séparés », sinon l’économie affichée ment', () => {
    // Le badge dit « Économisez ~X€ vs Y€ séparés ». Y ne peut compter que ce
    // que Studio ouvre réellement.
    expect(PRIX_MODULES_SEPARES).toBe(
      MODULES.filter(m => m.status === 'live' && !m.horsStudio)
             .reduce((s, m) => s + (m.prix ?? 0), 0));
    expect(PRIX_MODULES_SEPARES).toBeLessThan(
      PRIX_MODULES_SEPARES + (AV.prix ?? 0));
    expect(ECONOMIE_STUDIO).toBeGreaterThan(0);
  });

  it('un centre abonné Studio ne l’obtient pas', () => {
    // Reproduit ce qu'écrit la bascule Studio : le pack et ses modules.
    const lignes = ['studio', ...STUDIO_MODULE_IDS].map(id => ({ module_id: id, active: true }));
    const actifs = computeActiveModules(lignes);
    expect(actifs.has('studio')).toBe(true);
    expect(actifs.has('avionnage')).toBe(false);
  });

  it('sans ligne en base, il est FERMÉ — jamais ouvert par défaut', () => {
    expect(computeActiveModules([]).has('avionnage')).toBe(false);
  });

  it('souscrit seul, il s’ouvre sans rien allumer d’autre', () => {
    const actifs = computeActiveModules([{ module_id: 'avionnage', active: true }]);
    expect([...actifs]).toEqual(['avionnage']);
  });
});
