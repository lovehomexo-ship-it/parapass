// ═══════════════════════════════════════════════════════════════════════════
// LES PLAGES TANDEM — « matin » ou « après-midi » plutôt qu'une heure exacte.
//
// Retour du DT de Rochefort : promettre 10 h 30 à un passager, c'est se lier
// les mains ; lui promettre « le matin », c'est pouvoir remplir chaque avion
// au mieux avec les tandems de la demi-journée. Chaque DZ choisit : heures
// précises (sans plages), matin / après-midi, ou ses propres plages.
// ═══════════════════════════════════════════════════════════════════════════

export interface PlageTandem { cle: string; libelle: string; debut: string; fin: string }

export const PLAGES_DEMI_JOURNEE: PlageTandem[] = [
  { cle: 'matin', libelle: 'Matin', debut: '09:00', fin: '13:00' },
  { cle: 'apres_midi', libelle: 'Après-midi', debut: '13:00', fin: '19:00' },
];

/** « 09:00 » → « 9 h », « 10:30 » → « 10 h 30 ». */
export function heureFr(h: string | null | undefined): string {
  if (!h) return '';
  const [hh, mm] = h.slice(0, 5).split(':');
  return `${Number(hh)} h${mm && mm !== '00' ? ` ${mm}` : ''}`;
}

/** Le libellé d'un créneau : sa plage s'il en a une, sinon son heure. */
export function libelleCreneau(slot: { heure: string; plage?: string | null }, plages: PlageTandem[] | null | undefined): string {
  const p = slot.plage ? plages?.find(x => x.cle === slot.plage) : null;
  if (p) return `${p.libelle} · ${heureFr(p.debut)} – ${heureFr(p.fin)}`;
  if (slot.plage) return slot.plage;
  return heureFr(slot.heure);
}

/** Valide des plages saisies : clés uniques, heures lisibles, début avant fin. */
export function verifierPlages(plages: PlageTandem[]): string | null {
  if (plages.length === 0) return 'Ajoutez au moins une plage.';
  const cles = new Set<string>();
  for (const p of plages) {
    if (!p.libelle.trim()) return 'Chaque plage a besoin d’un nom.';
    if (!/^\d{2}:\d{2}$/.test(p.debut) || !/^\d{2}:\d{2}$/.test(p.fin)) return `Heures illisibles pour « ${p.libelle} ».`;
    if (p.debut >= p.fin) return `« ${p.libelle} » doit finir après son début.`;
    if (cles.has(p.cle)) return `Deux plages portent le même nom : « ${p.libelle} ».`;
    cles.add(p.cle);
  }
  return null;
}

/** Une clé stable tirée du nom : « Fin d'après-midi » → « fin_d_apres_midi ». */
export function cleDePlage(libelle: string): string {
  return libelle.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'plage';
}
