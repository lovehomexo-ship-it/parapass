import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plane, Sunset, ListOrdered, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Avatar } from '../../components/Avatar';
import { coucherSoleil, libelleCoucher } from '../../lib/soleil';
import { phaseRotation, siegesOccupes } from '../../lib/avionnage';
import { FriseRotations } from './FriseRotations';


// ═══════════════════════════════════════════════════════════════════════════
// LE COCKPIT DU JOUR — la première chose que voit un directeur technique.
//
// CE QUI N'ALLAIT PAS. Le mode Journée empilait six bandes pleine largeur de
// poids égal, trois lignes de texte de 12 à 14 px chacune, et la bande la plus
// visible était l'identité du centre — la seule information qui ne change
// jamais. Rien ne disait, d'un regard, si la journée tournait.
//
// CE QUE FAIT CE BLOC, au regard de ce qu'attend un écran de pilotage (Few
// pour la lecture d'un coup d'œil, les centres de contrôle aérien pour l'état
// d'abord et le temps comme axe) :
//   • un bandeau « aujourd'hui » : le centre en petit, la date, et le compte à
//     rebours jusqu'au coucher du soleil, qui borne la journée ;
//   • quatre tuiles à grands chiffres, chacune menant à son écran ;
//   • la ligne de temps des rotations, de la première au coucher du soleil,
//     avec le maintenant marqué.
//
// IL NE DÉCIDE RIEN ET N'ÉCRIT RIEN. Les chiffres viennent du tableau de bord
// (mêmes compteurs que la barre d'état) ; les rotations et les visages sont
// LUS. Aucun verdict n'est recalculé ici : la décision météo et l'aptitude
// gardent leur source unique, juste en dessous. S'il échoue, il disparaît seul.
// ═══════════════════════════════════════════════════════════════════════════

interface Rotation {
  id: string;
  numero: number;
  statut: string;
  heure_prevue: string | null;
  heure_decollage: string | null;
  heure_largage: string | null;
  cloturee_le: string | null;
  embarquement_valide_le: string | null;
  aeronefs: { immatriculation: string | null; places: number | null } | null;
  places_rotation: { parachutiste_id: string | null; moniteur_id: string | null }[];
}

interface Visage { user_id: string; prenom: string; nom: string; photo_profil_url: string | null; encadrant: boolean; statut: string }

const minutesDe = (hhmm: string | null) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const libHeure = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;

/** Partie, embarque, en préparation — lu dans la phase commune (lib/avionnage),
 *  la même que la frise et les planches. */
function etatRotation(r: Rotation): 'partie' | 'embarque' | 'prepa' {
  const p = phaseRotation(r);
  if (p === 'embarquement') return 'embarque';
  if (p === 'preparation') return 'prepa';
  return 'partie';
}

function Tuile({ to, icone, valeur, unite, titre, legende, accent, children }: {
  to: string; icone: React.ReactNode; valeur: React.ReactNode; unite?: string;
  titre: string; legende?: React.ReactNode; accent: string; children?: React.ReactNode;
}) {
  return (
    <Link to={to} className="rounded-2xl p-4 flex flex-col gap-2 no-underline transition hover:-translate-y-0.5"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', minHeight: 148,
               boxShadow: '0 1px 2px rgba(11,29,58,0.06)' }}>
      <span className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--c-muted)' }}>
          <span className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}>{icone}</span>
          {titre}
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--c-dim)' }} aria-hidden />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>{valeur}</span>
        {unite && <span className="text-[15px] font-semibold" style={{ color: 'var(--c-muted)' }}>{unite}</span>}
      </span>
      {legende && <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>{legende}</span>}
      {children}
    </Link>
  );
}

