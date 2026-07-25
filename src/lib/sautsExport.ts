import { formatDateTimeParis } from './datetime';

// ─── Export CSV des sauts (Prompt Q) ─────────────────────────────────────────
// La traçabilité de validation (validateur + horodatage) doit apparaître dans
// l'export, pas seulement à l'écran.

export interface SautExport {
  id: string;
  parachutiste_id: string;
  date_saut: string;
  lieu: string | null;
  hauteur_m: number | null;
  categorie: string | null;
  statut: string;
  parachutiste_nom?: string | null;
  parachutiste_prenom?: string | null;
  moniteur_nom_libre?: string | null;
  valide_par?: string | null;
  valide_le?: string | null;
}

const HEADER = [
  'id', 'parachutiste_id', 'date_saut', 'lieu', 'hauteur_m', 'categorie', 'statut',
  'nom', 'prenom', 'moniteur_declare', 'valide_par', 'valide_le',
];

/** Échappe une valeur CSV (guillemets si virgule / guillemet / saut de ligne). */
function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Sérialise des sauts en CSV incluant la trace de validation (validateur + horodatage Paris). */
export function sautsToCSV(sauts: SautExport[]): string {
  const lines = sauts.map(s => [
    s.id, s.parachutiste_id, s.date_saut, s.lieu ?? '', s.hauteur_m ?? '', s.categorie ?? '', s.statut,
    s.parachutiste_nom ?? '', s.parachutiste_prenom ?? '',
    s.moniteur_nom_libre ?? '',
    s.valide_par ?? '',
    s.valide_le ? formatDateTimeParis(s.valide_le) : '',
  ].map(esc).join(','));
  return [HEADER.join(','), ...lines].join('\n');
}
