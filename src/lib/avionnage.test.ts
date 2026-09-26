import { describe, it, expect } from 'vitest';
import {
  siegesOccupes, libelleCapacite, messageErreur, LIBELLE_TYPE,
  calculerCall, SEVERITE_CALL, formaterRetard,
  verifierPlanche, type EntreeVerification, blocsDePlanche,
  masseEmbarquee, libelleMasse, radioAttendue, TEINTE_DISCIPLINE,
  libelleDiscipline, teinteDiscipline, libelleDT48, SOURCE_DT48,
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
  largueurId: 'l1', chefAvionId: 'c1', largueurABord: true, heurePrevue: '14:30:00', heureDecollage: null, cloturee: false,
  aeronefPlaces: 4,
  places: [
    { rangSortie: 1, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false },
    { rangSortie: 2, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 75, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false },
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
      places: [{ rangSortie: 1, aptitude: 'gris', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }, { rangSortie: 2, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }] });
    expect(e.verdict).toBe('rouge');
    expect(e.anomalies.find(a => a.code === 'aptitude_refus')!.message).toContain('1 personne');
  });

  it('une vigilance seule ne bloque pas, elle avertit', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ rangSortie: 1, aptitude: 'orange', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }, { rangSortie: 2, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }] });
    expect(e.verdict).toBe('orange');
  });
});

describe('verifierPlanche — l’ordre de sortie', () => {
  it('deux personnes au même rang : un ordre qui ne veut rien dire', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ rangSortie: 1, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }, { rangSortie: 1, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }] });
    expect(e.anomalies.some(a => a.code === 'rangs_doublon')).toBe(true);
    expect(e.verdict).toBe('orange');
  });

  it('un rang manquant se signale, sans bloquer', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ rangSortie: 1, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }, { rangSortie: null, aptitude: 'vert', typeSaut: 'solo', passager: false, aSonPassager: false, masseKg: 80, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false }] });
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

// ═══════════════════════════════════════════════════════════════════════════
// LES BLOCS — « FF n°1 », « PAC n°2 ». Un groupe sort ENSEMBLE : il ne doit
// jamais se disperser dans la liste, sinon le mot ne veut plus rien dire.
// ═══════════════════════════════════════════════════════════════════════════

const pl = (rang: number | null, type: string, groupe: string | null = null) =>
  ({ rang_sortie: rang, type_saut: type, groupe_id: groupe });

