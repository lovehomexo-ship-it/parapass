import { describe, it, expect } from 'vitest';
import { chaineCanonique, sha256Hex, verifierChaine, METHODE_DE_VERIFICATION, type EntreeJournal } from './journalSecurite';

// ═══════════════════════════════════════════════════════════════════════════
// FEU VERT · P4 — La rupture fabriquée, et sa détection au bon endroit.
//
// La chaîne est fabriquée ici EXACTEMENT comme le trigger SQL la fabrique :
// même forme canonique, même SHA-256. Si un jour les deux divergent, ce test
// passe encore mais verifier_chaine() côté base ne validera plus ce que le
// client valide — l'export compare les deux et le dira.
// ═══════════════════════════════════════════════════════════════════════════

const CENTRE = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function fabriquer(n: number): Promise<EntreeJournal[]> {
  const out: EntreeJournal[] = [];
  let prec: string | null = null;
  for (let i = 0; i < n; i++) {
    const e: EntreeJournal = {
      id: `id-${i}`, seq: i + 1, centre_id: CENTRE,
      type_evenement: i === 0 ? 'regime_modifie' : 'evaluation_produite',
      horodatage_canonique: `2026-09-06T08:0${i}:00.000000Z`,
      charge_canonique: `{"i": ${i}}`, charge_utile: { i },
      hash_precedent: prec, hash: '',
    };
    e.hash = await sha256Hex(chaineCanonique(e));
    prec = e.hash;
    out.push(e);
  }
  return out;
}

describe('P4 — forme canonique', () => {
  it('est la concaténation exacte attendue par le trigger', () => {
    expect(chaineCanonique({
      hash_precedent: null, centre_id: 'c', horodatage_canonique: 't',
      type_evenement: 'e', charge_canonique: '{}',
    })).toBe('|c|t|e|{}');
    expect(chaineCanonique({
      hash_precedent: 'abc', centre_id: 'c', horodatage_canonique: 't',
      type_evenement: 'e', charge_canonique: '{"a": 1}',
    })).toBe('abc|c|t|e|{"a": 1}');
  });

  it('SHA-256 hexadécimal, minuscule, 64 caractères — vecteur connu', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('P4 — verifierChaine', () => {
  it('une chaîne intacte est valide', async () => {
    const r = await verifierChaine(await fabriquer(5));
    expect(r).toEqual({ valide: true, entrees: 5 });
  });

  it('une charge modifiée après coup rompt la chaîne À CETTE entrée', async () => {
    const j = await fabriquer(5);
    j[2].charge_canonique = '{"i": 2, "falsifie": true}';   // le hash stocké ne correspond plus
    const r = await verifierChaine(j);
    expect(r.valide).toBe(false);
    expect(r.premiereRuptureId).toBe('id-2');
  });

  it('une entrée supprimée rompt la chaîne à la SUIVANTE', async () => {
    const j = await fabriquer(5);
    j.splice(2, 1);                                      // id-2 disparaît
    const r = await verifierChaine(j);
    expect(r.valide).toBe(false);
    expect(r.premiereRuptureId).toBe('id-3');           // son hash_precedent pointe vers un fantôme
  });

  it('une entrée insérée après coup, même bien hachée, rompt la chaîne', async () => {
    const j = await fabriquer(4);
    const intrus: EntreeJournal = {
      id: 'intrus', seq: 2.5 as unknown as number, centre_id: CENTRE, type_evenement: 'levee_accordee',
      horodatage_canonique: '2026-09-06T08:01:30.000000Z', charge_canonique: '{"x": 1}', charge_utile: { x: 1 },
      hash_precedent: j[1].hash, hash: '',
    };
    intrus.hash = await sha256Hex(chaineCanonique(intrus));
    const r = await verifierChaine([...j, intrus]);
    expect(r.valide).toBe(false);
    // L'intrus est cohérent avec id-1 ; c'est id-2, la vraie suivante, qui ne
    // pointe plus vers lui. La rupture est signalée là.
    expect(r.premiereRuptureId).toBe('id-2');
  });

  it('un hash_precedent réécrit pour « recoller » ne suffit pas : le hash propre change', async () => {
    const j = await fabriquer(3);
    j[1].type_evenement = 'passage_outre_consigne';    // on change l'événement
    // …et on ne recalcule rien : le hash stocké ne correspond plus au contenu.
    const r = await verifierChaine(j);
    expect(r).toMatchObject({ valide: false, premiereRuptureId: 'id-1' });
  });

  it('l’ordre de réception ne compte pas : la chaîne se vérifie par seq', async () => {
    const j = await fabriquer(4);
    expect((await verifierChaine([...j].reverse())).valide).toBe(true);
  });

  it('une fenêtre partielle se vérifie à partir de sa première entrée', async () => {
    const j = await fabriquer(6);
    expect((await verifierChaine(j.slice(2, 5))).valide).toBe(true);
  });

  it('un journal vide est valide et le dit', async () => {
    expect(await verifierChaine([])).toEqual({ valide: true, entrees: 0 });
  });
});

describe('P4 — la méthode voyage avec l’export', () => {
  it('explique le séparateur, l’ordre, le premier maillon, et interdit la re-sérialisation', () => {
    for (const mot of ['SHA-256', '|', 'hash_precedent', 'seq', 'chaîne vide', 'ne re-sérialisez pas']) {
      expect(METHODE_DE_VERIFICATION).toContain(mot);
    }
    expect(METHODE_DE_VERIFICATION).toContain('ParaPass ne l\'a transmis à personne');
  });
});
