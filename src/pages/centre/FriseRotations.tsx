import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, DoorOpen, PlaneTakeoff, PlaneLanding, Lock, X, Sunset } from 'lucide-react';
import { phaseRotation, PHASE_ROTATION, ORDRE_PHASES, type PhaseRotation } from '../../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// LA JOURNÉE EN ROTATIONS — la frise, partagée par le tableau de bord
// (mode Journée) et l'écran Avionnage.
//
// Elle ne lit rien elle-même : chaque écran lui passe les rotations qu'il a
// déjà, et qu'il tient à jour en temps réel. Deux lectures de la même table
// auraient fini par afficher deux états du même avion.
//
// Trois étages, du plus synthétique au plus précis :
//   1. le résumé — combien d'avions dans chaque phase, combien de sautants
//      déjà largués ;
//   2. la frise — chaque avion à son heure, coloré par sa phase ;
//   3. (option `detail`) le journal — pour chaque avion, l'heure de chaque
//      geste : décollage, largage, clôture. C'est « ce qui s'est passé ».
// ═══════════════════════════════════════════════════════════════════════════

export interface RotationFrise {
  id: string;
  numero: number;
  statut: string;
  heure_prevue: string | null;
  heure_decollage: string | null;
  heure_largage: string | null;
  cloturee_le: string | null;
  embarquement_valide_le: string | null;
  immatriculation: string | null;
  /** Sièges parachutistes de l'avion ; null = aéronef non renseigné. */
  capacite: number | null;
  /** Sièges occupés — compté par `siegesOccupes`, comme sur la planche. */
  prises: number;
}

const ICONE: Record<PhaseRotation, typeof Clock> = {
  preparation: Clock, embarquement: DoorOpen, en_vol: PlaneTakeoff,
  largue: PlaneLanding, cloturee: Lock, annulee: X,
};

const minutesDe = (hhmm: string | null) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const libHeure = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
/** Un horodatage complet (décollage, largage, clôture), en heure locale. */
const libInstant = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : libHeure(d.getHours() * 60 + d.getMinutes());
};

/** Le style d'une pastille de phase : fond plein, ou contour pour ce qui est fini. */
function stylePastille(p: PhaseRotation): React.CSSProperties {
  const s = PHASE_ROTATION[p];
  return s.fond
    ? { background: s.fond, color: '#fff' }
    : { background: 'var(--c-card)', color: s.trait, boxShadow: `inset 0 0 0 1.5px ${s.trait}`,
        textDecoration: p === 'annulee' ? 'line-through' : undefined };
}

export function PastillePhase({ phase }: { phase: PhaseRotation }) {
  const Icone = ICONE[phase];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 text-[13px] font-bold whitespace-nowrap"
      style={{ lineHeight: '24px', ...stylePastille(phase) }}>
      <Icone className="w-3.5 h-3.5" aria-hidden /> {PHASE_ROTATION[phase].libelle}
    </span>
  );
}

