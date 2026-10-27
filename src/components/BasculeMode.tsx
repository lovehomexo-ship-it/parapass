import { useRef } from 'react';
import { surface } from '../lib/jetons';

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

export type ModeEcran = 'journee' | 'avionnage' | 'gestion';

export function BasculeMode({ mode, onChange, enAttenteGestion = 0, enAttenteAvionnage = 0,
  avionnageDisponible = true }: {
  mode: ModeEcran;
  onChange: (m: ModeEcran) => void;
  /** Ce qui reste à traiter côté Gestion — le MÊME total que la barre « À traiter ». */
  enAttenteGestion?: number;
  /** Personnes en file d'avionnage. Sa propre pastille : deux files
   *  différentes ne se confondent pas dans un seul chiffre (règle 3). */
  enAttenteAvionnage?: number;
  /**
   * Avionnage est un module optionnel : sans souscription, le troisième mode
   * ne s'affiche pas. Défaut VRAI, pour qu'aucun appelant existant ne change
   * de comportement du seul fait de cette prop.
   */
  avionnageDisponible?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // TROIS métiers, pas deux. La règle 7 disait « deux métiers, deux modes » ;
  // l'usage a montré un troisième, celui du chef d'avionnage — qui n'est ni le
  // terrain (aptitude, briefing) ni la gestion (dossiers, files administratives).
  // C'est une extension assumée de la règle, pas un glissement.
  const modes: { cle: ModeEcran; label: string }[] = [
    { cle: 'journee',   label: 'Journée' },
    ...(avionnageDisponible ? [{ cle: 'avionnage' as const, label: 'Avionnage' }] : []),
    { cle: 'gestion',   label: 'Gestion' },
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
      className="flex w-full sm:inline-flex sm:w-auto rounded-xl p-1 gap-1"
      style={surface(2)}>
      {modes.map((m, i) => {
        const actif = mode === m.cle;
        // UN CHIFFRE NU NE DIT RIEN. Les anciennes pastilles affichaient « 6 »
        // et « 2 » sans dire six quoi ni deux quoi — et le « 2 » de Gestion ne
        // comptait même pas la même chose que la barre « À traiter ». Le compte
        // est désormais écrit en clair, avec ce qu'il compte, à côté du nom.
        const compte = m.cle === 'gestion' ? enAttenteGestion
                     : m.cle === 'avionnage' ? enAttenteAvionnage : 0;
        const precision = compte > 0
          ? (m.cle === 'gestion' ? `${compte} à traiter` : `${compte} en file`)
          : null;
        return (
          <button key={m.cle}
            ref={el => { refs.current[i] = el; }}
            onClick={() => onChange(m.cle)}
            onKeyDown={e => auClavier(e, i)}
            aria-pressed={actif}
            // Sur téléphone, le compte passe SOUS le nom : trois boutons et deux
            // précisions ne tiennent pas sur une ligne de 343 px.
            className="flex-1 sm:flex-none px-3 sm:px-4 py-1 rounded-lg text-sm font-bold transition inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 whitespace-nowrap"
            style={{
              minHeight: 44,
              background: actif ? 'var(--action-fond)' : 'transparent',
              color: actif ? '#fff' : 'var(--c-muted)',
            }}>
            {m.label}
            {precision && (
              <span className="text-xs font-semibold rounded-full px-2"
                style={{
                  lineHeight: '20px',
                  background: actif ? 'rgba(255,255,255,0.18)' : 'color-mix(in srgb, var(--sev-vigilance) 14%, transparent)',
                  color: actif ? '#fff' : 'var(--sev-vigilance)',
                }}>
                {precision}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
