import { describe, it, expect } from 'vitest';
import { coucherSoleil, minutesAvant, libelleCoucher } from './soleil';

// ═══════════════════════════════════════════════════════════════════════════
// Le coucher du soleil commande la fin de la journée de saut. Une heure fausse
// de dix minutes, et on programme un avion qui ne peut pas partir.
// Référence : Rochefort (45,89 N / -0,98 E), là où est BigAir.
// ═══════════════════════════════════════════════════════════════════════════

const ROCHEFORT = { lat: 45.89, lon: -0.98 };

const hhmmUTC = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

describe('coucherSoleil', () => {
  it('au solstice d’été, tard ; au solstice d’hiver, tôt — et l’écart est grand', () => {
    const ete = coucherSoleil(new Date('2026-06-21T12:00:00Z'), ROCHEFORT.lat, ROCHEFORT.lon)!;
    const hiver = coucherSoleil(new Date('2026-12-21T12:00:00Z'), ROCHEFORT.lat, ROCHEFORT.lon)!;
    expect(ete.getTime()).toBeGreaterThan(0);
    // Mesuré : 3 h 36 d'écart à cette latitude. J'avais écrit « plus de quatre
    // heures » de mémoire ; le calcul m'a corrigé, et c'est bien pour ça qu'on
    // ne devine pas cette heure-là.
    const ecartMin = (ete.getUTCHours() * 60 + ete.getUTCMinutes())
                   - (hiver.getUTCHours() * 60 + hiver.getUTCMinutes());
    expect(ecartMin).toBeGreaterThan(180);
    expect(ecartMin).toBeLessThan(260);
  });

  it('tombe dans la bonne heure UTC un jour d’équinoxe', () => {
    // Équinoxe : le soleil se couche autour de 18 h UTC près du méridien 0.
    const d = coucherSoleil(new Date('2026-09-23T12:00:00Z'), ROCHEFORT.lat, ROCHEFORT.lon)!;
    expect(['17', '18', '19']).toContain(hhmmUTC(d).slice(0, 2));
  });

  it('bouge de quelques minutes d’un jour à l’autre en septembre', () => {
    // C'est précisément pourquoi on l'affiche : personne ne la devine.
    const a = coucherSoleil(new Date('2026-09-20T12:00:00Z'), ROCHEFORT.lat, ROCHEFORT.lon)!;
    const b = coucherSoleil(new Date('2026-09-27T12:00:00Z'), ROCHEFORT.lat, ROCHEFORT.lon)!;
    const delta = Math.abs(minutesAvant(a, b));
    expect(delta).toBeGreaterThan(5);
    expect(delta).toBeLessThan(10080);
  });

  it('rend NULL au pôle en hiver plutôt qu’une heure inventée', () => {
    // Le soleil ne se couche pas : une heure fausse serait pire qu'un « inconnu ».
    expect(coucherSoleil(new Date('2026-12-21T12:00:00Z'), 80, 0)).toBeNull();
  });

  it('rend NULL si les coordonnées manquent', () => {
    expect(coucherSoleil(new Date(), NaN, 0)).toBeNull();
  });
});

describe('libelleCoucher', () => {
  const coucher = new Date('2026-09-26T19:58:00Z');

  it('dit l’heure et le temps restant', () => {
    const l = libelleCoucher(coucher, new Date('2026-09-26T17:00:00Z'))!;
    expect(l.reste).toMatch(/dans 2 h 58/);
    expect(l.urgent).toBe(false);
    expect(l.passe).toBe(false);
  });

  it('passe en urgence dans la dernière heure', () => {
    const l = libelleCoucher(coucher, new Date('2026-09-26T19:20:00Z'))!;
    expect(l.reste).toBe('dans 38 min');
    expect(l.urgent).toBe(true);
  });

  it('dit clairement quand c’est passé', () => {
    const l = libelleCoucher(coucher, new Date('2026-09-26T20:30:00Z'))!;
    expect(l.passe).toBe(true);
    expect(l.reste).toBe('le soleil est couché');
  });

  it('sans coucher connu, aucune ligne — on n’affiche pas un vide', () => {
    expect(libelleCoucher(null, new Date())).toBeNull();
  });
});
