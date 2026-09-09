import { useState, useEffect } from 'react';
import { MIME_FILE } from './FileAvionnageDZ';
import { SiglesFonctions } from '../../components/SigleFonction';
import { supabase } from '../../lib/supabase';
import { Plane, Clock, Users, ArrowDownUp, Lock, UserMinus, PlaneTakeoff } from 'lucide-react';
import { surface, rayure, pastille, action, SEVERITE_COULEUR, type Severite } from '../../lib/jetons';
import {
  formaterRetard,
  calculerCall, SEVERITE_CALL, siegesOccupes, libelleCapacite, messageErreur,
  LIBELLE_TYPE, type TypeSautFile,
} from '../../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// LA PLANCHE — une rotation, vue par le chef d'avionnage.
//
// Modèle repris des manifests professionnels : une planche ne s'annonce pas
// « à 14 h 30 », elle s'annonce « à 20 minutes ». Le décompte est ce qui
// déclenche l'habillage, le rassemblement, l'embarquement. Il est donc le plus
// gros caractère de la carte, avant même le numéro de rotation.
//
// L'horodatage est complet et VISIBLE : heure prévue, décollage réel, largage.
// Une planche sans trace horaire ne se relit pas le soir, et ne sert à rien
// pour un journal de bord.
// ═══════════════════════════════════════════════════════════════════════════

export interface PlaceVue {
  id: string; rotation_id: string; parachutiste_id: string | null;
  moniteur_id: string | null; type_saut: string; rang_sortie: number | null;
  statut: string; nom: string;
  /** Verdict Feu Vert. JAMAIS nul : ne rien savoir est un état — le gris —
   *  et il doit se voir. Une absence de badge se lisait « tout va bien ». */
  aptitude: 'vert' | 'orange' | 'rouge' | 'gris';
}
export interface RotationVue {
  id: string; numero: number; date_jour: string;
  heure_prevue: string | null; heure_decollage: string | null; heure_largage: string | null;
  statut: string; aeronef_id: string | null; altitude_largage_m: number | null;
  cloturee_le: string | null;
  /** Le largueur DÉSIGNÉ de cet avion. Un seul, choisi par la DZ. */
  largueur_id: string | null;
}
export interface AeronefVue { id: string; immatriculation: string; places: number }

// Les quatre verdicts Feu Vert, avec leur forme et leur mot. Le gris dit
// « on ne sait pas » et se traite comme un refus (P1) : il n'est pas neutre.
export const SEV_APTITUDE: Record<PlaceVue['aptitude'], Severite> = {
  vert: 'conforme', orange: 'vigilance', rouge: 'critique', gris: 'critique',
};
export const LIBELLE_APTITUDE: Record<PlaceVue['aptitude'], string> = {
  vert: 'peut sauter', orange: 'vigilance', rouge: 'à examiner', gris: 'à vérifier',
};

const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const hhmm = (iso: string | null) => iso ? HEURE.format(new Date(iso)).replace(':', ' h ') : null;