describe('blocsDePlanche', () => {
  it('sans groupe, une personne par bloc, sans titre', () => {
    const b = blocsDePlanche([pl(1, 'solo'), pl(2, 'solo')]);
    expect(b).toHaveLength(2);
    expect(b.every(x => x.groupeId === null && x.libelle === null)).toBe(true);
  });

  it('numérote par TYPE et dans l’ordre de sortie', () => {
    const b = blocsDePlanche([
      pl(1, 'ecole', 'g1'), pl(2, 'ecole', 'g1'),
      pl(3, 'groupe', 'g2'), pl(4, 'groupe', 'g2'),
      pl(5, 'ecole', 'g3'),
    ]);
    expect(b.map(x => x.libelle)).toEqual([
      `${LIBELLE_TYPE.ecole} n°1`, `${LIBELLE_TYPE.groupe} n°1`, `${LIBELLE_TYPE.ecole} n°2`,
    ]);
  });

  it('un groupe ne se disperse pas, même si ses rangs sont éparpillés', () => {
    // g1 est en 1 et 4 ; il doit rester d'un seul tenant, à la place de son
    // premier sauteur — sinon « sortir ensemble » ne veut plus rien dire.
    const b = blocsDePlanche([pl(1, 'solo', 'g1'), pl(2, 'solo'), pl(4, 'solo', 'g1')]);
    expect(b).toHaveLength(2);
    expect(b[0].groupeId).toBe('g1');
    expect(b[0].places.map(p => p.rang_sortie)).toEqual([1, 4]);
  });

  it('les rangs manquants passent en dernier, sans casser l’ordre connu', () => {
    const b = blocsDePlanche([pl(null, 'solo'), pl(1, 'solo')]);
    expect(b[0].places[0].rang_sortie).toBe(1);
    expect(b[1].places[0].rang_sortie).toBeNull();
  });

  it('aucune place : aucun bloc', () => {
    expect(blocsDePlanche([])).toEqual([]);
  });

  it('toutes les places ressortent, une seule fois', () => {
    const entree = [pl(1, 'solo', 'g1'), pl(2, 'solo', 'g1'), pl(3, 'video'), pl(4, 'solo', 'g2')];
    const sorties = blocsDePlanche(entree).flatMap(b => b.places);
    expect(sorties).toHaveLength(entree.length);
    expect(new Set(sorties.map(p => p.rang_sortie)).size).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA MASSE — le total doit dire ce qu'il ignore. Un total calculé sur six
// masses connues et quatre inconnues n'est pas « la masse de l'avion ».
// ═══════════════════════════════════════════════════════════════════════════

describe('masseEmbarquee', () => {
  it('additionne ce qui est connu et compte ce qui ne l’est pas', () => {
    const m = masseEmbarquee([80, 95, null, 72]);
    expect(m.total).toBe(247);
    expect(m.connues).toBe(3);
    expect(m.inconnues).toBe(1);
    expect(m.complet).toBe(false);
  });

  it('n’est « complet » que si TOUT le monde est pesé', () => {
    expect(masseEmbarquee([80, 95]).complet).toBe(true);
    expect(masseEmbarquee([80, null]).complet).toBe(false);
    // Personne à bord : rien à déclarer complet, il n'y a rien.
    expect(masseEmbarquee([]).complet).toBe(false);
  });

  it('ignore les valeurs qui ne sont pas des masses', () => {
    const m = masseEmbarquee([80, undefined, 0, NaN, -5]);
    expect(m.connues).toBe(1);
    expect(m.inconnues).toBe(4);
  });
});

describe('libelleMasse', () => {
  it('sans aucune masse connue, on ne dit RIEN — pas « 0 kg »', () => {
    // Zéro est un chiffre, et celui-là serait faux.
    expect(libelleMasse(masseEmbarquee([null, null]), 875)).toBeNull();
  });

  it('complet : le total et le plafond', () => {
    expect(libelleMasse(masseEmbarquee([80, 95]), 875)).toBe('175 kg / 875 kg');
  });

  it('incomplet : le total NOMME ce qui manque', () => {
    expect(libelleMasse(masseEmbarquee([80, null, null]), 875))
      .toBe('80 kg / 875 kg — 2 masses inconnues');
  });

  it('sans plafond connu, pas de plafond inventé', () => {
    expect(libelleMasse(masseEmbarquee([80]), null)).toBe('80 kg');
  });
});

describe('verifierPlanche — le chef avion suit le largueur', () => {
  it('ne produit plus d’anomalie propre : deux désignations se contrediraient', () => {
    // Sur le terrain, le chef avion EST le largueur. On avait fait deux rôles
    // distincts ; c'était une invention, pas un besoin.
    const e = verifierPlanche({ ...PRETE, chefAvionId: null });
    expect(e.anomalies.some(a => a.code === 'chef_avion')).toBe(false);
    expect(e.verdict).toBe('vert');
  });
});

describe('verifierPlanche — le largueur est À BORD', () => {
  it('désigné mais absent de la liste : bloquant', () => {
    // Un largueur désigné et débarqué est un mensonge tranquille : on croit
    // l'avion pourvu, et personne ne voit ni sa masse ni son feu.
    const e = verifierPlanche({ ...PRETE, largueurABord: false });
    expect(e.verdict).toBe('rouge');
    expect(e.anomalies.some(a => a.code === 'largueur_absent')).toBe(true);
  });

  it('pas de largueur du tout : c’est l’autre anomalie, pas celle-ci', () => {
    const e = verifierPlanche({ ...PRETE, largueurId: null, largueurABord: false });
    expect(e.anomalies.some(a => a.code === 'largueur')).toBe(true);
    expect(e.anomalies.some(a => a.code === 'largueur_absent')).toBe(false);
  });
});

describe('radioAttendue — un fait d’exploitation, pas une règle inventée', () => {
  it('attendue en école et en accompagné : quelqu’un guide au sol', () => {
    expect(radioAttendue('ecole')).toBe(true);
    expect(radioAttendue('accompagne')).toBe(true);
  });

  it('pas ailleurs — et surtout PAS sur un seuil de sauts', () => {
    // ParaPass ne connaît aucun texte fédéral fixant un nombre de sauts.
    // P2 interdit d'en inventer un : la fonction ne prend donc pas ce chiffre.
    for (const t of ['solo', 'groupe', 'wingsuit', 'video', 'tandem', 'largueur']) {
      expect(radioAttendue(t)).toBe(false);
    }
    // La fonction ne prend pas de nombre de sauts : son second paramètre est
    // le RÉFÉRENTIEL. Aucun seuil n'existe dans ParaPass, et P2 interdit d'en
    // inventer un.
    expect(radioAttendue('solo', [])).toBe(false);
  });
});

describe('TEINTE_DISCIPLINE — grouper, jamais alerter', () => {
  it('ne réemploie aucune couleur de sévérité', () => {
    // Un saut d'école n'est ni un danger ni une alerte. Réutiliser le rouge
    // ou l'ambre ferait dire à la couleur deux choses sur le même écran.
    const severites = ['#F87171', '#FBBF24', '#34D399', '#EF4444', '#F59E0B',
                       '#10B981', '#F97316'];
    for (const teinte of Object.values(TEINTE_DISCIPLINE)) {
      expect(severites).not.toContain(teinte.toUpperCase());
    }
  });

  it('couvre toutes les places affichables', () => {
    for (const t of ['ecole', 'accompagne', 'solo', 'groupe', 'wingsuit',
                     'video', 'tandem', 'largueur']) {
      expect(TEINTE_DISCIPLINE[t]).toBeDefined();
    }
  });
});

describe('verifierPlanche — le passager de tandem', () => {
  const tandem = { rangSortie: 1, aptitude: 'vert' as const, typeSaut: 'tandem',
                   passager: false, aSonPassager: false, masseKg: 85, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false };
  const passager = { rangSortie: 1, aptitude: 'gris' as const, typeSaut: 'tandem',
                     passager: true, aSonPassager: false, masseKg: 70, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false };

  it('un tandem sans passager saisi se signale : il manque un siège et une masse', () => {
    const e = verifierPlanche({ ...PRETE, places: [tandem] });
    expect(e.anomalies.some(a => a.code === 'tandem_sans_passager')).toBe(true);
  });

  it('avec son passager, plus rien à signaler', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ ...tandem, aSonPassager: true }, passager] });
    expect(e.anomalies.some(a => a.code === 'tandem_sans_passager')).toBe(false);
  });

  it('le passager n’entre dans AUCUN décompte de conformité', () => {
    // Il n'a pas de licence. Le compter aurait mis tout l'avion au rouge à
    // cause de quelqu'un qu'aucune règle ne vise.
    const e = verifierPlanche({ ...PRETE,
      places: [{ ...tandem, aSonPassager: true }, passager] });
    expect(e.anomalies.some(a => a.code === 'aptitude_refus')).toBe(false);
    expect(e.verdict).toBe('vert');
  });

  it('un passager sans masse se signale : personne ne peut la deviner', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ ...tandem, aSonPassager: true }, { ...passager, masseKg: null }] });
    expect(e.anomalies.some(a => a.code === 'passager_sans_masse')).toBe(true);
  });
});

