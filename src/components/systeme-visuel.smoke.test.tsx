import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarreEtat } from './BarreEtat';
import { BasculeMode } from './BasculeMode';
import { Tiroir } from './Tiroir';
import { surface, rayure, pastille, action, enTeteSection } from '../lib/jetons';
import { FileAvionnage } from './FileAvionnage';
import { FileAvionnageDZ } from '../pages/centre/FileAvionnageDZ';

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
    expect(html).toContain('4 en attente sur Gestion');
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

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — portée réelle et portée limitée, dites franchement.
//
// FileAvionnageDZ fermée rend un VRAI balisage sans qu'aucun effet ne tourne :
// le test l'exerce entièrement. Ouverte, il ne verrait que la branche
// « chargement », puisque renderToStaticMarkup n'exécute pas les effets.
// ═══════════════════════════════════════════════════════════════════════════
describe('avionnage — rendu', () => {
  it('file fermée : la DZ voit l’interrupteur et l’explication, pas une file vide', () => {
    const html = renderToStaticMarkup(
      <FileAvionnageDZ centreId="c1" rotations={[]} ouvert={false}
        onOuvrir={() => {}} onPlace={() => {}} />);
    expect(html).toContain('Ouvrir les inscriptions');
    expect(html).toContain('aria-checked="false"');
    // L'état fermé doit EXPLIQUER, pas laisser croire que personne n'attend.
    expect(html).toContain('ne voient pas l’avionnage');
    expect(html).not.toContain('Personne en attente');
  });

  it('file ouverte : l’interrupteur reflète l’état', () => {
    const html = renderToStaticMarkup(
      <FileAvionnageDZ centreId="c1" rotations={[]} ouvert
        onOuvrir={() => {}} onPlace={() => {}} />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Inscriptions ouvertes');
  });

  it('FileAvionnage ne rend rien sans centre ni utilisateur', () => {
    // Garde d'entrée : le composant est monté pour chaque DZ du parachutiste,
    // y compris avant que l'identité soit chargée.
    expect(renderToStaticMarkup(
      <FileAvionnage centreId={undefined} userId={undefined} />)).toBe('');
  });
});