export function FriseRotations({ rotations, maintenant, coucher, libelleCoucher, lienPlanches = true, detail = false }: {
  rotations: RotationFrise[];
  maintenant: Date;
  coucher: Date | null;
  libelleCoucher?: string;
  lienPlanches?: boolean;
  detail?: boolean;
}) {
  // La largeur réelle de la piste : la place des étiquettes se décide en
  // pixels, pas en minutes — 40 minutes d'écart tiennent sur un bureau, pas
  // sur un téléphone.
  const piste = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = piste.current; if (!el) return;
    const ro = new ResizeObserver(() => setLargeur(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
    // La piste n'existe qu'une fois des rotations reçues.
  }, [rotations.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (rotations.length === 0) return null;

  const phases = rotations.map(r => ({ r, p: phaseRotation(r) }));
  const parPhase = new Map<PhaseRotation, number>();
  phases.forEach(({ p }) => parPhase.set(p, (parPhase.get(p) ?? 0) + 1));
  // Sautants déjà sortis de l'avion : ceux des avions largués ou clôturés.
  const largues = phases.filter(({ p }) => p === 'largue' || p === 'cloturee')
    .reduce((s, { r }) => s + r.prises, 0);
  const enCours = phases.some(({ p }) => p === 'en_vol' || p === 'largue' || p === 'embarquement');

  // ── Échelle : de la première rotation (ou 9 h) au coucher du soleil (ou
  //    19 h faute de coordonnées), arrondie à l'heure.
  const nowMin = maintenant.getHours() * 60 + maintenant.getMinutes();
  const heures = rotations.map(r => minutesDe(r.heure_prevue)).filter((m): m is number => m !== null);
  const coucherMin = coucher ? coucher.getHours() * 60 + coucher.getMinutes() : 19 * 60;
  const debut = Math.floor((Math.min(9 * 60, ...heures, nowMin) - 15) / 60) * 60;
  const fin = Math.ceil((Math.max(coucherMin, ...heures, nowMin) + 15) / 60) * 60;
  const pos = (m: number) => `${((m - debut) / (fin - debut)) * 100}%`;
  // Une heure sur deux, sur trois… dès que la piste est trop étroite pour en
  // écrire chaque heure : « 8 h 9 h 10 h » à 30 px d'écart se chevauchait en
  // « 89h10 » sur un téléphone.
  const nbHeures = (fin - debut) / 60;
  const pas = largeur > 0 ? Math.max(1, Math.ceil(nbHeures / Math.floor(largeur / 44))) : 1;
  const graduations: number[] = [];
  for (let h = debut; h <= fin; h += 60 * pas) graduations.push(h);

  return (
    <div className="rounded-2xl px-4 pt-3 pb-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--c-muted)' }}>
          La journée en rotations
          {/* « EN DIRECT » seulement quand un avion bouge : un point qui pulse
              sur une journée finie mentirait sur ce qu'il y a à regarder. */}
          {enCours && (
            <span className="inline-flex items-center gap-1.5" style={{ color: PHASE_ROTATION.en_vol.trait }}>
              <span className="relative inline-flex w-2 h-2">
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: PHASE_ROTATION.en_vol.trait, opacity: 0.6 }} />
                <span className="relative w-2 h-2 rounded-full" style={{ background: PHASE_ROTATION.en_vol.trait }} />
              </span>
              en direct
            </span>
          )}
        </span>
        {lienPlanches && (
          <Link to="/centre/rotations" className="text-[13px] font-semibold no-underline inline-flex items-center gap-1"
            style={{ color: 'var(--action-texte)', minHeight: 32 }}>
            Planches <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {/* ── 1. Le résumé : une pastille par phase présente, qui sert aussi de
             légende aux couleurs de la frise. ── */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {ORDRE_PHASES.filter(p => parPhase.has(p)).map(p => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span className="text-[15px] font-extrabold tabular-nums" style={{ color: 'var(--c-text)' }}>{parPhase.get(p)}</span>
            <PastillePhase phase={p} />
          </span>
        ))}
        <span className="text-[13px] ml-auto" style={{ color: 'var(--c-muted)' }}>
          {largues > 0
            ? <><strong style={{ color: 'var(--c-text)' }}>{largues}</strong> sautant{largues > 1 ? 's' : ''} largué{largues > 1 ? 's' : ''}</>
            : 'aucun sautant largué'}
        </span>
      </div>

      {/* ── 2. La frise ── */}
      <div ref={piste} className="relative" style={{ height: 112 }}>
        <div className="absolute left-0 right-0" style={{ top: 44, height: 4, borderRadius: 4, background: 'var(--c-hover)' }} />
        {graduations.map((h, i) => (
          <span key={h} className={`absolute text-[13px] tabular-nums whitespace-nowrap ${i === 0 ? '' : i === graduations.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: pos(h), top: 94, color: 'var(--c-dim)' }}>{h / 60} h</span>
        ))}
        {/* Ce qui est déjà passé est rempli : on lit l'avancement de la journée. */}
        <div className="absolute left-0" style={{ top: 44, height: 4, borderRadius: 4,
          width: pos(Math.max(debut, Math.min(fin, nowMin))), background: 'color-mix(in srgb, var(--action-texte) 35%, transparent)' }} />
        {coucher && (
          <span className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: pos(coucherMin), top: 37 }}
            title={`Coucher du soleil ${libelleCoucher ?? ''}`}>
            <Sunset className="w-4 h-4" style={{ color: 'var(--sev-vigilance)' }} aria-hidden />
          </span>
        )}
        {/* PLACEMENT DES ÉTIQUETTES, EN PIXELS. Chaque avion prend la première
            rangée libre (au-dessus, puis sous la piste) ; s'il n'y en a aucune,
            son étiquette se réduit à « R3 », puis à un point. Aucune étiquette
            n'en recouvre une autre, du bureau au téléphone. */}
        {(() => {
          const px = (m: number) => ((m - debut) / (fin - debut)) * (largeur || 1);
          const finRangee = [-Infinity, -Infinity];
          const LARGE = 96, COURT = 48, MARGE = 6;
          return phases.map(({ r, p }) => {
            const m = minutesDe(r.heure_prevue); if (m === null) return null;
            const x = px(m);
            let court = false;
            let rang = finRangee.findIndex(f => x - LARGE / 2 > f + MARGE);
            if (rang === -1) { court = true; rang = finRangee.findIndex(f => x - COURT / 2 > f + MARGE); }
            const style = stylePastille(p);
            const trait = PHASE_ROTATION[p].fond ?? PHASE_ROTATION[p].trait;
            const titre = `Rotation ${r.numero} · ${libHeure(m)} · ${PHASE_ROTATION[p].libelle}${r.capacite ? ` · ${r.prises}/${r.capacite}` : ''}`;
            if (rang === -1) {
              return (
                <span key={r.id} className="absolute -translate-x-1/2 rounded-full"
                  style={{ left: pos(m), top: 40, width: 12, height: 12, background: trait, border: '2px solid var(--c-card)' }}
                  title={titre} />
              );
            }
            finRangee[rang] = x + (court ? COURT : LARGE) / 2;
            const Icone = ICONE[p];
            const etiquette = (
              <span className="text-[13px] font-bold rounded-full px-2 inline-flex items-center gap-1 whitespace-nowrap"
                style={{ lineHeight: '24px', ...style }}>
                <Icone className="w-3.5 h-3.5" aria-hidden /> R{r.numero}{!court && r.capacite ? ` · ${r.prises}/${r.capacite}` : ''}
              </span>
            );
            const tige = <span style={{ width: 2, height: 14, background: trait }} />;
            return (
              <span key={r.id} className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: pos(m), top: rang === 0 ? 6 : 48 }} title={titre}>
                {rang === 0 ? <>{etiquette}{tige}</> : <>{tige}{etiquette}</>}
              </span>
            );
          });
        })()}
        {nowMin >= debut && nowMin <= fin && (
          <span className="absolute -translate-x-1/2" style={{ left: pos(nowMin), top: 36, width: 2, height: 20, background: 'var(--c-text)', borderRadius: 2 }}
            title={`Maintenant · ${libHeure(nowMin)}`} />
        )}
      </div>

      {/* ── 3. Le journal : ce qui s'est passé, avion par avion. ── */}
      {detail && (
        <ol className="list-none p-0 m-0 mt-3 divide-y" style={{ borderTop: '1px solid var(--c-border)', borderColor: 'var(--c-border)' }}>
          {phases.map(({ r, p }) => {
            const prevue = minutesDe(r.heure_prevue);
            const etapes = [
              ['décollage', libInstant(r.heure_decollage)],
              ['largage', libInstant(r.heure_largage)],
              ['clôture', libInstant(r.cloturee_le)],
            ].filter((e): e is [string, string] => !!e[1]);
            return (
              <li key={r.id} className="flex items-center gap-x-3 gap-y-1 flex-wrap py-2" style={{ borderColor: 'var(--c-border)' }}>
                <span className="text-[15px] font-extrabold tabular-nums" style={{ color: 'var(--c-text)', minWidth: 30 }}>R{r.numero}</span>
                <PastillePhase phase={p} />
                <span className="text-[13px] tabular-nums" style={{ color: 'var(--c-muted)' }}>
                  {r.immatriculation?.replace(/-/g, '‑') ?? 'aéronef ?'}
                  {r.capacite ? ` · ${r.prises}/${r.capacite}` : ` · ${r.prises} à bord`}
                </span>
                {/* Un avion pas encore parti dont l'heure est passée le dit :
                    « prévu 11 h 46 » à 16 h laissait croire qu'il était à l'heure. */}
                {(() => {
                  const retard = etapes.length === 0 && prevue !== null && (p === 'preparation' || p === 'embarquement')
                    ? nowMin - prevue : 0;
                  return (
                    <span className="text-[13px] tabular-nums ml-auto"
                      style={{ color: retard > 5 ? 'var(--sev-vigilance)' : 'var(--c-text2)', fontWeight: retard > 5 ? 600 : 400 }}>
                      {etapes.length > 0
                        ? etapes.map(([quoi, h]) => `${quoi} ${h}`).join(' · ')
                        : prevue !== null
                          ? `prévu ${libHeure(prevue)}${retard > 5 ? ` · en retard de ${retard >= 60 ? libHeure(retard).replace(' h 00', ' h') : `${retard} min`}` : ''}`
                          : 'heure non fixée'}
                    </span>
                  );
                })()}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
