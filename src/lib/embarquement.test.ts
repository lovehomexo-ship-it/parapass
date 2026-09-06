import { describe, it, expect } from 'vitest';
import { interpreterQr, comportement, motifRecevable } from './embarquement';

describe('P5 — lire le QR de la licence', () => {
  it('accepte les deux formes du QR existant : jeton et id de profil', () => {
    expect(interpreterQr('https://parapass.fr/verify/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'))
      .toEqual({ valeur: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', forme: 'id' });
    expect(interpreterQr('https://parapass.fr/verify/Xy9_kLm-Q2rT8v'))
      .toEqual({ valeur: 'Xy9_kLm-Q2rT8v', forme: 'token' });
  });

  it('accepte la valeur nue — saisie manuelle quand la caméra est morte', () => {
    expect(interpreterQr('  A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11 ')?.forme).toBe('id');
    expect(interpreterQr('Xy9_kLm-Q2rT8v')?.forme).toBe('token');
  });

  it('refuse tout ce qui n’est pas une carte ParaPass', () => {
    expect(interpreterQr('https://parapass.fr/sac/1234')).toBeNull();     // QR de sac
    // L'hôte n'est pas vérifié : dev, preview et parapass.fr génèrent tous
    // /verify/<x>. Seule la forme de la valeur compte.
    expect(interpreterQr('https://google.com')).toBeNull();
    expect(interpreterQr('')).toBeNull();
    expect(interpreterQr('ab')).toBeNull();                                 // trop court pour un jeton
  });
});

describe('P5 — ce que l’écran fait d’un verdict', () => {
  it('vert : rien à lire, rien à toucher, retour automatique', () => {
    const c = comportement('vert');
    expect(c.retourAutomatiqueMs).toBe(1500);
    expect(c.actions).toEqual([]);
  });

  it('orange : lever avec motif obligatoire, ou refuser avec motif', () => {
    const c = comportement('orange');
    expect(c.retourAutomatiqueMs).toBeNull();
    expect(c.actions.map(a => a.cle)).toEqual(['lever', 'refuser']);
    expect(c.actions.every(a => a.motifObligatoire)).toBe(true);
    expect(c.actions.find(a => a.cle === 'lever')?.habilitation).toBe('DT');
  });

  it('rouge en régime informatif : prévenir, ou consigner et laisser monter — jamais « bloqué »', () => {
    const c = comportement('rouge', 'informatif');
    expect(c.actions.map(a => a.cle)).toEqual(['prevenir_dt', 'consigner_et_laisser']);
    expect(c.actions.find(a => a.cle === 'consigner_et_laisser')?.motifObligatoire).toBe(true);
    expect(c.sousTitre).toContain('n’empêche rien');
  });

  it('gris se traite exactement comme rouge, avec la vraie cause dans le titre', () => {
    const r = comportement('rouge'), g = comportement('gris');
    expect(g.actions).toEqual(r.actions);
    expect(g.retourAutomatiqueMs).toBe(r.retourAutomatiqueMs);
    expect(g.titre).toBe('Donnée indisponible');
  });

  it('le mot « bloqué » n’apparaît nulle part en régime informatif', () => {
    for (const v of ['vert', 'orange', 'rouge', 'gris'] as const) {
      expect(JSON.stringify(comportement(v, 'informatif')).toLowerCase()).not.toContain('bloqu');
    }
  });

  it('en régime bloquant, « consigner et laisser monter » disparaît — c’est tout ce qui change', () => {
    const c = comportement('rouge', 'bloquant');
    expect(c.actions.map(a => a.cle)).toEqual(['prevenir_dt']);
    expect(comportement('vert', 'bloquant')).toEqual(comportement('vert', 'informatif'));
  });

  it('un seul bouton plein par verdict (règle 6)', () => {
    for (const v of ['orange', 'rouge', 'gris'] as const) {
      expect(comportement(v).actions.filter(a => a.rang === 'principal')).toHaveLength(1);
    }
  });
});

describe('P5 — aucun franchissement sans motif écrit', () => {
  it('trois caractères utiles minimum, comme la contrainte en base', () => {
    expect(motifRecevable('')).toBe(false);
    expect(motifRecevable('  ')).toBe(false);
    expect(motifRecevable('ok')).toBe(false);
    expect(motifRecevable(' ok. ')).toBe(true);
  });
});
