import { describe, it, expect } from 'vitest';
import { buildCardModel, type ShareInput, type ShareToggles } from './shareCard';

const ON: ShareToggles = { showTotal: true, showProgression: true, showCentre: true };
const base: ShareInput = {
  prenom: 'Amandine', total: 57, sautsDuJour: 0,
  elementsMaitrises: 8, elementsTotal: 11,
  centre: 'BigAir Rochefort', dateLabel: '24 juillet 2026', nouveauBadge: null,
};

describe('buildCardModel — variantes', () => {
  it('variante progression quand aucun saut du jour (héros = total)', () => {
    const m = buildCardModel(base, ON);
    expect(m.variant).toBe('progression');
    expect(m.heroNumber).toBe('57');
  });

  it('variante volume quand plusieurs sauts du jour (héros = sauts du jour)', () => {
    const m = buildCardModel({ ...base, sautsDuJour: 4 }, ON);
    expect(m.variant).toBe('volume');
    expect(m.heroNumber).toBe('4');
  });

  it('variante badge quand un palier est franchi', () => {
    const m = buildCardModel({ ...base, sautsDuJour: 3, nouveauBadge: '100 sauts' }, ON);
    expect(m.variant).toBe('badge');
    expect(m.badge).toBe('100 sauts');
  });
});

describe('buildCardModel — confidentialité & toggles', () => {
  it('masquer un bloc le retire du modèle', () => {
    const m = buildCardModel(base, { showTotal: false, showProgression: false, showCentre: false });
    expect(m.showTotal).toBe(false);
    expect(m.showProgression).toBe(false);
    expect(m.centre).toBeNull();
  });

  it('n’expose jamais de numéro de licence (aucun champ licence dans le modèle)', () => {
    const m = buildCardModel(base, ON);
    expect(JSON.stringify(m).toLowerCase()).not.toContain('licence');
  });

  it('les chiffres viennent de l’entrée (source unique), non recalculés', () => {
    const m = buildCardModel({ ...base, total: 999 }, ON);
    expect(m.total).toBe(999);
  });
});
