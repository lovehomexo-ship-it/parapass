import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarreEtat } from './BarreEtat';
import { BasculeMode } from './BasculeMode';
import { Tiroir } from './Tiroir';
import { surface, rayure, pastille, action, enTeteSection } from '../lib/jetons';

// ═══════════════════════════════════════════════════════════════════════════
// Contrairement aux tests fumée d'écran, ceux-ci ont une VRAIE portée : les
// trois composants du LOT 2/3 sont purement présentationnels, sans effet ni
// appel réseau. Le rendu statique les exerce donc entièrement — un composant
// indéfini ou un jeton disparu tombe ici (React #130).
// ═══════════════════════════════════════════════════════════════════════════

describe('système visuel — rendu réel', () => {
  it('BarreEtat rend défauts et activités, et le zéro s’éteint', () => {
    const html = renderToStaticMarkup(
      <BarreEtat compteurs={[
        { genre: 'defaut', cle: 'a', valeur: 3, libelle: 'licences FFP expirées',
          gravite: 'critique', onAller: () => {} },
        { genre: 'defaut', cle: 'b', valeur: 0, libelle: 'carnets à valider',
          gravite: 'vigilance', onAller: () => {} },
        { genre: 'activite', cle: 'c', valeur: 6, libelle: 'sauts aujourd’hui' },
      ]} />);
    expect(html).toContain('licences FFP expirées');
    // Un défaut non nul est cliquable ; à zéro il ne l'est plus (règle 4).
    expect(html.match(/<button/g) ?? []).toHaveLength(1);
    // La rayure de sévérité est bien posée, avec sa forme.
    expect(html).toMatch(/border-left:5px solid/);
  });

  it('BasculeMode expose ses deux modes au clavier', () => {
    const html = renderToStaticMarkup(
      <BasculeMode mode="journee" onChange={() => {}} enAttenteGestion={4} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Gestion');
    // La pastille n'apparaît que sur le mode INACTIF.
    expect(html).toContain('4 éléments en attente');
  });

  it('Tiroir est un vrai dépliant accessible', () => {
    const html = renderToStaticMarkup(
      <Tiroir titre="Profil de vent" cle="test"><p>contenu</p></Tiroir>);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls=');
  });

  it('les jetons produisent des styles exploitables', () => {
    expect(surface(1).boxShadow).toBeTruthy();
    expect(surface(2).boxShadow).toBeUndefined();      // niveau 2 : pas d'ombre
    expect(surface(3).background).toBe('transparent'); // niveau 3 : pas de conteneur
    expect(rayure('vigilance').borderLeft).toContain('dashed');
    expect(pastille('critique').color).toBe('var(--sev-critique)');
    expect(action('principal').background).toBe('var(--action-fond)');
    expect(action('texte').background).toBe('transparent');
    expect(enTeteSection.fontSize).toBe(13);
  });
});
