// ═══════════════════════════════════════════════════════════════════════════
// P7 — Évaluation météo PAR PUBLIC.
//
// Un directeur technique ne se demande pas « fait-il beau ? » mais « qui peut
// sauter ? ». Un vent de 22 kt ferme les élèves et laisse partir les confirmés :
// un feu unique ne peut pas dire ça.
//
// Ce module ne fait que comparer des mesures à des seuils. Aucun appel réseau,
// aucun état : il est directement testable.
// ═══════════════════════════════════════════════════════════════════════════

export type Feu = 'vert' | 'orange' | 'rouge';

export type PublicCible = 'eleve' | 'brevete_ab' | 'confirme' | 'tandem' | 'wingsuit';

export const LIBELLE_PUBLIC: Record<PublicCible, string> = {
  eleve: 'Élèves en progression',
  brevete_ab: 'Brevets A / B',
  confirme: 'Confirmés',
  tandem: 'Tandems',
  wingsuit: 'Wingsuit',
};

export interface SeuilsPublic {
  public_cible: PublicCible;
  ordre: number;
  vent_vigilance_kt: number;
  vent_max_kt: number;
  rafales_vigilance_kt: number;
  rafales_max_kt: number;
  vent_altitude_max_kt: number | null;
  ecart_sol_alt_max_kt: number | null;
  plafond_min_m: number | null;
  visibilite_min_km: number | null;
  actif: boolean;
}

export interface MesuresMeteo {
  ventKt: number;
  rafalesKt: number;
  ventAltitudeKt: number | null;
  plafondM: number | null;
  visibiliteKm: number | null;
}

export interface VerdictPublic {
  public_cible: PublicCible;
  libelle: string;
  feu: Feu;
  /** Le paramètre qui déclenche, en clair. Vide si tout est dans les seuils. */
  declencheur: string | null;
  /** Détail chiffré, pour que le DT voie la marge dont il dispose. */
  details: { label: string; valeur: string; seuil: string; feu: Feu }[];
}

const arrondi = (n: number) => Math.round(n);

/**
 * Évalue un public. Renvoie le feu le plus défavorable parmi les paramètres,
 * et NOMME celui qui déclenche : « Rafales 27 kt (max 25) » vaut mieux que
 * « conditions défavorables ».
 */
export function evaluerPublic(s: SeuilsPublic, m: MesuresMeteo): VerdictPublic {
  const details: VerdictPublic['details'] = [];
  let pire: Feu = 'vert';
  let declencheur: string | null = null;

  const retenir = (feu: Feu, texte: string) => {
    // rouge l'emporte sur orange, qui l'emporte sur vert
    const rang = { vert: 0, orange: 1, rouge: 2 };
    if (rang[feu] > rang[pire]) { pire = feu; declencheur = texte; }
  };

  // ── Vent au sol ──
  {
    const feu: Feu = m.ventKt > s.vent_max_kt ? 'rouge'
                   : m.ventKt > s.vent_vigilance_kt ? 'orange' : 'vert';
    details.push({ label: 'Vent au sol', valeur: `${arrondi(m.ventKt)} kt`,
                   seuil: `max ${s.vent_max_kt}`, feu });
    // Nomme le seuil réellement franchi : afficher « max » sur une vigilance
    // laisserait croire que la limite est atteinte.
    retenir(feu, `Vent ${arrondi(m.ventKt)} kt (${feu === 'rouge' ? 'max ' + s.vent_max_kt : 'vigilance ' + s.vent_vigilance_kt})`);
  }

  // ── Rafales ──
  {
    const feu: Feu = m.rafalesKt > s.rafales_max_kt ? 'rouge'
                   : m.rafalesKt > s.rafales_vigilance_kt ? 'orange' : 'vert';
    details.push({ label: 'Rafales', valeur: `${arrondi(m.rafalesKt)} kt`,
                   seuil: `max ${s.rafales_max_kt}`, feu });
    retenir(feu, `Rafales ${arrondi(m.rafalesKt)} kt (${feu === 'rouge' ? 'max ' + s.rafales_max_kt : 'vigilance ' + s.rafales_vigilance_kt})`);
  }

  // ── Vent en altitude ──
  if (m.ventAltitudeKt != null && s.vent_altitude_max_kt != null) {
    const feu: Feu = m.ventAltitudeKt > s.vent_altitude_max_kt ? 'rouge' : 'vert';
    details.push({ label: 'Vent en altitude', valeur: `${arrondi(m.ventAltitudeKt)} kt`,
                   seuil: `max ${s.vent_altitude_max_kt}`, feu });
    retenir(feu, `Vent en altitude ${arrondi(m.ventAltitudeKt)} kt (max ${s.vent_altitude_max_kt})`);
  }

  // ── Cisaillement sol / altitude ──
  if (m.ventAltitudeKt != null && s.ecart_sol_alt_max_kt != null) {
    const ecart = Math.abs(m.ventAltitudeKt - m.ventKt);
    const feu: Feu = ecart > s.ecart_sol_alt_max_kt ? 'orange' : 'vert';
    details.push({ label: 'Écart sol / altitude', valeur: `${arrondi(ecart)} kt`,
                   seuil: `max ${s.ecart_sol_alt_max_kt}`, feu });
    retenir(feu, `Écart sol/altitude ${arrondi(ecart)} kt (max ${s.ecart_sol_alt_max_kt})`);
  }

  // ── Plafond ── (un plafond bas ferme, quel que soit le vent)
  if (m.plafondM != null && s.plafond_min_m != null) {
    const feu: Feu = m.plafondM < s.plafond_min_m ? 'rouge' : 'vert';
    details.push({ label: 'Plafond', valeur: `${arrondi(m.plafondM)} m`,
                   seuil: `min ${s.plafond_min_m}`, feu });
    retenir(feu, `Plafond ${arrondi(m.plafondM)} m (min ${s.plafond_min_m})`);
  }

  // ── Visibilité ──
  if (m.visibiliteKm != null && s.visibilite_min_km != null) {
    const feu: Feu = m.visibiliteKm < s.visibilite_min_km ? 'rouge' : 'vert';
    details.push({ label: 'Visibilité', valeur: `${m.visibiliteKm} km`,
                   seuil: `min ${s.visibilite_min_km}`, feu });
    retenir(feu, `Visibilité ${m.visibiliteKm} km (min ${s.visibilite_min_km})`);
  }

  return {
    public_cible: s.public_cible,
    libelle: LIBELLE_PUBLIC[s.public_cible] ?? s.public_cible,
    feu: pire,
    declencheur,
    details,
  };
}

