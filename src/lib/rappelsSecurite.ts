import { getCurrencyRule, type CurrencyRules } from './currency';

// ═══════════════════════════════════════════════════════════════════════════
// LES RAPPELS DE SÉCURITÉ À PRÉVOIR — retour du DT de Rochefort : un rappel
// prend plusieurs dizaines de minutes et demande un moniteur. Le découvrir au
// pied de l'avion, c'est trop tard. On le lit donc À L'AVANCE : parmi ceux qui
// se sont annoncés aujourd'hui et les jours suivants, qui revient après une
// trop longue interruption, mesurée À LA DATE où il viendra.
// ═══════════════════════════════════════════════════════════════════════════

export interface PresenceAnnoncee { userId: string; date: string /* AAAA-MM-JJ */ }

export interface RappelAPrevoir {
  userId: string;
  date: string;
  /** Jours sans sauter à la date de venue ; null = aucun saut connu. */
  jours: number | null;
  niveau: string | null;
  obligatoire: boolean;
}

const JOUR = 86_400_000;
const versJour = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

export function rappelsAPrevoir(
  presences: PresenceAnnoncee[],
  dernierSaut: Record<string, string | null>,
  niveaux: Record<string, string | null | undefined>,
  regles: CurrencyRules,
): RappelAPrevoir[] {
  // Une personne annoncée plusieurs jours : le rappel se fait à sa PREMIÈRE venue.
  const premiere = new Map<string, string>();
  for (const p of presences) {
    const d = premiere.get(p.userId);
    if (!d || p.date < d) premiere.set(p.userId, p.date);
  }
  const out: RappelAPrevoir[] = [];
  for (const [userId, date] of premiere) {
    const dernier = dernierSaut[userId] ?? null;
    const niveau = niveaux[userId] ?? null;
    const regle = getCurrencyRule(niveau, regles);
    const jours = dernier ? Math.floor((versJour(date) - versJour(dernier.slice(0, 10))) / JOUR) : null;
    // Aucun saut connu : on ne sait pas — on ne l'invente pas en « rappel ».
    if (jours === null) continue;
    if (jours >= regle.seuil_obligatoire_jours) out.push({ userId, date, jours, niveau, obligatoire: true });
    else if (jours >= regle.seuil_conseille_jours) out.push({ userId, date, jours, niveau, obligatoire: false });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || Number(b.obligatoire) - Number(a.obligatoire) || (b.jours ?? 0) - (a.jours ?? 0));
}