function Inner({ centreId, centreNom, logoUrl, presents, sauts, enFile, avionnageDisponible }: {
  centreId: string; centreNom: string; logoUrl: string | null;
  presents: number; sauts: number; enFile: number; avionnageDisponible: boolean;
}) {
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [visages, setVisages] = useState<Visage[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());
  // TANT QUE RIEN N'EST LU, ON NE DIT RIEN. Afficher « Aucune rotation
  // programmée » pendant la première seconde, c'est affirmer une absence
  // qu'on n'a pas vérifiée (P1) — un DT qui jette un œil à ce moment-là
  // repart avec une information fausse.
  const [lu, setLu] = useState(false);

  const charger = useCallback(async () => {
    const jour = new Date().toISOString().slice(0, 10);
    const [rot, pres, ctr] = await Promise.all([
      avionnageDisponible
        ? supabase.from('rotations')
            .select('id, numero, statut, heure_prevue, heure_decollage, heure_largage, cloturee_le, embarquement_valide_le, aeronefs(immatriculation, places), places_rotation(parachutiste_id, moniteur_id)')
            .eq('centre_id', centreId).eq('date_jour', jour).order('numero')
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc('presents_du_jour', { p_centre_id: centreId }),
      supabase.from('centres').select('latitude, longitude').eq('id', centreId).maybeSingle(),
    ]);
    // Une lecture ratée vide le bloc concerné, elle ne l'invente pas.
    if (!rot.error) setRotations((rot.data ?? []) as unknown as Rotation[]);
    if (!pres.error) setVisages(((pres.data ?? []) as Visage[]).filter(v => v.statut !== 'parti'));
    const c = ctr.data as { latitude: number | null; longitude: number | null } | null;
    if (c?.latitude != null && c?.longitude != null) setCoords({ lat: c.latitude, lon: c.longitude });
    setLu(true);
  }, [centreId, avionnageDisponible]);

  useEffect(() => { charger(); }, [charger]);
  // L'horloge avance toute seule : le marqueur « maintenant » et le compte à
  // rebours ne doivent pas attendre un rechargement. Les données, elles, se
  // relisent chaque minute — une rotation passe d'« embarquement » à « en vol »
  // sans que le DT touche à rien.
  useEffect(() => {
    const t = window.setInterval(() => { setMaintenant(new Date()); charger(); }, 60_000);
    return () => window.clearInterval(t);
  }, [charger]);

  const coucher = coords ? coucherSoleil(maintenant, coords.lat, coords.lon) : null;
  const lc = libelleCoucher(coucher, maintenant);
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(maintenant);
  const encadrants = visages.filter(v => v.encadrant).length;

  // Le prochain avion : le premier qui n'est pas encore parti.
  const prochain = rotations.find(r => etatRotation(r) !== 'partie') ?? null;
  // Compté comme sur la planche : le moniteur accompagnant prend un siège.
  const prises = (r: Rotation) => siegesOccupes(r.places_rotation ?? []);

  return (
    <section aria-label="Aujourd'hui" className="space-y-3">
      {/* ── BANDEAU « AUJOURD'HUI » ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {logoUrl
          ? <img src={logoUrl} alt="" className="w-11 h-11 rounded-xl object-contain p-1"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }} />
          : null}
        {/* `min-w` force la pastille du coucher à passer DESSOUS sur un
            téléphone, au lieu d'écraser le titre en une colonne d'un mot par
            ligne. */}
        <div className="flex-1" style={{ minWidth: 220 }}>
          <p className="text-[13px] font-semibold capitalize" style={{ color: 'var(--c-muted)' }}>{date} · {centreNom}</p>
          <h1 className="text-[22px] sm:text-[28px]" style={{ fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>
            {presents === 0
              ? 'Personne sur le terrain pour l’instant'
              : prochain
                ? `${presents} sur le terrain, rotation ${prochain.numero} ${etatRotation(prochain) === 'embarque' ? 'à l’embarquement' : 'en préparation'}`
                : `${presents} sur le terrain`}
          </h1>
        </div>
        {lc && (
          <span className="inline-flex items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold"
            style={{ minHeight: 36,
              color: lc.urgent ? 'var(--sev-vigilance)' : 'var(--c-text2)',
              background: lc.urgent ? 'color-mix(in srgb, var(--sev-vigilance) 12%, transparent)' : 'var(--c-card)',
              border: `1px solid ${lc.urgent ? 'color-mix(in srgb, var(--sev-vigilance) 40%, transparent)' : 'var(--c-border)'}` }}>
            <Sunset className="w-4 h-4" aria-hidden /> Coucher {lc.heure} · {lc.reste}
          </span>
        )}
      </div>

      {/* ── QUATRE TUILES À GRANDS CHIFFRES ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tuile to="/centre/presents" accent="var(--action-texte)" icone={<Users className="w-4 h-4" />}
          titre="Présents" valeur={presents}
          legende={encadrants > 0 ? `dont ${encadrants} encadrant${encadrants > 1 ? 's' : ''}` : 'déclarés par eux-mêmes'}>
          {/* LES VISAGES, PAS SEULEMENT LE CHIFFRE : on reconnaît son monde
              avant de lire un nombre. */}
          {visages.length > 0 && (
            <span className="flex items-center mt-auto">
              {visages.slice(0, 6).map((v, i) => (
                <span key={v.user_id} style={{ marginLeft: i ? -8 : 0, borderRadius: 999, border: '2px solid var(--c-card)', display: 'inline-flex' }}>
                  <Avatar photo={v.photo_profil_url} prenom={v.prenom} nom={v.nom} taille={28} />
                </span>
              ))}
              {visages.length > 6 && <span className="text-[13px] font-semibold ml-2" style={{ color: 'var(--c-muted)' }}>+{visages.length - 6}</span>}
            </span>
          )}
        </Tuile>

        {avionnageDisponible ? (
          <Tuile to="/centre/rotations" accent="var(--accent-texte)" icone={<Plane className="w-4 h-4" />}
            titre="Prochain avion"
            valeur={!lu ? '…' : prochain ? prises(prochain) : '—'}
            unite={prochain?.aeronefs?.places ? `/ ${prochain.aeronefs.places}` : undefined}
            legende={prochain
              ? `Rotation ${prochain.numero}${prochain.heure_prevue ? ` · ${libHeure(minutesDe(prochain.heure_prevue)!)}` : ''}${prochain.aeronefs?.immatriculation ? ` · ${prochain.aeronefs.immatriculation.replace(/-/g, '\u2011')}` : ''}`
              : lu ? 'Aucune rotation programmée' : 'lecture des planches…'}>
            {prochain?.aeronefs?.places ? (
              <span className="mt-auto h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-hover)' }}>
                <span className="block h-full rounded-full" style={{
                  width: `${Math.min(100, (prises(prochain) / prochain.aeronefs.places) * 100)}%`,
                  background: 'var(--accent-texte)' }} />
              </span>
            ) : null}
          </Tuile>
        ) : (
          <Tuile to="/centre/equipe" accent="var(--sev-conforme)" icone={<Users className="w-4 h-4" />}
            titre="Encadrants" valeur={encadrants} legende="qualifiés et présents" />
        )}

        <Tuile to="/centre/sauts" accent="var(--sev-conforme)" icone={<ListOrdered className="w-4 h-4" />}
          titre="Sauts aujourd’hui" valeur={sauts}
          legende={(() => {
            if (!rotations.length) return 'enregistrés sur la journée';
            const n = rotations.filter(r => etatRotation(r) === 'partie').length;
            return n === 0 ? `aucun avion parti sur ${rotations.length}` : `${n} avion${n > 1 ? 's' : ''} parti${n > 1 ? 's' : ''} sur ${rotations.length}`;
          })()} />

        {avionnageDisponible ? (
          <Tuile to="/centre/rotations" accent="var(--action-texte)" icone={<ListOrdered className="w-4 h-4" />}
            titre="En file" valeur={enFile}
            legende={enFile > 0 ? 'en attente d’une place' : 'personne n’attend'} />
        ) : (
          <Tuile to="/centre/presents" accent="var(--action-texte)" icone={<Users className="w-4 h-4" />}
            titre="Repartis" valeur={Math.max(0, visages.length - presents)} legende="ont quitté le terrain" />
        )}
      </div>

      {/* ── LA JOURNÉE EN ROTATIONS ── partagée avec l'écran Avionnage. */}
      {avionnageDisponible && (
        <FriseRotations maintenant={maintenant} coucher={coucher} libelleCoucher={lc?.heure}
          rotations={rotations.map(r => ({
            id: r.id, numero: r.numero, statut: r.statut, heure_prevue: r.heure_prevue,
            heure_decollage: r.heure_decollage, heure_largage: r.heure_largage,
            cloturee_le: r.cloturee_le, embarquement_valide_le: r.embarquement_valide_le,
            immatriculation: r.aeronefs?.immatriculation ?? null,
            capacite: r.aeronefs?.places ?? null, prises: prises(r),
          }))} />
      )}
    </section>
  );
}

export function CockpitDuJour(props: {
  centreId: string | undefined; centreNom: string; logoUrl: string | null;
  presents: number; sauts: number; enFile: number; avionnageDisponible: boolean;
}) {
  if (!props.centreId) return null;
  return <ErrorBoundary><Inner {...props} centreId={props.centreId} /></ErrorBoundary>;
}
