import { describe, it, expect } from 'vitest';
import { siegesOccupes, libelleCapacite, messageErreur, LIBELLE_TYPE } from './avionnage';

describe('avionnage — capacité', () => {
  it('un moniteur qui accompagne occupe un siège', () => {
    // L'oublier ferait afficher « 3/4 » à un avion déjà plein : le chef
    // d'avionnage embarquerait une personne de trop.
    expect(siegesOccupes([{}, {}, { moniteur_id: 'm1' }])).toBe(4);
  });

  it('sans moniteur, un inscrit vaut un siège', () => {
    expect(siegesOccupes([{}, {}, {}])).toBe(3);
    expect(siegesOccupes([])).toBe(0);
  });

  it('moniteur_id nul ou absent ne compte pas', () => {
    expect(siegesOccupes([{ moniteur_id: null }, {}])).toBe(2);
  });

  it('le libellé dit « complet » et jamais un négatif', () => {
    expect(libelleCapacite(4, 4)).toBe('4/4 — complet');
    // Un dépassement ne peut venir que d'une donnée antérieure au trigger ;
    // il ne doit pas produire « -1 place libre ».
    expect(libelleCapacite(5, 4)).toBe('5/4 — complet');
  });

  it('le libellé accorde le pluriel', () => {
    expect(libelleCapacite(3, 4)).toBe('3/4 · 1 place libre');
    expect(libelleCapacite(2, 4)).toBe('2/4 · 2 places libres');
  });

  it('sans aéronef, on ne prétend pas connaître un plafond', () => {
    // Inventer « 3/4 » alors qu'aucun avion n'est affecté serait un chiffre faux.
    expect(libelleCapacite(3, null)).toBe('3 inscrits · aéronef non renseigné');
    expect(libelleCapacite(1, null)).toBe('1 inscrit · aéronef non renseigné');
  });
});

describe('avionnage — messages d’erreur', () => {
  it('le message ET le conseil remontent ensemble', () => {
    // Une personne au bord de la piste doit lire quoi faire, pas un code.
    expect(messageErreur({ message: 'Rotation complète : 4 places.', hint: 'Créez la suivante.' }))
      .toBe('Rotation complète : 4 places. Créez la suivante.');
  });

  it('un message seul suffit', () => {
    expect(messageErreur({ message: 'Pas ouvert.' })).toBe('Pas ouvert.');
  });

  it('une erreur vide ne produit pas « undefined » à l’écran', () => {
    expect(messageErreur(null)).toBe('Erreur inconnue.');
    expect(messageErreur({})).toBe('Erreur inconnue.');
  });
});

describe('avionnage — types de saut', () => {
  it('chaque type de la file a un libellé français', () => {
    // Sans quoi l'écran afficherait « accompagne » sans accent à un utilisateur.
    for (const [cle, libelle] of Object.entries(LIBELLE_TYPE)) {
      expect(libelle, cle).toMatch(/^[A-ZÉÈÀ]/);
    }
    expect(Object.keys(LIBELLE_TYPE)).toHaveLength(6);
  });
});
