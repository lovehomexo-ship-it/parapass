import { describe, it, expect } from 'vitest';
import { evaluer, estRefus, versionReferentiel, type RegleEnVigueur, type Fait, type Contexte } from './feuVert';

// ═══════════════════════════════════════════════════════════════════════════
// FEU VERT · P3.5 — Les tests du moteur.
//
// Les codes de règles n'existent QUE dans ce fichier (critère P2.3) : le
// moteur ne les connaît pas, il ne fait que joindre des règles à des faits.
// Le référentiel ci-dessous reproduit le seed fédéral de la migration 119.
// ═══════════════════════════════════════════════════════════════════════════

const R = (code: string, gravite: RegleEnVigueur['gravite'], portee: RegleEnVigueur['portee'] = 'individu',
           extra: Partial<RegleEnVigueur> = {}): RegleEnVigueur => ({
  code, version: 1, libelle: `Libellé ${code}`, source_texte: `Source ${code}`, gravite, portee,
  levable: false, habilitation_levee: 'aucun', duree_levee: null, ...extra,
});

const REFERENTIEL: RegleEnVigueur[] = [
  R('LIC-001', 'bloquant'), R('MED-001', 'bloquant'), R('BRF-001', 'bloquant'),
  R('REP-001', 'vigilance'), R('MAT-001', 'bloquant'), R('MAT-002', 'vigilance'),
  R('MAT-003', 'vigilance'), R('VOI-001', 'vigilance'), R('QUA-001', 'bloquant'),
  R('QUA-002', 'bloquant'), R('EQP-001', 'vigilance'),
  R('ENC-001', 'bloquant', 'rotation'),   // portée rotation : jamais de motif individuel
  R('MIN-001', 'bloquant'), R('BRV-001', 'bloquant'),
];
const INDIVIDUELLES = REFERENTIEL.filter(r => r.portee === 'individu').map(r => r.code);

const CTX: Contexte = { date: '2026-09-06', typeSaut: 'solo' };
const T0 = new Date('2026-09-06T09:00:00');

/** Tous les faits conformes, puis surcharge. */
const faits = (surcharge: Record<string, Fait['etat']> = {}): Fait[] =>
  INDIVIDUELLES.map(code => ({ code, etat: surcharge[code] ?? 'conforme', detail: null }));

describe('P3 — un parachutiste conforme sur tout', () => {
  it('est vert, sans aucun motif', () => {
    const e = evaluer(REFERENTIEL, faits(), CTX, T0);
    expect(e.verdict).toBe('vert');
    expect(e.motifs).toEqual([]);
  });
});

describe('P3 — chaque règle isolément, conforme puis non conforme', () => {
  for (const r of REFERENTIEL.filter(r => r.portee === 'individu')) {
    it(`${r.code} conforme → aucun motif ; non conforme → ${r.gravite === 'bloquant' ? 'rouge' : 'orange'}`, () => {
      expect(evaluer(REFERENTIEL, faits(), CTX, T0).motifs.some(m => m.codeRegle === r.code)).toBe(false);
      const e = evaluer(REFERENTIEL, faits({ [r.code]: 'non_conforme' }), CTX, T0);
      expect(e.verdict).toBe(r.gravite === 'bloquant' ? 'rouge' : 'orange');
      const m = e.motifs.find(m => m.codeRegle === r.code)!;
      expect(m.gravite).toBe(r.gravite);
      // Le refus cite le texte : la source voyage avec le motif (P2).
      expect(m.source).toBe(r.source_texte);
      expect(m.versionRegle).toBe(1);
    });
  }
});

describe('P3 — priorité bloquant > vigilance', () => {
  it('une vigilance et un bloquant donnent rouge, et les deux motifs sont là', () => {
    const e = evaluer(REFERENTIEL, faits({ 'REP-001': 'non_conforme', 'LIC-001': 'non_conforme' }), CTX, T0);
    expect(e.verdict).toBe('rouge');
    expect(e.motifs.map(m => m.codeRegle)).toEqual(['LIC-001', 'REP-001']);  // bloquant d'abord
  });
});

describe('P1 — le GRIS, pour chaque donnée manquante', () => {
  for (const code of INDIVIDUELLES) {
    it(`${code} indisponible → gris, avec un motif « indisponible » qui dit pourquoi`, () => {
      const e = evaluer(REFERENTIEL, faits({ [code]: 'indisponible' }), CTX, T0);
      expect(e.verdict).toBe('gris');
      const m = e.motifs.find(m => m.codeRegle === code)!;
      expect(m.gravite).toBe('indisponible');
      expect(m.source).toBe(`Source ${code}`);
    });
  }

  it('une règle en vigueur SANS fait du tout est grise — jamais verte par défaut', () => {
    // C'est le cas d'une quinzième règle ajoutée en base avant qu'un fait
    // n'existe pour elle : elle bloque tant qu'on ne sait pas la lire.
    const sansFait = faits().filter(f => f.code !== 'MED-001');
    const e = evaluer(REFERENTIEL, sansFait, CTX, T0);
    expect(e.verdict).toBe('gris');
    expect(e.motifs[0]).toMatchObject({ codeRegle: 'MED-001', gravite: 'indisponible' });
    expect(e.motifs[0].detail).toContain('aucun fait lisible');
  });

  it('un bloquant CONFIRMÉ prime sur une donnée manquante : rouge, et le gris reste listé', () => {
    const e = evaluer(REFERENTIEL, faits({ 'LIC-001': 'non_conforme', 'MIN-001': 'indisponible' }), CTX, T0);
    expect(e.verdict).toBe('rouge');
    expect(e.motifs.map(m => m.gravite)).toEqual(['bloquant', 'indisponible']);
  });

  it('une vigilance confirmée ET une donnée manquante : gris, pas orange', () => {
    // L'inconnu pèse plus que l'avertissement : on ne rassure pas à moitié.
    const e = evaluer(REFERENTIEL, faits({ 'REP-001': 'non_conforme', 'MED-001': 'indisponible' }), CTX, T0);
    expect(e.verdict).toBe('gris');
  });

  it('le gris est un refus en aval, comme le rouge', () => {
    expect(estRefus('gris')).toBe(true);
    expect(estRefus('rouge')).toBe(true);
    expect(estRefus('orange')).toBe(false);
    expect(estRefus('vert')).toBe(false);
  });

  it('un fait pour une règle qui n’est PAS en vigueur est ignoré', () => {
    // Le centre a désactivé MAT-003 : son fait indisponible ne grise plus.
    const sansMat3 = REFERENTIEL.filter(r => r.code !== 'MAT-003');
    const e = evaluer(sansMat3, faits({ 'MAT-003': 'indisponible' }), CTX, T0);
    expect(e.verdict).toBe('vert');
  });
});