describe('verifierPlanche — le passager sort attaché', () => {
  it('partager le rang de son moniteur n’est PAS un doublon', () => {
    const e = verifierPlanche({ ...PRETE, places: [
      { rangSortie: 1, aptitude: 'vert', typeSaut: 'tandem', passager: false, aSonPassager: true, masseKg: 85, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false },
      { rangSortie: 1, aptitude: 'gris', typeSaut: 'tandem', passager: true, aSonPassager: false, masseKg: 70, videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false },
    ] });
    expect(e.anomalies.some(a => a.code === 'rangs_doublon')).toBe(false);
  });
});

describe('verifierPlanche — l’option vidéo', () => {
  const base = { rangSortie: 1, aptitude: 'vert' as const, typeSaut: 'tandem',
                 passager: false, aSonPassager: true, masseKg: 85,
                 videoVendue: false, aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false };

  it('vidéo vendue sans personne pour filmer : on le dit', () => {
    // C'est le cas qui coûte, et il ne se voit qu'en croisant deux
    // informations — le drapeau de vente et la présence d'un porteur.
    const e = verifierPlanche({ ...PRETE, places: [{ ...base, videoVendue: true }] });
    expect(e.anomalies.some(a => a.code === 'video_sans_videaste')).toBe(true);
  });

  it('vidéo vendue AVEC son porteur : rien à signaler', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ ...base, videoVendue: true, aSonVideaste: true, sousMinimumDT48: false, pacSansMoniteur: false }] });
    expect(e.anomalies.some(a => a.code === 'video_sans_videaste')).toBe(false);
  });

  it('un porteur vidéo sans vente ne declenche rien : filmer pour soi est libre', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [{ ...base, typeSaut: 'video', aSonPassager: false }] });
    expect(e.anomalies.some(a => a.code === 'video_sans_videaste')).toBe(false);
  });
});

