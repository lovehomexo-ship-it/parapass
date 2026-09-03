// ═══════════════════════════════════════════════════════════════════════════
// F07 — Une barre d'état, six pastilles.
//
// Six compteurs occupaient 610 px, chacun sur sa propre rangée pleine largeur.
// Une carte entière était consacrée à l'affichage d'un zéro. Six modules
// autonomes ne font pas un tableau de bord.
//
// F12 — Un chiffre de DÉFAUT se distingue d'un chiffre d'ACTIVITÉ. Le type
// l'impose : un compteur de défaut sans cible ne compile pas.
// ═══════════════════════════════════════════════════════════════════════════

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

const COULEUR: Record<Gravite, string> = {
  critique: '#F87171',   // blocage réglementaire
  vigilance: '#FBBF24',  // manquement à traiter
  neutre: 'var(--c-text)',
};

export function BarreEtat({ compteurs }: { compteurs: Compteur[] }) {
  return (
    <div
      className="grid gap-2 rounded-2xl p-2
                 grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      {compteurs.map(c => {
        const zero = c.valeur === 0;
        const couleur = c.genre === 'defaut' && !zero ? COULEUR[c.gravite] : COULEUR.neutre;
        // Une file vide ne doit jamais crier aussi fort qu'une file de 19 :
        // elle reste présente, atténuée, et cesse d'être cliquable.
        const cliquable = c.genre === 'defaut' && !zero;

        const contenu = (
          <>
            <span className="block font-extrabold leading-none"
              style={{ fontSize: zero ? 18 : 26, color: couleur, opacity: zero ? 0.45 : 1 }}>
              {c.valeur}
            </span>
            <span className="block mt-1 leading-tight"
              style={{ fontSize: 12, color: 'var(--c-muted)', opacity: zero ? 0.5 : 1 }}>
              {c.libelle}
            </span>
          </>
        );

        return cliquable ? (
          <button key={c.cle} onClick={(c as CompteurDefaut).onAller}
            className="text-left rounded-xl px-3 py-2 transition"
            style={{ minHeight: 64, background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
            {contenu}
          </button>
        ) : (
          <div key={c.cle} className="rounded-xl px-3 py-2"
            style={{ minHeight: 64, background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}
