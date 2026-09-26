// ═══════════════════════════════════════════════════════════════════════════
// LE COUCHER DU SOLEIL — la borne de la journée de saut.
//
// Sur un manifest professionnel, la ligne est en pied d'écran : « le dernier
// décollage doit avoir lieu avant le coucher du soleil ». C'est l'information
// qui commande la fin de journée, et elle ne se devine pas à l'œil : en
// septembre elle bouge de deux minutes par jour.
//
// Algorithme NOAA, celui des éphémérides publiques. Fonction PURE : elle prend
// une date et des coordonnées, elle rend un instant. Pas de réseau — une
// journée de saut ne dépend pas d'une API qui répond.
//
// CE QU'ELLE N'EST PAS : une règle. ParaPass ne connaît aucun texte fédéral
// fixant la marge avant le coucher, et P2 interdit d'en inventer un. L'écran
// affiche l'heure et le temps restant ; c'est le DT qui décide.
// ═══════════════════════════════════════════════════════════════════════════

const RAD = Math.PI / 180;

/**
 * Coucher du soleil (bord supérieur à l'horizon, réfraction standard -0,833°).
 * `null` quand le soleil ne se couche pas ce jour-là à cette latitude — c'est
 * un cas réel au-delà des cercles polaires, et rendre une heure fausse serait
 * pire que rendre « inconnu ».
 */
export function coucherSoleil(date: Date, latitude: number, longitude: number): Date | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  // Le jour se compte sur la DATE UTC, pas sur l'instant : partir de
  // getTime() faisait basculer au lendemain pour une heure d'après-midi —
  // mesuré, le coucher du 26 sortait au 27.
  const jours2000 = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(),
                                        date.getUTCDate()) / 86400000) - 10957;
  const nMidi = Math.round(jours2000 - longitude / 360);
  const midiSolaire = nMidi + longitude / 360;

  // Anomalie moyenne, équation du centre, longitude écliptique.
  const M = (357.5291 + 0.98560028 * midiSolaire) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + midiSolaire + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
  const declinaison = Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD));

  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(latitude * RAD) * Math.sin(declinaison))
             / (Math.cos(latitude * RAD) * Math.cos(declinaison));
  if (cosH > 1 || cosH < -1) return null;   // nuit polaire ou soleil de minuit

  const H = Math.acos(cosH) / RAD;
  const jjCoucher = transit + H / 360;
  return new Date((jjCoucher - 2440587.5) * 86400000);
}

/** Minutes restantes avant le coucher. Négatif = il est passé. */
export function minutesAvant(coucher: Date, maintenant: Date): number {
  return Math.round((coucher.getTime() - maintenant.getTime()) / 60000);
}

/**
 * Ce que la barre affiche. Le seuil d'alerte est un REPÈRE D'EXPLOITATION :
 * aucun texte fédéral connu de ParaPass ne fixe de marge, et on ne l'invente
 * pas. Il sert à attirer l'œil, pas à interdire.
 */
export const MARGE_VIGILANCE_MIN = 60;

export function libelleCoucher(coucher: Date | null, maintenant: Date): {
  heure: string; reste: string; urgent: boolean; passe: boolean;
} | null {
  if (!coucher) return null;
  const m = minutesAvant(coucher, maintenant);
  const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .format(coucher).replace(':', ' h ');
  if (m < 0) return { heure, reste: 'le soleil est couché', urgent: true, passe: true };
  const h = Math.floor(m / 60);
  return {
    heure,
    reste: h > 0 ? `dans ${h} h ${String(m % 60).padStart(2, '0')}` : `dans ${m} min`,
    urgent: m <= MARGE_VIGILANCE_MIN,
    passe: false,
  };
}