/** Évalue tous les publics actifs, dans l'ordre d'affichage du centre. */
export function evaluerTousPublics(seuils: SeuilsPublic[], m: MesuresMeteo): VerdictPublic[] {
  return seuils
    .filter(s => s.actif)
    .sort((a, b) => a.ordre - b.ordre)
    .map(s => evaluerPublic(s, m));
}

// ─── Dérive sous voile et point de largage ───────────────────────────────────

export interface CoucheVent { altitudeM: number; vitesseKt: number; directionDeg: number }

/**
 * Dérive cumulée pendant la descente sous voile, à partir du profil vertical.
 *
 * Modèle volontairement simple, et présenté comme une AIDE, jamais comme une
 * consigne : on somme, couche par couche, le déplacement du vent pendant le
 * temps passé dedans à taux de chute constant.
 *
 * Renvoie la distance et le CAP DEPUIS LA CIBLE vers le point de largage :
 * c'est ce que le DT veut lire (« 1,2 km au 250° »), le vent poussant la voile
 * en sens inverse.
 */
export function calculerDerive(
  couches: CoucheVent[],
  altitudeLargageM: number,
  tauxChuteMs = 5,
): { distanceM: number; capDeg: number } | null {
  if (couches.length === 0 || altitudeLargageM <= 0) return null;

  const triees = [...couches].filter(c => c.altitudeM <= altitudeLargageM)
                             .sort((a, b) => a.altitudeM - b.altitudeM);
  if (triees.length === 0) return null;

  let dx = 0, dy = 0;   // est, nord — en mètres
  for (let i = 0; i < triees.length; i++) {
    const bas = i === 0 ? 0 : (triees[i - 1].altitudeM + triees[i].altitudeM) / 2;
    const haut = i === triees.length - 1
      ? altitudeLargageM
      : (triees[i].altitudeM + triees[i + 1].altitudeM) / 2;
    const epaisseur = Math.max(0, haut - bas);
    const secondes = epaisseur / tauxChuteMs;
    const vitesseMs = triees[i].vitesseKt * 0.514444;
    // Direction météo = d'où vient le vent ; il pousse donc vers +180°.
    const versRad = ((triees[i].directionDeg + 180) % 360) * Math.PI / 180;
    dx += vitesseMs * secondes * Math.sin(versRad);
    dy += vitesseMs * secondes * Math.cos(versRad);
  }

  const distance = Math.hypot(dx, dy);
  // Point de largage : à l'OPPOSÉ de la dérive, vu depuis la cible.
  const capDeg = (Math.atan2(-dx, -dy) * 180 / Math.PI + 360) % 360;
  return { distanceM: distance, capDeg };
}