describe('P3 — ENC-001, portée rotation', () => {
  it('ne produit jamais de motif individuel, même non conforme ou absente', () => {
    const avecEnc = [...faits({ }), { code: 'ENC-001', etat: 'non_conforme' as const, detail: null }];
    expect(evaluer(REFERENTIEL, avecEnc, CTX, T0).verdict).toBe('vert');
    expect(evaluer(REFERENTIEL, faits(), CTX, T0).motifs.some(m => m.codeRegle === 'ENC-001')).toBe(false);
  });
});

describe('P3 — stabilité et référentiel', () => {
  it('deux évaluations identiques au même instant donnent le même résultat', () => {
    const a = evaluer(REFERENTIEL, faits({ 'LIC-001': 'non_conforme', 'MIN-001': 'indisponible' }), CTX, T0);
    const b = evaluer(REFERENTIEL, faits({ 'MIN-001': 'indisponible', 'LIC-001': 'non_conforme' }), CTX, T0);
    expect(a).toEqual(b);
  });

  it('l’empreinte du référentiel ne dépend pas de l’ordre de lecture', () => {
    const inverse = [...REFERENTIEL].reverse();
    expect(versionReferentiel(inverse)).toBe(versionReferentiel(REFERENTIEL));
    expect(versionReferentiel(REFERENTIEL)).toContain('LIC-001@1');
  });

  it('une nouvelle version d’une règle change l’empreinte', () => {
    const v2 = REFERENTIEL.map(r => r.code === 'LIC-001' ? { ...r, version: 2 } : r);
    expect(versionReferentiel(v2)).not.toBe(versionReferentiel(REFERENTIEL));
  });

  it('le moteur ne connaît pas le régime : aucune entrée, aucune sortie ne le nomme', () => {
    const e = evaluer(REFERENTIEL, faits(), CTX, T0);
    expect(JSON.stringify(e)).not.toMatch(/regime|bloquant_actif|informatif/);
  });
});

describe('P3 — « sans objet » n’est pas « conforme »', () => {
  it('une règle sans objet ne colore rien et n’entre pas dans la couverture', () => {
    // QUA-001 pour un saut solo : la règle ne s'applique pas. Elle ne doit
    // ni verdir le verdict, ni le griser, ni gonfler le nombre de contrôles.
    const e = evaluer(REFERENTIEL, faits({ 'QUA-001': 'sans_objet', 'QUA-002': 'sans_objet' }), CTX, T0);
    expect(e.verdict).toBe('vert');
    expect(e.motifs).toEqual([]);
    expect(e.reglesSansObjet).toBe(2);
    expect(e.reglesControlees).toBe(INDIVIDUELLES.length - 2);
  });

  it('la couverture compte les non-conformes : contrôler et échouer reste contrôler', () => {
    const e = evaluer(REFERENTIEL, faits({ 'LIC-001': 'non_conforme' }), CTX, T0);
    expect(e.reglesControlees).toBe(INDIVIDUELLES.length);
  });

  it('une donnée indisponible n’est PAS un contrôle', () => {
    // C'est toute la différence avec « sans objet » : ici on aurait dû
    // contrôler et on n'a pas pu. Le gris le dit, la couverture le compte pas.
    const e = evaluer(REFERENTIEL, faits({ 'MED-001': 'indisponible' }), CTX, T0);
    expect(e.verdict).toBe('gris');
    expect(e.reglesControlees).toBe(INDIVIDUELLES.length - 1);
    expect(e.reglesSansObjet).toBe(0);
  });

  it('tout sans objet : vert, mais ZÉRO contrôle — le vert le plus creux qui soit', () => {
    const tout = INDIVIDUELLES.map(code => ({ code, etat: 'sans_objet' as const, detail: null }));
    const e = evaluer(REFERENTIEL, tout, CTX, T0);
    expect(e.verdict).toBe('vert');
    expect(e.reglesControlees).toBe(0);
  });

  it('une lecture en échec rend un gris à zéro contrôle', () => {
    const e = evaluer(REFERENTIEL, [], CTX, T0);
    expect(e.verdict).toBe('gris');
    expect(e.reglesControlees).toBe(0);
  });
});
