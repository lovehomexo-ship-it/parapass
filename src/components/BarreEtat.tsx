// ═══════════════════════════════════════════════════════════════════════════
// LA BARRE D'ÉTAT — ce qui reste à faire, et rien d'autre.
//
// CE QUI N'ALLAIT PAS. Six tuiles de taille égale, dont cinq affichaient un
// zéro. « 0 licence expirée », « 0 certificat à renouveler », « 0 demande en
// attente » occupaient exactement autant de place, de contraste et d'attention
// que « 2 carnets à valider ». Le regard devait lire six chiffres pour en
// trouver un seul qui demande quelque chose. Un tableau de bord dont 80 % de la
// surface dit « rien à signaler » n'est pas un tableau de bord : c'est un
// formulaire.
//
// CE QUE ÇA DEVIENT. Une ligne.
//
//   • LES DÉFAUTS À ZÉRO DISPARAISSENT. Une file vide n'est pas une
//     information, c'est l'absence d'information. Quand il n'en reste aucun, on
//     le dit UNE fois, en une phrase — pas en cinq zéros.
//   • CE QUI RESTE DEVIENT UNE PASTILLE CLIQUABLE, colorée par sa gravité, qui
//     mène à l'écran où on le traite. Un manquement qui ne mène nulle part
//     laisse le DT sans recours (F12).
//   • LES CHIFFRES D'ACTIVITÉ — présents, sauts — gardent leur place à gauche,
//     en grand : ce sont les deux nombres qu'on vient chercher. Ils ne
//     réclament rien, ils ne sont donc jamais colorés.
//
// L'API ne change pas : la page passe les mêmes compteurs, c'est ici qu'on
// décide de ce qui mérite des pixels.
// ═══════════════════════════════════════════════════════════════════════════

import { Check, ChevronRight } from 'lucide-react';
import { surface, rayure, SEVERITE_COULEUR } from '../lib/jetons';

export type Gravite = 'critique' | 'vigilance' | 'neutre';

/** Compteur d'activité : neutre, sans action. Ex. sauts du jour. */
interface CompteurActivite {
  genre: 'activite';
  cle: string;
  valeur: number;
  libelle: string;
}

/** Compteur de défaut : coloré, libellé au verbe, ACTION OBLIGATOIRE.
 *  `onAller` n'est pas optionnel — un manquement qui ne mène nulle part
 *  laisse le DT sans recours (F12). */
interface CompteurDefaut {
  genre: 'defaut';
  cle: string;
  valeur: number;
  libelle: string;
  gravite: Exclude<Gravite, 'neutre'>;
  onAller: () => void;
}

export type Compteur = CompteurActivite | CompteurDefaut;

const COULEUR: Record<Exclude<Gravite, 'neutre'>, string> = {
  critique:  SEVERITE_COULEUR.critique,
  vigilance: SEVERITE_COULEUR.vigilance,
};

export function BarreEtat({ compteurs }: { compteurs: Compteur[] }) {
  // Un défaut à zéro n'est pas affiché : il n'a rien à dire. Le critique
  // d'abord — c'est l'ordre dans lequel on traite une journée.
  const defauts = compteurs
    .filter((c): c is CompteurDefaut => c.genre === 'defaut' && c.valeur > 0)
    .sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === 'critique' ? -1 : 1));
  const activites = compteurs.filter((c): c is CompteurActivite => c.genre === 'activite');

  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-x-6 gap-y-3 flex-wrap"
      style={surface(2)}>

      {/* LES DEUX NOMBRES QU'ON VIENT CHERCHER. Neutres, jamais colorés :
          ils ne demandent rien. */}
      {activites.map(a => (
        <span key={a.cle} className="flex items-baseline gap-1.5">
          <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: 'var(--c-text)' }}>
            {a.valeur}
          </span>
          <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>{a.libelle}</span>
        </span>
      ))}

      {/* Sans chiffre d'activité à sa gauche (le cockpit les porte en mode
          Journée), la barre se titre elle-même : sinon une pastille isolée à
          droite flotte au bout d'une bande vide. */}
      {activites.length === 0
        ? <span className="text-[13px] font-semibold" style={{ color: 'var(--c-muted)' }}>À traiter</span>
        : <span className="flex-1" />}

      {defauts.length === 0 ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--sev-conforme)' }}>
          <Check className="w-4 h-4" aria-hidden /> Rien à traiter aujourd’hui
        </span>
      ) : (
        <div className={`flex items-center gap-2 flex-wrap ${activites.length === 0 ? '' : 'justify-end'}`}>
          {defauts.map(d => (
            // RÈGLE 5 : LA FORME PORTE LA SÉVÉRITÉ, la couleur ne fait que la
            // confirmer. Deux pastilles qui ne se distinguent que par leur
            // teinte ne se distinguent pas du tout pour qui perçoit mal les
            // couleurs — et mal en plein soleil, ce qui est la condition
            // normale d'usage sur une DZ. La rayure de gauche garde donc son
            // tracé : plein pour un critique, tireté pour une vigilance. Les
            // coins sont carrés de ce côté pour que le trait porte.
            <button key={d.cle} onClick={d.onAller}
              className="inline-flex items-center gap-1.5 rounded-xl pl-2.5 pr-3 text-xs font-semibold transition hover:opacity-80"
              style={{
                minHeight: 36,
                color: COULEUR[d.gravite],
                background: `color-mix(in srgb, ${COULEUR[d.gravite]} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${COULEUR[d.gravite]} 40%, transparent)`,
                ...rayure(d.gravite),
              }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{d.valeur}</span>
              {d.libelle}
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
