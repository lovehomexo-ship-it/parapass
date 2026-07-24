import { describe, it, expect } from 'vitest';
import { countMasteredElements, techStatus, TECH_ELEMENTS } from './progression';

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
