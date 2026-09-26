import { describe, it, expect } from 'vitest';
import {
  siegesOccupes, libelleCapacite, messageErreur, LIBELLE_TYPE,
  calculerCall, SEVERITE_CALL, formaterRetard,
  verifierPlanche, type EntreeVerification,
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

describe('avionnage — lisibilité du retard', () => {
  it('sous deux heures, les minutes restent la bonne unité', () => {
    expect(formaterRetard('en retard de 7 min')).toBe('en retard de 7 min');
    expect(formaterRetard('en retard de 119 min')).toBe('en retard de 119 min');
  });

  it('au-delà de deux heures, on lit des heures', () => {
    expect(formaterRetard('en retard de 120 min')).toBe('en retard de 2 h 00');
    expect(formaterRetard('en retard de 501 min')).toBe('en retard de 8 h 21');
  });

  it('au-delà d’une journée, ce n’est plus un retard mais un oubli', () => {
    expect(formaterRetard('en retard de 1500 min')).toBe('planche non décollée — à clôturer ou annuler');
  });

  it('les autres libellés passent intacts', () => {
    for (const l of ['call 15 min', 'décollage 14:30', 'embarquement', 'décollé', 'heure non fixée']) {
      expect(formaterRetard(l)).toBe(l);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// VÉRIFICATION DE LA PLANCHE — repris du panneau « Vérification du stick »
// des manifests professionnels. Le Feu Vert juge une PERSONNE ; ceci juge un
// AVION. Un avion sans largueur n'a aucun feu rouge à bord et ne part pas.
// ═══════════════════════════════════════════════════════════════════════════

const PRETE: EntreeVerification = {
  largueurId: 'l1', heurePrevue: '14:30:00', heureDecollage: null, cloturee: false,
  aeronefPlaces: 4,
  places: [
    { rangSortie: 1, aptitude: 'vert' },
    { rangSortie: 2, aptitude: 'vert' },
  ],
  largueursDisponibles: 2, siegesOccupes: 2,
};

describe('verifierPlanche — une planche complète ne signale rien', () => {
  it('verdict vert, aucune anomalie', () => {
    const e = verifierPlanche(PRETE);
    expect(e.verdict).toBe('vert');
    expect(e.anomalies).toEqual([]);
  });
});

describe('verifierPlanche — ce qui bloque', () => {
  it('sans largueur : bloquant, et le message change si le centre n’en a aucun', () => {
    const sans = verifierPlanche({ ...PRETE, largueurId: null });
    expect(sans.verdict).toBe('rouge');
    expect(sans.anomalies[0].message).toContain('Désignez le largueur');

    const aucun = verifierPlanche({ ...PRETE, largueurId: null, largueursDisponibles: 0 });
    expect(aucun.anomalies[0].message).toContain('Aucun largueur qualifié');
  });

  it('surcharge : plus de sièges occupés que de places', () => {
    const e = verifierPlanche({ ...PRETE, siegesOccupes: 5 });
    expect(e.verdict).toBe('rouge');
    expect(e.anomalies.some(a => a.code === 'surcharge')).toBe(true);
  });

  it('aéronef non affecté : on ne peut PAS vérifier la capacité, donc on bloque', () => {
    // P1 — ne pas pouvoir vérifier n'est pas « tout va bien ».
    const e = verifierPlanche({ ...PRETE, aeronefPlaces: null });
    expect(e.verdict).toBe('rouge');
  });

  it('le GRIS compte avec le rouge : ne pas savoir se traite comme un refus', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ rangSortie: 1, aptitude: 'gris' }, { rangSortie: 2, aptitude: 'vert' }] });
    expect(e.verdict).toBe('rouge');
    expect(e.anomalies.find(a => a.code === 'aptitude_refus')!.message).toContain('1 personne');
  });

  it('une vigilance seule ne bloque pas, elle avertit', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ rangSortie: 1, aptitude: 'orange' }, { rangSortie: 2, aptitude: 'vert' }] });
    expect(e.verdict).toBe('orange');
  });
});

describe('verifierPlanche — l’ordre de sortie', () => {
  it('deux personnes au même rang : un ordre qui ne veut rien dire', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ rangSortie: 1, aptitude: 'vert' }, { rangSortie: 1, aptitude: 'vert' }] });
    expect(e.anomalies.some(a => a.code === 'rangs_doublon')).toBe(true);
    expect(e.verdict).toBe('orange');
  });

  it('un rang manquant se signale, sans bloquer', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ rangSortie: 1, aptitude: 'vert' }, { rangSortie: null, aptitude: 'vert' }] });
    expect(e.anomalies.some(a => a.code === 'rangs_manquants')).toBe(true);
    expect(e.verdict).toBe('orange');
  });
});

describe('verifierPlanche — une planche partie ne se vérifie plus', () => {
  it('décollée : rien à signaler, même sans largueur ni heure', () => {
    // La signaler tous les soirs en rouge n'apprendrait rien à personne.
    const e = verifierPlanche({ ...PRETE, heureDecollage: '2026-09-26T12:00:00Z',
                                largueurId: null, heurePrevue: null });
    expect(e.verdict).toBe('vert');
    expect(e.anomalies).toEqual([]);
  });

  it('clôturée : idem', () => {
    expect(verifierPlanche({ ...PRETE, cloturee: true, largueurId: null }).verdict).toBe('vert');
  });
});

describe('verifierPlanche — un avion vide n’est pas prêt, mais ne bloque pas', () => {
  it('signale « personne à bord » en vigilance', () => {
    const e = verifierPlanche({ ...PRETE, places: [], siegesOccupes: 0 });
    expect(e.anomalies.some(a => a.code === 'vide')).toBe(true);
    expect(e.verdict).toBe('orange');
  });
});
