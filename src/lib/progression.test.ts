import { describe, it, expect } from 'vitest';
import { countMasteredElements, countSautsAEvaluer, techStatus, TECH_ELEMENTS } from './progression';

describe('countSautsAEvaluer', () => {
  const sauts = [
    { id: 'a', is_tunnel: false, statut: 'valide' },
    { id: 'b', is_tunnel: false, statut: 'valide' },
    { id: 'c', is_tunnel: true, statut: 'valide' },   // soufflerie → jamais compté
    { id: 'd', is_tunnel: false, statut: 'en_attente' },
  ];

  it('compte les vrais sauts sans évaluation, hors soufflerie', () => {
    // a évalué → reste b et d à évaluer (c exclu)
    expect(countSautsAEvaluer(sauts, new Set(['a']))).toBe(2);
  });

  it('un saut non évalué n’est jamais compté comme évalué', () => {
    expect(countSautsAEvaluer(sauts, new Set())).toBe(3);
  });

  it('tout évalué ⇒ 0', () => {
    expect(countSautsAEvaluer(sauts, new Set(['a', 'b', 'd']))).toBe(0);
  });
});

// Un saut « tout maîtrisé » sur les 11 éléments.
function jumpAllMastered(): Record<string, string> {
  return Object.fromEntries(TECH_ELEMENTS.map(({ key }) => [key, 'maitrise']));
}

describe('countMasteredElements', () => {
  it('11/11 quand tous les éléments sont maîtrisés', () => {
    const jumps = [jumpAllMastered(), jumpAllMastered()];
    expect(countMasteredElements(jumps)).toEqual({ mastered: 11, total: 11 });
  });

  it('même valeur que le comptage direct du détail (dashboard == détail)', () => {
    const jumps = [
      { ...jumpAllMastered(), ouverture: 'en_cours', separation: 'non' },
      jumpAllMastered(),
    ];
    const direct = TECH_ELEMENTS.filter(
      ({ key }) => techStatus(key, jumps).status === 'maitrise'
    ).length;
    expect(countMasteredElements(jumps).mastered).toBe(direct);
  });

  it('un élément majoritairement en_cours n’est pas compté maîtrisé', () => {
    const jumps = [
      { sortie_avion: 'en_cours' },
      { sortie_avion: 'en_cours' },
      { sortie_avion: 'maitrise' },
    ];
    expect(techStatus('sortie_avion', jumps).status).toBe('en_cours');
    expect(countMasteredElements(jumps).mastered).toBe(0);
  });

  it('aucune évaluation ⇒ 0/11', () => {
    expect(countMasteredElements([]).mastered).toBe(0);
    expect(countMasteredElements([{}]).mastered).toBe(0);
  });
});