export function PlancheAvionnage({ rotation: r, places, aeronef, maintenant, onChange, onDeposer, onOuvrirFiche, largueurs, onDesignerLargueur }: {
  rotation: RotationVue;
  places: PlaceVue[];
  aeronef: AeronefVue | undefined;
  /** Injecté par le parent, qui tient UNE horloge : trente planches ne doivent
   *  pas déclencher trente minuteurs, et surtout pas se décaler entre elles. */
  maintenant: Date;
  onChange: () => void;
  /** Dépôt d'une demande de la file sur cette planche. Rend l'erreur, ou null. */
  onDeposer?: (fileId: string) => Promise<string | null>;
  onOuvrirFiche?: (parachutisteId: string) => void;
  /** Les largueurs QUALIFIÉS du centre, pour le sélecteur. */
  largueurs?: { parachutiste_id: string; nom: string; prenom: string }[];
  onDesignerLargueur?: (id: string | null) => void;
}) {
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);

  const call = calculerCall(r.date_jour, r.heure_prevue, r.heure_decollage, maintenant);
  const sieges = siegesOccupes(places);
  const close = r.statut === 'terminee' || r.cloturee_le !== null;
  const sev = close ? 'conforme' : SEVERITE_CALL[call.urgence];
  const complet = aeronef ? sieges >= aeronef.places : false;
  // Une planche close ou pleine n'accepte pas de dépôt : elle ne s'éclaire pas
  // au survol, plutôt que d'accueillir puis de refuser.
  const accepteDepot = !!onDeposer && !close && !complet && !r.heure_decollage;
  // Un avion prêt à partir SANS largueur est un avion qui ne partira pas :
  // la planche le dit par sa rayure, avant même qu'on lise le bouton.
  const largueurManquant = !close && !r.heure_decollage && places.length > 0 && !r.largueur_id;

  const agir = async (nom: string, fn: () => PromiseLike<{ error: unknown }>) => {
    setOccupe(true); setEchec(null);
    const { error } = await Promise.resolve(fn());
    setOccupe(false);
    if (error) {
      const e = error as { code?: string; message?: string; details?: string; hint?: string };
      console.error(`${nom} — échec :`, { code: e.code, message: e.message, details: e.details, hint: e.hint });
      setEchec(messageErreur(error));
      return;
    }
    onChange();
  };

  const fixerHeure = (valeur: string) =>
    agir('Heure de décollage prévue', () => supabase.from('rotations')
      .update({ heure_prevue: valeur || null }).eq('id', r.id).then(x => ({ error: x.error })));

  return (
    <article className="p-3.5"
      onDragOver={e => {
        if (!accepteDepot || !e.dataTransfer.types.includes(MIME_FILE)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        if (!survol) setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={async e => {
        setSurvol(false);
        const id = e.dataTransfer.getData(MIME_FILE);
        if (!accepteDepot || !id) return;
        e.preventDefault();
        setOccupe(true); setEchec(null);
        const err = await onDeposer!(id);
        setOccupe(false);
        if (err) setEchec(err);
      }}
      style={{ ...surface(2), ...rayure(largueurManquant ? 'vigilance' : sev),
               // Le survol se dit par la FORME (bordure épaissie, fond teinté),
               // pas par une couleur d'état seule (règle 5).
               outline: survol ? '2px dashed var(--action-texte)' : 'none',
               outlineOffset: 2,
               background: survol ? 'color-mix(in srgb, var(--action-texte) 8%, var(--n2-fond))' : undefined,
               transition: 'outline-color .15s, background .15s' }}>
      {/* ── Le décompte d'abord : c'est lui qu'on lit de loin ── */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          {/* « Avion n°N » — le nom que la DZ emploie à l'oral, et le premier
              repère du chef d'avionnage. Il passe devant le décompte : on
              cherche d'abord SON avion, on lit son call ensuite. */}
          <p className="font-extrabold leading-none" style={{ fontSize: 26, color: 'var(--c-text)' }}>
            Avion n°{r.numero}
          </p>
          <p className="mt-1 font-extrabold leading-none"
            style={{ fontSize: 17, color: close ? 'var(--c-muted)' : SEVERITE_COULEUR[sev] }}>
            {close ? 'clôturé' : formaterRetard(call.libelle)}
          </p>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            {aeronef?.immatriculation ?? 'aéronef non affecté'}
            {r.altitude_largage_m ? ` · ${r.altitude_largage_m} m` : ''}
          </p>
        </div>
        <span style={pastille(sieges >= (aeronef?.places ?? Infinity) ? 'critique' : 'neutre')}>
          {libelleCapacite(sieges, aeronef?.places ?? null)}
        </span>
      </div>

      {/* ── L'horodatage, complet et visible ──────────────────────────────── */}
      <div className="mt-2.5 flex items-center gap-3 flex-wrap" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
        <label className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" aria-hidden />
          <span className="sr-only">Décollage prévu — rotation {r.numero}</span>
          <input type="time" value={r.heure_prevue?.slice(0, 5) ?? ''}
            disabled={close || occupe}
            onChange={e => fixerHeure(e.target.value)}
            className="px-2 rounded-lg"
            style={{ minHeight: 32, fontSize: 12, background: 'var(--c-input)',
                     color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
        </label>
        {/* Les heures RÉELLES ne sont pas modifiables : elles sont relevées au
            moment du geste. Une heure de décollage qu'on peut retaper le soir
            n'est plus une trace. */}
        {r.heure_decollage && <span>décollage {hhmm(r.heure_decollage)}</span>}
        {r.heure_largage && <span>largage {hhmm(r.heure_largage)}</span>}
        {r.cloturee_le && <span>clôturée {hhmm(r.cloturee_le)}</span>}
      </div>

      {/* LE LARGUEUR DE CET AVION. Un seul. La liste ne propose que des
          qualifiés valides — et la base refuse les autres, au cas où. */}
      {!close && onDesignerLargueur && (
        <label className="mt-2 flex items-center gap-2 flex-wrap" style={{ fontSize: 12 }}>
          <span style={{ color: r.largueur_id ? 'var(--c-muted)' : SEVERITE_COULEUR.vigilance,
                         fontWeight: r.largueur_id ? 400 : 700 }}>
            Largueur{r.largueur_id ? '' : ' — obligatoire'}
          </span>
          <select value={r.largueur_id ?? ''} disabled={occupe}
            onChange={e => onDesignerLargueur(e.target.value || null)}
            className="px-2 rounded-lg"
            style={{ minHeight: 34, fontSize: 12, background: 'var(--c-input)',
                     color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }}>
            <option value="">— non désigné —</option>
            {(largueurs ?? []).map(l => (
              <option key={l.parachutiste_id} value={l.parachutiste_id}>{l.prenom} {l.nom}</option>
            ))}
          </select>
          {(largueurs ?? []).length === 0 && (
            <span style={{ color: 'var(--sev-vigilance)' }}>
              aucun largueur qualifié dans ce centre
            </span>
          )}
        </label>
      )}

      {/* ── Qui est à bord ───────────────────────────────────────────────── */}
      {places.length === 0 ? (
        <p className="mt-3 py-4 text-center rounded-xl"
          style={{ fontSize: 13, color: 'var(--c-muted)',
                   border: '1px dashed var(--n3-filet)' }}>
          {accepteDepot ? 'Personne à bord — glissez quelqu’un depuis la file.' : 'Personne à bord.'}
        </p>
      ) : (
        <ul className="mt-3">
          {places.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 py-1.5"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--n3-filet)' }}>
              <span className="font-bold flex-shrink-0"
                style={{ fontSize: 13, color: 'var(--c-muted)', minWidth: 20 }}>
                {p.rang_sortie ?? '·'}
              </span>
              {p.parachutiste_id && onOuvrirFiche ? (
                <button type="button" onClick={() => onOuvrirFiche(p.parachutiste_id!)}
                  className="flex-1 min-w-0 truncate text-left hover:underline"
                  style={{ fontSize: 13, color: 'var(--c-text)', minHeight: 32 }}>
                  {p.nom}
                  <span style={{ color: 'var(--c-muted)' }}>
                    {' · '}{LIBELLE_TYPE[p.type_saut as TypeSautFile] ?? p.type_saut}
                  </span>
                </button>
              ) : (
                <span className="flex-1 min-w-0 truncate" style={{ fontSize: 13, color: 'var(--c-text)' }}>
                  {p.nom}
                  <span style={{ color: 'var(--c-muted)' }}>
                    {' · '}{LIBELLE_TYPE[p.type_saut as TypeSautFile] ?? p.type_saut}
                  </span>
                </span>
              )}
              {/* Le sigle ne va QU'AU LARGUEUR DÉSIGNÉ. La qualification dit
                  ce qu'on peut faire ; s'il y a trois largueurs sur la DZ, il
                  n'y en a qu'UN par avion — et c'est la DZ qui le nomme. */}
              {p.parachutiste_id && p.parachutiste_id === r.largueur_id && (
                <SiglesFonctions codes={['largueur']} compact />
              )}
              {/* TOUJOURS un badge, pour les quatre états. Ne rien afficher
                  quand on ne sait pas laissait croire que tout allait bien —
                  c'est le contraire du principe de sûreté. */}
              <button type="button" title="Ouvrir la fiche"
                onClick={() => p.parachutiste_id && onOuvrirFiche?.(p.parachutiste_id)}
                className="flex-shrink-0 whitespace-nowrap"
                style={{ ...pastille(SEV_APTITUDE[p.aptitude]), cursor: 'pointer', minHeight: 28 }}>
                {LIBELLE_APTITUDE[p.aptitude]}
              </button>
              {!close && (
                <button type="button" disabled={occupe}
                  title="Retirer et remettre en file"
                  onClick={() => agir('Retrait de la rotation', () =>
                    supabase.rpc('retirer_de_rotation', { p_place_id: p.id, p_remettre_en_file: true })
                      .then(x => ({ error: x.error })))}
                  className="flex-shrink-0 disabled:opacity-50"
                  style={{ ...action('texte'), minHeight: 32 }}>
                  <UserMinus className="w-3.5 h-3.5" aria-hidden />
                  <span className="sr-only">Retirer {p.nom}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Les gestes de la planche, dans leur ordre réel ────────────────── */}
      {!close && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {places.length > 1 && (
            <button type="button" disabled={occupe} style={action('secondaire')}
              onClick={() => agir('Ordre de sortie', () =>
                supabase.rpc('calculer_ordre_sortie', { p_rotation_id: r.id })
                  .then(x => ({ error: x.error })))}>
              <ArrowDownUp className="w-4 h-4" aria-hidden /> Ordre de sortie
            </button>
          )}
          {!r.heure_decollage && places.length > 0 && (
            // UN SEUL bouton plein par bloc (règle 6) : c'est celui-ci tant que
            // l'avion n'est pas parti, la clôture ensuite.
            // Sans largueur désigné, la base refuse — on grise le bouton ET on
            // dit pourquoi, plutôt que de laisser cliquer pour rien.
            <button type="button" disabled={occupe || !r.largueur_id}
              title={r.largueur_id ? undefined : 'Désignez le largueur avant le décollage'}
              style={{ ...action('principal'), opacity: r.largueur_id ? 1 : 0.5 }}
              onClick={() => agir('Décollage', () => supabase.from('rotations')
                .update({ heure_decollage: new Date().toISOString(), statut: 'en_vol' })
                .eq('id', r.id).then(x => ({ error: x.error })))}>
              <PlaneTakeoff className="w-4 h-4" aria-hidden /> Décollage
            </button>
          )}
          {!r.heure_decollage && places.length > 0 && !r.largueur_id && (
            <p className="w-full" style={{ fontSize: 13, color: SEVERITE_COULEUR.vigilance }}>
              Désignez le largueur : un avion ne décolle pas sans lui.
            </p>
          )}
          {r.heure_decollage && !r.heure_largage && (
            <button type="button" disabled={occupe} style={action('principal')}
              onClick={() => agir('Largage', () => supabase.from('rotations')
                .update({ heure_largage: new Date().toISOString() })
                .eq('id', r.id).then(x => ({ error: x.error })))}>
              <Plane className="w-4 h-4" aria-hidden /> Largage
            </button>
          )}
          {r.heure_largage && (
            <button type="button" disabled={occupe} style={action('principal')}
              onClick={() => agir('Clôture', () =>
                supabase.rpc('cloturer_rotation', { p_rotation_id: r.id })
                  .then(x => ({ error: x.error })))}>
              <Lock className="w-4 h-4" aria-hidden /> Clôturer et créer les sauts
            </button>
          )}
        </div>
      )}

      {echec && (
        <p role="alert" className="mt-2.5 px-3 py-2 rounded-xl" style={{
          fontSize: 13, borderLeft: `5px solid ${SEVERITE_COULEUR.critique}`, color: 'var(--c-text2)',
          background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>
          {echec}
        </p>
      )}
    </article>
  );
}

/**
 * UNE horloge pour tout l'écran. Trente planches avec leur propre minuteur se
 * décaleraient entre elles — deux cartes annonçant « call 12 » et « call 11 »
 * pour le même instant. La minute est la granularité utile : rafraîchir plus
 * vite ne changerait rien à l'affichage et réveillerait le téléphone pour rien.
 */
export function useHorlogeMinute(): Date {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/** En-tête de la colonne des planches. */
export function EnTetePlanches({ nb, enVol }: { nb: number; enVol: number }) {
  return (
    <p className="flex items-center gap-1.5" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
      <Users className="w-4 h-4" aria-hidden />
      {nb === 0 ? 'Aucune planche aujourd’hui.'
        : `${nb} planche${nb > 1 ? 's' : ''}${enVol > 0 ? ` · ${enVol} en vol` : ''}`}
    </p>
  );
}
