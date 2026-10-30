// ═══════════════════════════════════════════════════════════════════════════
// LA FICHE PILOTE — qui saute, dans quel ordre, et à quelle hauteur.
//
// Retour du DT de Rochefort : un jeune a sauté à 1 500 m ; le pilote ignorait
// qu'il restait quelqu'un à bord pour ce palier, a remis de la puissance pour
// remonter, et le sauteur a heurté le train arrière. Le pilote doit SAVOIR,
// avant de décoller, qu'il y a des sorties sous l'altitude principale, combien,
// et qui sort en dernier à chaque palier.
//
// On regroupe les sorties par palier d'altitude, dans l'ordre où l'avion les
// rencontre (en montée : du plus bas au plus haut), et on lève une alerte pour
// chaque palier qui n'est pas l'altitude principale de l'avion.
// ═══════════════════════════════════════════════════════════════════════════

export interface SortiePilote {
  id: string;
  nom: string;
  rang: number | null;
  typeSaut: string;
  /** Altitude de CE sauteur ; null = celle de l'avion. */
  altitudeM: number | null;
  passager?: boolean;
}

export interface Palier {
  altitudeM: number;
  sorties: SortiePilote[];
  /** Ce palier est l'altitude principale de l'avion. */
  principal: boolean;
  /** Le dernier à sortir à ce palier — celui après lequel le pilote peut manœuvrer. */
  dernier: SortiePilote;
}

export interface FichePilote {
  paliers: Palier[];
  /** Les messages d'alerte, du plus urgent au moins urgent. */
  alertes: string[];
  /** Altitude inconnue pour l'avion ET pour certains sauteurs. */
  altitudesInconnues: number;
}

const nf = new Intl.NumberFormat('fr-FR');

export function fichePilote(sorties: SortiePilote[], altitudeAvionM: number | null): FichePilote {
  const groupes = new Map<number, SortiePilote[]>();
  let altitudesInconnues = 0;
  for (const s of sorties) {
    const alt = s.altitudeM ?? altitudeAvionM;
    if (alt == null) { altitudesInconnues++; continue; }
    if (!groupes.has(alt)) groupes.set(alt, []);
    groupes.get(alt)!.push(s);
  }
  // L'altitude principale : celle de l'avion, ou à défaut le palier le plus peuplé.
  const principale = altitudeAvionM
    ?? [...groupes.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0]?.[0] ?? null;

  const paliers: Palier[] = [...groupes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([altitudeM, ss]) => {
      const ordonnees = [...ss].sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99));
      return { altitudeM, sorties: ordonnees, principal: altitudeM === principale, dernier: ordonnees[ordonnees.length - 1] };
    });

  const alertes: string[] = [];
  for (const p of paliers) {
    if (p.principal) continue;
    const n = p.sorties.length;
    const qui = n === 1 ? p.sorties[0].nom : `${n} sauteurs`;
    alertes.push(p.altitudeM < (principale ?? Infinity)
      ? `Palier à ${nf.format(p.altitudeM)} m : ${qui} — tenir le palier jusqu’à la sortie de ${p.dernier.nom}, pas de remise de puissance avant.`
      : `Sortie au-dessus de l’altitude principale : ${qui} à ${nf.format(p.altitudeM)} m.`);
  }
  if (altitudesInconnues > 0) {
    alertes.push(`${altitudesInconnues} sauteur${altitudesInconnues > 1 ? 's' : ''} sans altitude de largage : à préciser avant le décollage.`);
  }
  return { paliers, alertes, altitudesInconnues };
}
