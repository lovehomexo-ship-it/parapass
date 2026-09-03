import { useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// F14 — Deux métiers, deux modes explicites.
//
// L'écran servait le DT sur le terrain ET le gérant du centre en même temps,
// d'où ses trois noms. On ne les fond pas : on les sépare franchement.
//
// Accessibilité : rôle group, aria-pressed sur chaque bouton, navigation par
// flèches. Un DT en hangar navigue parfois au clavier d'un poste fixe, et la
// bascule doit rester atteignable sans souris.
// ═══════════════════════════════════════════════════════════════════════════

export type ModeEcran = 'journee' | 'gestion';

export function BasculeMode({ mode, onChange, enAttenteGestion = 0 }: {
  mode: ModeEcran;
  onChange: (m: ModeEcran) => void;
  /** Somme des files en attente côté Gestion. La pastille disparaît à zéro. */
  enAttenteGestion?: number;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const modes: { cle: ModeEcran; label: string }[] = [
    { cle: 'journee', label: 'Journée' },
    { cle: 'gestion', label: 'Gestion' },
  ];

  const auClavier = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const suivant = (i + (e.key === 'ArrowRight' ? 1 : -1) + modes.length) % modes.length;
    refs.current[suivant]?.focus();
    onChange(modes[suivant].cle);
  };

  return (
    <div role="group" aria-label="Mode d'affichage"
      className="inline-flex rounded-xl p-1 gap-1"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      {modes.map((m, i) => {
        const actif = mode === m.cle;
        // La pastille ne s'affiche que sur le mode INACTIF : sur le mode courant
        // le compte est déjà lisible dans les blocs eux-mêmes.
        const pastille = !actif && m.cle === 'gestion' && enAttenteGestion > 0;
        return (
          <button key={m.cle}
            ref={el => { refs.current[i] = el; }}
            onClick={() => onChange(m.cle)}
            onKeyDown={e => auClavier(e, i)}
            aria-pressed={actif}
            className="relative px-4 rounded-lg text-sm font-bold transition"
            style={{
              minHeight: 40,
              background: actif ? '#1C8CE8' : 'transparent',
              color: actif ? '#fff' : 'var(--c-muted)',
            }}>
            {m.label}
            {pastille && (
              <span aria-label={`${enAttenteGestion} éléments en attente`}
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full
                           text-[11px] font-bold flex items-center justify-center"
                style={{ background: '#F59E0B', color: '#1C1917' }}>
                {enAttenteGestion > 99 ? '99+' : enAttenteGestion}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
