import { describe, it, expect } from 'vitest';
import { sautsToCSV, type SautExport } from './sautsExport';

const base: SautExport = {
  id: 's1', parachutiste_id: 'p1', date_saut: '2026-07-24', lieu: 'BigAir',
  hauteur_m: 4000, categorie: 'OA', statut: 'valide',
  parachutiste_nom: 'MARTIN', parachutiste_prenom: 'Sophie',
  moniteur_nom_libre: 'Julien MERCIER',
  valide_par: 'Admin BigAir', valide_le: '2026-07-24T06:38:00Z',
};

describe('sautsToCSV', () => {
  it('inclut validateur et horodatage dans l’en-tête et les lignes (Prompt Q)', () => {
    const csv = sautsToCSV([base]);
    const [header, row] = csv.split('\n');
    expect(header).toContain('valide_par');
    expect(header).toContain('valide_le');
    expect(row).toContain('Admin BigAir');
    expect(row).toContain('08:38'); // 06:38 UTC → 08:38 Europe/Paris
  });

  it('distingue moniteur déclaré et validateur', () => {
    const row = sautsToCSV([base]).split('\n')[1];
    expect(row).toContain('Julien MERCIER');
    expect(row).toContain('Admin BigAir');
  });

  it('échappe les virgules', () => {
    const csv = sautsToCSV([{ ...base, lieu: 'BigAir, Rochefort' }]);
    expect(csv).toContain('"BigAir, Rochefort"');
  });

  it('laisse la trace vide pour un saut non validé', () => {
    const row = sautsToCSV([{ ...base, statut: 'en_attente', valide_par: null, valide_le: null }]).split('\n')[1];
    // deux derniers champs vides
    expect(row.endsWith(',,')).toBe(true);
  });
});
