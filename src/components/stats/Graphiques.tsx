import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// LES GRAPHIQUES DES STATISTIQUES — partagés par l'espace DZ et l'espace
// parachutiste, pour qu'une colonne de sauts se lise partout de la même façon.
//
// Une seule série, une seule teinte (le bleu d'action), le détail au survol et
// au clavier, le pic étiqueté. Pas de camembert : une part se compare mal
// d'un coup d'œil, une barre se compare tout de suite.
// ═══════════════════════════════════════════════════════════════════════════

const nf = new Intl.NumberFormat('fr-FR');

export interface Colonne {
  cle: string;
  /** Sous l'axe (« oct »). */
  court: string;
  /** Dans l'infobulle (« octobre 2026 »). */
  long: string;
  valeur: number;
  /** Une précision dans l'infobulle (« dont 2 tandems »). */
  detail?: string;
}

/** Colonnes verticales — l'évolution dans le temps. */
export function Colonnes({ points, unite = 'sauts', hauteur = 180 }: { points: Colonne[]; unite?: string; hauteur?: number }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(1, ...points.map(p => p.valeur));
  // Un libellé d'axe sur deux, sur trois… quand les colonnes sont nombreuses.
  const tous = Math.ceil(points.length / 12);
  const imax = points.reduce((b, p, i) => (p.valeur > points[b].valeur ? i : b), 0);
  return (
    // La marge haute loge l'étiquette du pic sans toucher le titre.
    <div style={{ paddingTop: 24 }}>
      <div className="relative flex items-end gap-[2px]" style={{ height: hauteur }} onMouseLeave={() => setSurvol(null)}>
        {[0.5, 1].map(f => (
          <div key={f} className="absolute left-0 right-0" style={{ bottom: `${f * 100}%`, borderTop: '1px dashed var(--c-border)' }} />
        ))}
        {points.map((p, i) => (
          <button key={p.cle} type="button" className="relative flex-1 min-w-0 h-full flex items-end justify-center"
            onMouseEnter={() => setSurvol(i)} onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)}
            aria-label={`${p.long} : ${nf.format(p.valeur)} ${unite}${p.detail ? `, ${p.detail}` : ''}`}>
            <span className="block w-full" style={{
              height: `${(p.valeur / max) * 100}%`, minHeight: p.valeur > 0 ? 3 : 0, maxWidth: 44,
              borderRadius: '4px 4px 0 0',
              background: survol === null || survol === i ? 'var(--action-texte)' : 'color-mix(in srgb, var(--action-texte) 45%, transparent)' }} />
            {i === imax && p.valeur > 0 && survol === null && (
              <span className="absolute text-[13px] font-bold tabular-nums" style={{ bottom: `calc(${(p.valeur / max) * 100}% + 4px)`, color: 'var(--c-text)' }}>
                {nf.format(p.valeur)}
              </span>
            )}
            {survol === i && (
              <span className="absolute z-10 rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap pointer-events-none"
                style={{ bottom: `calc(${(p.valeur / max) * 100}% + 8px)`, background: 'var(--c-text)', color: 'var(--c-card)',
                         // Aux bords, l'infobulle s'aligne sur la colonne au lieu de déborder.
                         ...(i < points.length / 4 ? { left: 0 } : i >= (points.length * 3) / 4 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }) }}>
                <strong>{nf.format(p.valeur)} {unite}</strong> · {p.long}
                {p.detail && <> · {p.detail}</>}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1.5" style={{ borderTop: '1px solid var(--c-border)' }}>
        {points.map((p, i) => (
          <span key={p.cle} className="flex-1 min-w-0 text-center text-[13px] pt-1 whitespace-nowrap overflow-visible" style={{ color: 'var(--c-dim)' }}>
            {/* Au téléphone, au-delà de huit colonnes, un libellé sur deux : douze
                mois côte à côte donnaient « janvfévrmars ». */}
            {i % tous === 0 ? <span className={points.length > 8 && i % 2 === 1 ? 'hidden sm:inline' : undefined}>{p.court}</span> : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barres horizontales — une répartition : libellé, barre, valeur et part. */
export function Barres({ lignes, total, vide = 'Aucun saut sur la période.' }: {
  lignes: { libelle: string; n: number }[]; total: number; vide?: string;
}) {
  if (lignes.length === 0) return <p className="text-[13px] py-4 text-center" style={{ color: 'var(--c-dim)' }}>{vide}</p>;
  const max = Math.max(1, ...lignes.map(l => l.n));
  return (
    <ul className="list-none p-0 m-0 space-y-2">
      {lignes.map(l => (
        <li key={l.libelle} className="grid items-center gap-3" style={{ gridTemplateColumns: 'minmax(88px, 34%) 1fr auto' }}
          title={`${l.libelle} : ${nf.format(l.n)}`}>
          <span className="text-[13px] truncate" style={{ color: 'var(--c-text2)' }}>{l.libelle}</span>
          <span className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--c-hover)' }}>
            <span className="block h-full" style={{ width: `${(l.n / max) * 100}%`, minWidth: l.n > 0 ? 4 : 0,
              borderRadius: 999, background: 'var(--action-texte)' }} />
          </span>
          <span className="text-[13px] tabular-nums text-right" style={{ color: 'var(--c-text)', minWidth: 72 }}>
            <strong>{nf.format(l.n)}</strong>
            <span style={{ color: 'var(--c-dim)' }}> · {(() => { const p = total ? (l.n / total) * 100 : 0; return l.n > 0 && p < 1 ? '< 1' : Math.round(p); })()} %</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Une carte de section, titre discret et aide facultative. */
export function CarteStats({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <h2 className="text-[13px] font-semibold" style={{ color: 'var(--c-muted)' }}>{titre}</h2>
      {aide && <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-dim)' }}>{aide}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Une tuile à grand chiffre, comme sur les tableaux de bord. */
export function TuileStat({ icone, titre, valeur, unite, children }: {
  icone: React.ReactNode; titre: string; valeur: React.ReactNode; unite?: string; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', minHeight: 124,
               boxShadow: '0 1px 2px rgba(11,29,58,0.06)' }}>
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--c-muted)' }}>
        <span className="w-7 h-7 rounded-lg inline-flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--action-texte) 14%, transparent)', color: 'var(--action-texte)' }}>{icone}</span>
        <span className="min-w-0">{titre}</span>
      </span>
      <span className="flex items-baseline gap-1.5 flex-wrap">
        <span className="tabular-nums" style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>{valeur}</span>
        {unite && <span className="text-[15px] font-semibold" style={{ color: 'var(--c-muted)' }}>{unite}</span>}
      </span>
      {children}
    </div>
  );
}
