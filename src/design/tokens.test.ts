import { describe, it, expect } from 'vitest';
import { numberColor, color, statusSoft, space, layout, type NumberKind } from './tokens';
import { icons, iconeMeteo } from './icons';

describe('règle de couleur des chiffres', () => {
  it('chaque nature a UNE couleur unique et non ambiguë', () => {
    expect(numberColor('actionnable')).toBe(color.action);
    expect(numberColor('conforme')).toBe(color.ok);
    expect(numberColor('alerte')).toBe(color.warn);
    expect(numberColor('danger')).toBe(color.danger);
    expect(numberColor('informatif')).toBe(color.textPrimary);
  });

  it('couvre exactement les 5 cas, sans doublon de couleur entre statuts', () => {
    const kinds: NumberKind[] = ['actionnable', 'conforme', 'alerte', 'danger', 'informatif'];
    kinds.forEach(k => expect(typeof numberColor(k)).toBe('string'));
    // actionnable/conforme/alerte/danger sont 4 couleurs distinctes
    const statuts = [numberColor('actionnable'), numberColor('conforme'), numberColor('alerte'), numberColor('danger')];
    expect(new Set(statuts).size).toBe(4);
  });

  it("aucun violet/cyan dans le système (couleurs d'action & statut)", () => {
    const banned = ['#8b5cf6', '#a78bfa', '#06b6d4', '#22d3ee'];
    const used = [color.action, color.ok, color.warn, color.danger].map(c => c.toLowerCase());
    banned.forEach(b => expect(used).not.toContain(b));
  });
});

describe('tokens de statut', () => {
  it('chaque statut expose couleur + fond + bordure', () => {
    (['ok', 'warn', 'danger', 'neutral'] as const).forEach(s => {
      expect(statusSoft[s]).toHaveProperty('color');
      expect(statusSoft[s]).toHaveProperty('bg');
      expect(statusSoft[s]).toHaveProperty('border');
    });
  });
});

describe('échelle d’espacement', () => {
  it('multiples de 4 et rythme zone > carte', () => {
    Object.values(space).forEach(v => expect(v % 4).toBe(0));
    expect(layout.zoneGap).toBeGreaterThan(layout.cardGap);
  });
});

describe('famille d’icônes unique', () => {
  it('couvre les usages courants', () => {
    ['ajouterSaut', 'qr', 'sac', 'badges', 'valide', 'carnet', 'vent'].forEach(k => {
      expect(icons).toHaveProperty(k);
    });
  });
  it('iconeMeteo renvoie un composant pour tout code WMO', () => {
    [0, 2, 3, 45, 61, 71, 80, 95].forEach(code => expect(typeof iconeMeteo(code)).not.toBe('undefined'));
  });
});
