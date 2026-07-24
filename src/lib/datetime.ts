// ─── Dates & heures — source unique ──────────────────────────────────────────
// Règle projet : centraliser tout calcul/affichage de date au même endroit.
// Stockage en base = UTC (timestamptz / date) ; l'affichage se fait en heure
// locale (Europe/Paris pour les horodatages), jamais via toISOString() qui
// décale d'un jour dans les fuseaux à offset positif.

const PARIS_TZ = 'Europe/Paris';

/** Clé de date `YYYY-MM-DD` en heure LOCALE (composants locaux, pas UTC).
 *  À utiliser pour la grille calendrier, la modale et la persistance d'un
 *  créneau : la date stockée correspond au jour réellement cliqué. */
export function ymdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toValidDate(iso: string | Date | null | undefined): Date | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Heure `HH:MM` d'un instant UTC affichée en Europe/Paris (gère été/hiver).
 *  Chaîne vide si la date est absente ou invalide. */
export function formatHeureParis(iso: string | Date | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: PARIS_TZ,
  }).format(d);
}

/** Date + heure d'un instant UTC affichés en Europe/Paris (`JJ/MM/AAAA HH:MM`).
 *  Chaîne vide si la date est absente ou invalide. */
export function formatDateTimeParis(iso: string | Date | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: PARIS_TZ,
  }).format(d);
}
