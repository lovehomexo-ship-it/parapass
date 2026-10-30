import { limitesA, MASSE_PARACHUTE_PILOTE_KG, type BilanMasse, type FicheAeronef } from '../../lib/masseCentrage';

// ═══════════════════════════════════════════════════════════════════════════
// LE BILAN DE MASSE ET CENTRAGE D'UNE PLANCHE — le détail derrière la pastille.
//
// À gauche, le compte, ligne par ligne, comme sur une feuille de pesée : on
// voit d'où vient chaque kilo. À droite, le domaine de centrage : le point de
// décollage (plein) et celui d'atterrissage (creux) doivent tomber dedans.
// ═══════════════════════════════════════════════════════════════════════════

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const COULEUR: Record<BilanMasse['severite'], string> = {
  conforme: 'var(--sev-conforme, #15803D)', vigilance: 'var(--sev-vigilance, #B45309)',
  critique: 'var(--sev-critique, #DC2626)', neutre: 'var(--c-muted)',
};

export function DetailBilanMasse({ av, bilan, sieges }: {
  av: FicheAeronef; bilan: BilanMasse; sieges: (number | null)[];
}) {
  const densite = av.densite_carburant ?? 0.8;
  const piloteKg = (av.masse_pilote_kg ?? 0) + (av.parachute_pilote !== false ? MASSE_PARACHUTE_PILOTE_KG : 0);
  const sauteursKg = sieges.reduce<number>((s, m) => s + (m ?? 0), 0);
  const carbKg = bilan.carburantL !== null ? bilan.carburantL * densite : null;
  const lignes: [string, string, string?][] = [
    ['Avion à vide', av.masse_a_vide_kg != null ? `${nf.format(av.masse_a_vide_kg)} kg` : '—'],
    ['Pilote' + (av.parachute_pilote !== false ? ' et son parachute' : ''),
      av.masse_pilote_kg != null ? `${nf.format(piloteKg)} kg` : 'à renseigner'],
    ['Carburant', carbKg !== null ? `${nf.format(Math.round(carbKg))} kg` : 'non renseigné',
      bilan.carburantL !== null ? `${nf.format(bilan.carburantL)} L × ${nf.format(densite)}` : undefined],
    [`Sauteurs (${sieges.length})`, `${nf.format(sauteursKg)} kg`,
      bilan.massesInconnues ? `${bilan.massesInconnues} masse${bilan.massesInconnues > 1 ? 's' : ''} inconnue${bilan.massesInconnues > 1 ? 's' : ''}` : undefined],
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
      <div>
        <table className="w-full text-[13px]" style={{ color: 'var(--c-text)' }}>
          <tbody>
            {lignes.map(([lib, val, note]) => (
              <tr key={lib} style={{ borderBottom: '1px solid var(--c-border-s, var(--c-border))' }}>
                <td className="py-1.5 pr-2" style={{ color: 'var(--c-text2, var(--c-text))' }}>
                  {lib}{note && <span className="block" style={{ color: 'var(--c-muted)' }}>{note}</span>}
                </td>
                <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{val}</td>
              </tr>
            ))}
            <Total libelle="Au décollage" masse={bilan.decollage?.masseKg ?? null} max={av.masse_max_kg ?? null}
              marge={bilan.margeDecollageKg} sigle="MTOW" minimum={bilan.massesInconnues > 0} />
            <Total libelle="À l’atterrissage" masse={bilan.atterrissage?.masseKg ?? null} max={av.masse_max_atterrissage_kg ?? null}
              marge={bilan.margeAtterrissageKg} sigle="MLW"
              note={av.conso_rotation_l != null ? `sans les sauteurs, ${nf.format(av.conso_rotation_l)} L brûlés` : 'sans les sauteurs'} />
          </tbody>
        </table>
        {bilan.manques.length > 0 && (
          <p className="mt-2 text-[13px]" style={{ color: 'var(--c-muted)' }}>
            À compléter : {bilan.manques.join(', ')}. Le bilan ne compte que ce qui est connu.
          </p>
        )}
        <p className="mt-1 text-[13px]" style={{ color: 'var(--c-dim, var(--c-muted))' }}>
          Siège n° = ordre de la planche. Ce bilan aide la décision ; il ne remplace pas celle du pilote.
        </p>
      </div>
      <Domaine av={av} bilan={bilan} />
    </div>
  );
}

function Total({ libelle, masse, max, marge, sigle, minimum, note }: {
  libelle: string; masse: number | null; max: number | null; marge: number | null; sigle: string;
  minimum?: boolean; note?: string;
}) {
  const depasse = marge !== null && marge < 0;
  return (
    <tr>
      <td className="pt-2 pr-2 font-semibold">
        {libelle}
        {note && <span className="block font-normal" style={{ color: 'var(--c-muted)' }}>{note}</span>}
      </td>
      <td className="pt-2 text-right tabular-nums whitespace-nowrap">
        <strong>{masse !== null ? `${minimum ? '≥ ' : ''}${nf.format(masse)} kg` : '—'}</strong>
        {max !== null && (
          <span className="block" style={{ color: depasse ? COULEUR.critique : 'var(--c-muted)', fontWeight: depasse ? 700 : 400 }}>
            {sigle} {nf.format(max)} · {depasse ? `${nf.format(-marge!)} kg de trop` : `marge ${nf.format(marge!)} kg`}
          </span>
        )}
      </td>
    </tr>
  );
}

