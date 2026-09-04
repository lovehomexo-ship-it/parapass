import { describe, it, expect } from 'vitest';
import {
  siegesOccupes, libelleCapacite, messageErreur, LIBELLE_TYPE,
  calculerCall, SEVERITE_CALL,
} from './avionnage';

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


describe('avionnage — le call', () => {
  const jour = '2026-09-04';
  const a = (h: string) => new Date(`${jour}T${h}`);

  it('loin du décollage, on annonce l’heure et non un décompte', () => {
    // « call 47 min » n'a pas de sens : le call commence à 20 minutes.
    expect(calculerCall(jour, '14:30:00', null, a('13:43:00')))
      .toMatchObject({ libelle: 'décollage 14:30', urgence: 'lointain' });
  });

  it('à 20 minutes, le call démarre', () => {
    expect(calculerCall(jour, '14:30:00', null, a('14:10:00')))
      .toMatchObject({ minutes: 20, libelle: 'call 20 min', urgence: 'call' });
    // Une minute plus tôt, on est encore « lointain » : la bascule est nette.
    expect(calculerCall(jour, '14:30:00', null, a('14:09:00')).urgence).toBe('lointain');
  });

  it('à 5 minutes ou moins, on n’appelle plus, on embarque', () => {
    expect(calculerCall(jour, '14:30:00', null, a('14:25:00')))
      .toMatchObject({ libelle: 'embarquement dans 5 min', urgence: 'imminent' });
    expect(calculerCall(jour, '14:30:00', null, a('14:30:00')))
      .toMatchObject({ minutes: 0, libelle: 'embarquement', urgence: 'imminent' });
  });

  it('l’heure passée devient un retard chiffré, pas un décompte négatif', () => {
    const c = calculerCall(jour, '14:30:00', null, a('14:37:00'));
    expect(c.libelle).toBe('en retard de 7 min');
    expect(c.urgence).toBe('retard');
  });

  it('une fois décollé, plus aucun décompte', () => {
    // Sinon la planche continuerait à « appeler » un avion déjà en l'air.
    expect(calculerCall(jour, '14:30:00', '2026-09-04T14:31:00Z', a('15:00:00')))
      .toMatchObject({ minutes: null, libelle: 'décollé', urgence: 'parti' });
  });

  it('sans heure fixée, on le dit au lieu d’inventer un zéro', () => {
    expect(calculerCall(jour, null, null, a('14:00:00')))
      .toMatchObject({ minutes: null, libelle: 'heure non fixée' });
    expect(calculerCall(jour, 'n’importe quoi', null, a('14:00:00')).minutes).toBeNull();
  });

  it('l’urgence a une gravité, donc une forme', () => {
    expect(SEVERITE_CALL.retard).toBe('critique');
    expect(SEVERITE_CALL.imminent).toBe('critique');
    expect(SEVERITE_CALL.call).toBe('vigilance');
    expect(SEVERITE_CALL.lointain).toBe('neutre');
  });
});