describe('le référentiel des disciplines prime sur le repli', () => {
  const ref = [{ code: 'ff', libelle: 'Free fly', ordre: 30, equipage: false,
                 radio_attendue: false, teinte: '#111111' },
               { code: 'init_pac', libelle: 'Init PAC', ordre: 91, equipage: false,
                 radio_attendue: true, teinte: '#222222' }];

  it('le libellé et la teinte viennent du référentiel', () => {
    expect(libelleDiscipline('ff', ref)).toBe('Free fly');
    expect(teinteDiscipline('ff', ref)).toBe('#111111');
  });

  it('la radio suit le référentiel, pas une liste écrite dans le code', () => {
    // « init_pac » n'existait nulle part côté code : sans référentiel, on ne
    // peut pas le savoir ; avec, on le sait.
    expect(radioAttendue('init_pac')).toBe(false);
    expect(radioAttendue('init_pac', ref)).toBe(true);
  });

  it('une discipline inconnue ne casse rien : on affiche son code', () => {
    expect(libelleDiscipline('saut_plage', ref)).toBe('saut_plage');
    expect(radioAttendue('saut_plage', ref)).toBe(false);
  });
});

describe('verifierPlanche — voile et PAC', () => {
  const p = (o: object) => ({ rangSortie: 1, aptitude: 'vert' as const, typeSaut: 'solo',
    passager: false, aSonPassager: false, masseKg: 80, videoVendue: false,
    aSonVideaste: false, sousMinimumDT48: false, pacSansMoniteur: false, ...o });

  it('une voile sous le minimum DT 48 BLOQUE — c’est une règle fédérale', () => {
    // « Hors aménagement, aucune surface de voilure inférieure ne peut être
    // utilisée. » DT 48, CA du 08/02/2024. Ce n'est pas une vigilance.
    const e = verifierPlanche({ ...PRETE, places: [p({ sousMinimumDT48: true })] });
    expect(e.verdict).toBe('rouge');
    expect(e.anomalies.some(a => a.code === 'dt48_surface')).toBe(true);
  });

  it('une PAC sans accompagnateur BLOQUE : personne ne sait qui saute avec', () => {
    const e = verifierPlanche({ ...PRETE,
      places: [p({ typeSaut: 'ecole', pacSansMoniteur: true })] });
    expect(e.verdict).toBe('rouge');
    expect(e.anomalies.some(a => a.code === 'pac_sans_moniteur')).toBe(true);
  });
});

describe('libelleDT48 — le détail vient de la base, pas d’une reformulation', () => {
  const base = {
    nbSauts: 120, poidsNuKg: 80, poidsDeduit: false, surfaceDeclareeFt2: 190,
    surfaceMinFt2: 207, surfaceRetenueFt2: 207, amenagement: false,
    libelleTranche: '100 a 249 sauts', poidsEcrete: false, horsTableauSauts: false,
  };

  it('non conforme → bloque', () => {
    const l = libelleDT48({ ...base, etat: 'non_conforme',
      detail: '190 ft2 SOUS le minimum de 207 ft2 (100 a 249 sauts)' })!;
    expect(l.bloque).toBe(true);
    expect(l.texte).toContain('SOUS le minimum');
  });

  it('poids absent → inconnu, jamais conforme par défaut', () => {
    // P1 : ne pas pouvoir lire la DT 48 n'est pas « la voile est bonne ».
    const l = libelleDT48({ ...base, etat: 'indisponible',
      detail: 'poids non renseigne — la DT 48 ne se lit pas sans lui' })!;
    expect(l.inconnu).toBe(true);
    expect(l.bloque).toBe(false);
  });

  it('la source est nommée une seule fois, au même endroit', () => {
    expect(SOURCE_DT48).toContain('Directive Technique n° 48');
    expect(SOURCE_DT48).toContain('24.0113');
  });
});