/** Le domaine de centrage, la masse en ordonnée, le % de corde en abscisse. */
function Domaine({ av, bilan }: { av: FicheAeronef; bilan: BilanMasse }) {
  const d = av.domaine_centrage;
  const dec = bilan.decollage, att = bilan.atterrissage;
  if (!d || d.length < 3 || dec?.pct == null) {
    return (
      <p className="text-[13px] rounded-xl p-3" style={{ color: 'var(--c-muted)', background: 'var(--c-hover)' }}>
        {!d || d.length < 3
          ? 'Renseignez le domaine de centrage et les bras de levier dans la fiche de l’avion pour voir où se place le centre de gravité.'
          : 'Centrage incalculable : un bras de levier manque dans la fiche de l’avion.'}
      </p>
    );
  }
  const W = 320, H = 210, g = 40, dr = 10, h = 14, b = 30;
  const pcts = [...d.map(p => p[1]), dec.pct, att?.pct ?? dec.pct];
  const masses = [...d.map(p => p[0]), dec.masseKg, att?.masseKg ?? dec.masseKg];
  const xMin = Math.floor(Math.min(...pcts) / 5) * 5 - 2, xMax = Math.ceil(Math.max(...pcts) / 5) * 5 + 2;
  // On zoome sur la plage utile : sous la masse à vide, le domaine ne sert à rien.
  const base = av.masse_a_vide_kg ?? Math.min(...masses.filter(m => m > 0));
  const mMin = Math.max(0, Math.floor((base * 0.9) / 250) * 250);
  const mMax = Math.ceil(Math.max(...masses) / 250) * 250;
  const X = (pct: number) => g + ((pct - xMin) / (xMax - xMin)) * (W - g - dr);
  const Y = (kg: number) => H - b - ((Math.max(kg, mMin) - mMin) / (mMax - mMin)) * (H - b - h);
  const poly = d.map(([kg, pct]) => `${X(pct)},${Y(kg)}`).join(' ');
  const coul = COULEUR[bilan.severite === 'neutre' ? 'neutre' : bilan.severite];
  const lim = limitesA(d, dec.masseKg);
  const ticksX = Array.from({ length: Math.floor((xMax - xMin) / 5) + 1 }, (_, i) => Math.ceil(xMin / 5) * 5 + i * 5).filter(v => v <= xMax);
  const ticksY = [mMin, (mMin + mMax) / 2, mMax].map(v => Math.round(v));

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Domaine de centrage : décollage ${nf.format(dec.masseKg)} kg à ${nf.format(dec.pct)} % de corde, ${dec.dansDomaine ? 'dans' : 'hors'} du domaine${att?.pct != null ? ` ; atterrissage ${nf.format(att.masseKg)} kg à ${nf.format(att.pct)} %` : ''}.`}>
        <clipPath id="zone-domaine"><rect x={g} y={h} width={W - g - dr} height={H - b - h} /></clipPath>
        {ticksY.map(v => (
          <g key={v}>
            <line x1={g} x2={W - dr} y1={Y(v)} y2={Y(v)} stroke="var(--c-border)" strokeDasharray="3 3" />
            <text x={g - 6} y={Y(v) + 4} textAnchor="end" fontSize="13" fill="var(--c-muted)">{nf.format(v)}</text>
          </g>
        ))}
        {ticksX.map(v => (
          <text key={v} x={X(v)} y={H - b + 18} textAnchor="middle" fontSize="13" fill="var(--c-muted)">{v} %</text>
        ))}
        <polygon points={poly} clipPath="url(#zone-domaine)"
          fill="color-mix(in srgb, var(--action-texte) 12%, transparent)" stroke="var(--action-texte)" strokeWidth="1.5" />
        {av.masse_max_kg != null && av.masse_max_kg <= mMax && (
          <line x1={g} x2={W - dr} y1={Y(av.masse_max_kg)} y2={Y(av.masse_max_kg)} stroke="var(--c-muted)" strokeWidth="1" />
        )}
        {att?.pct != null && (
          <line x1={X(dec.pct)} y1={Y(dec.masseKg)} x2={X(att.pct)} y2={Y(att.masseKg)}
            stroke={coul} strokeWidth="1.5" strokeDasharray="4 3" />
        )}
        {att?.pct != null && (
          <circle cx={X(att.pct)} cy={Y(att.masseKg)} r="5" fill="var(--c-card)" stroke={coul} strokeWidth="2" />
        )}
        <circle cx={X(dec.pct)} cy={Y(dec.masseKg)} r="6" fill={coul} stroke="var(--c-card)" strokeWidth="2" />
      </svg>
      <figcaption className="text-[13px] mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'var(--c-muted)' }}>
        <span><span aria-hidden style={{ color: coul }}>●</span> décollage {nf.format(dec.pct)} %
          {lim && <> (limites {nf.format(Math.round(lim.avant * 10) / 10)}–{nf.format(Math.round(lim.arriere * 10) / 10)} %)</>}</span>
        {att?.pct != null && <span><span aria-hidden style={{ color: coul }}>○</span> atterrissage {nf.format(att.pct)} %</span>}
      </figcaption>
    </figure>
  );
}
