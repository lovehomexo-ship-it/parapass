import { useState, useEffect } from 'react';
import { MIME_FILE } from './FileAvionnageDZ';
import { SiglesFonctions } from '../../components/SigleFonction';
import { supabase } from '../../lib/supabase';
import { Plane, Clock, Users, ArrowDownUp, Lock, UserMinus, PlaneTakeoff, AlertTriangle, CheckCircle2, Fuel, Radio, ChevronDown, Package, Video, Scale, Unlock, GripVertical, Trash2 } from 'lucide-react';
import { surface, rayure, pastille, action, SEVERITE_COULEUR, type Severite } from '../../lib/jetons';
import {
  formaterRetard,
  calculerCall, SEVERITE_CALL, siegesOccupes, libelleCapacite, messageErreur,
  libelleDiscipline, teinteDiscipline, radioAttendue, type Discipline,
  libelleDT48, type VerdictDT48, SOURCE_DT48, type AnomaliePlanche,
  verifierPlanche, blocsDePlanche, masseEmbarquee, libelleMasse,
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

/** Réordonnancement INTERNE à la planche. Distinct du dépôt depuis la file :
 *  confondre les deux ferait sortir quelqu'un de l'avion en voulant le monter
 *  d'un rang. */
export const MIME_SORTIE = 'application/x-parapass-sortie';

export interface PlaceVue {
  id: string; rotation_id: string; parachutiste_id: string | null;
  moniteur_id: string | null; type_saut: string; rang_sortie: number | null;
  statut: string; nom: string;
  /** Les gens d'un même groupe SORTENT ENSEMBLE. null = seul. */
  groupe_id: string | null;
  /** Masse retenue pour CETTE place : celle de la place si elle en porte une,
   *  sinon celle du profil. null = inconnue — jamais zéro. */
  masse_kg: number | null;
  /** Altitude de largage de CE sauteur. null = celle de l'avion, pas zéro. */
  altitude_largage_m: number | null;
  /** Emporte une radio. Fait constaté par la DZ, pas une règle. */
  radio: boolean;
  /** La voile de CE saut, en ft², déclarée à l'avionnage. */
  surface_voile_ft2: number | null;
  /** Brevet principal (A, B, C, D) — ce que PAPA met entre parenthèses. */
  brevet: string | null;
  /** Qualifications valides : largueur, moniteur… Affichées telles quelles. */
  qualifications: string[];
  /** Brevet de moniteur (BEES, BPJEPS). Dit qui encadre. */
  brevet_moniteur: string | null;
  /** Ce qui n'est pas conforme, en clair, avec le code de la règle. null quand
   *  tout va bien. « À examiner » sans motif oblige à ouvrir chaque fiche. */
  motifs: string | null;
  /** Le moniteur qui accompagne cette personne, quand il y en a un. */
  moniteur_nom: string | null;
  /** Passager de tandem non licencié : un nom, une masse, pas de verdict. */
  passager_nom: string | null;
  /** L'option vidéo a été vendue sur ce saut. */
  video_option: boolean;
  /** Le parachute porté, tel qu'il est DÉCLARÉ : « perso · Sabre 2 170 » ou
   *  « location DZ · Navigator 260 ». null = rien de déclaré, et on le dit. */
  equipement: string | null;
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
  /** Le chef avion — responsable du stick à bord. DISTINCT du largueur. */
  chef_avion_id: string | null;
  /** Carburant embarqué, en litres. null = non renseigné, jamais zéro. */
  carburant_litres: number | null;
  /** Embarquement validé : la composition ne bouge plus. */
  embarquement_valide_le: string | null;
  /** Planche de démonstration. Se dit à l'écran : une salle de présentation ne
   *  doit pas confondre une planche de démo avec la journée réelle. */
  demo?: boolean;
}
export interface AeronefVue {
  id: string; immatriculation: string; places: number;
  /** Masse maximale au décollage. null = inconnue, donc aucun plafond affiché. */
  masse_max_kg?: number | null;
}

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

export function PlancheAvionnage({ rotation: r, places, aeronef, maintenant, onChange, onDeposer, onOuvrirFiche, largueurs, onDesignerLargueur, onGrouper, onDegrouper, onDefinirMasse, onDefinirAltitude, onDefinirCarburant, onDefinirAltitudeAvion, flotte, onDefinirAeronef, onSupprimerPlanche, reglesLevables, onAcquitter, onReordonner, onBasculerRadio, onAjouterPassager, onBasculerVideo, onChangerDiscipline, disciplines, dt48, onValiderEmbarquement, onAmenagementDT48, onDefinirSurfaceVoile }: {
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
  /** Réunit des places en un groupe — elles sortiront ensemble. */
  onGrouper?: (placeIds: string[]) => Promise<string | null>;
  /** Défait un groupe. Ne retire personne de l'avion : c'est le lien qu'on
   *  coupe, pas les gens. */
  onDegrouper?: (groupeId: string) => Promise<string | null>;
  /** Le DT demande la masse à voix haute et la saisit. null = effacer. */
  onDefinirMasse?: (place: PlaceVue, kg: number | null) => Promise<string | null>;
  /** Altitude propre à un sauteur. null = il reprend celle de l'avion. */
  onDefinirAltitude?: (placeId: string, metres: number | null) => Promise<string | null>;
  /** Carburant embarqué, en litres. */
  onDefinirCarburant?: (litres: number | null) => Promise<string | null>;
  /** L'altitude de largage de l'avion — le défaut de tout le monde à bord. */
  onDefinirAltitudeAvion?: (metres: number | null) => Promise<string | null>;
  /** La flotte du centre, pour pouvoir corriger l'avion d'une planche. */
  flotte?: readonly { id: string; immatriculation: string; places: number }[];
  onDefinirAeronef?: (aeronefId: string) => Promise<string | null>;
  /** Supprimer la planche — refusée par la base dès qu'elle a volé. */
  onSupprimerPlanche?: () => Promise<string | null>;
  /** Les règles que le référentiel déclare levables, par code. */
  reglesLevables?: ReadonlyMap<string, { duree: string | null; effet: string | null; libelle: string }>;
  onAcquitter?: (parachutisteId: string, code: string) => Promise<string | null>;
  /**
   * Le nouvel ordre de sortie, une entrée par SORTIE (un groupe ou une
   * personne seule), chacune portant les identifiants de ses places.
   */
  onReordonner?: (sorties: string[][]) => Promise<string | null>;
  /** Figer ou rouvrir l'embarquement. Rouvrir n'est possible qu'avant départ. */
  onValiderEmbarquement?: (valide: boolean) => Promise<string | null>;
  /** La radio se constate d'un clic : elle est sur la personne, ou elle ne l'est pas. */
  onBasculerRadio?: (placeId: string, radio: boolean) => Promise<string | null>;
  /** Le passager d'un tandem : un nom, une masse. Il n'a pas de compte. */
  onAjouterPassager?: (placeMoniteur: PlaceVue, nom: string, kg: number | null) => Promise<string | null>;
  /** L'option vidéo se vend ou s'annule d'un clic. */
  onBasculerVideo?: (placeId: string, vendue: boolean) => Promise<string | null>;
  /** Ce que fait la personne se change jusqu'à la dernière minute. */
  onChangerDiscipline?: (placeId: string, code: string) => Promise<string | null>;
  /** Accorder ou retirer l'aménagement DT 48 de −11 %. */
  onAmenagementDT48?: (parachutisteId: string, accorde: boolean) => Promise<string | null>;
  /** La voile de ce saut. Le DT la saisit quand le sauteur ne l'a pas fait. */
  onDefinirSurfaceVoile?: (placeId: string, ft2: number | null) => Promise<string | null>;
  /** Le référentiel du centre. Vide = on retombe sur les libellés connus. */
  disciplines?: Discipline[];
  /** Verdict DT 48 par parachutiste. Absent = non calculé, et on le dit. */
  dt48?: Map<string, VerdictDT48>;
}) {
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  /** Sélection courante pour former un groupe. Vidée après chaque action. */
  const [selection, setSelection] = useState<Set<string>>(new Set());
  /** Volets de détail ouverts. Fermés par défaut : la ligne doit tenir en une
   *  phrase lisible, le reste se demande. */
  const [detailsOuverts, setDetailsOuverts] = useState<Set<string>>(new Set());
  /** Sortie en cours de déplacement, et celle survolée. */
  const [deplace, setDeplace] = useState<string | null>(null);
  const [cible, setCible] = useState<string | null>(null);
  const basculerDetails = (id: string) => setDetailsOuverts(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const basculer = (id: string) => setSelection(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const call = calculerCall(r.date_jour, r.heure_prevue, r.heure_decollage, maintenant);
  const sieges = siegesOccupes(places);
  // Une planche FIGÉE se lit comme une planche close pour tout ce qui se
  // saisit : discipline, masse, radio, retrait. Elle garde en revanche ses
  // boutons de fin de cycle — rouvrir, décoller.
  const figee = r.embarquement_valide_le !== null;
  /** Fin de vie de la planche : elle ne se rouvre plus du tout. */
  const cloturee = r.statut === 'terminee' || r.cloturee_le !== null;
  /** Plus rien ne se SAISIT. Une planche figée l'est aussi — mais elle garde
   *  ses boutons de fin de cycle, d'où deux notions et non une. */
  const close = cloturee || figee;
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

  // « Vérification du stick » — repris des manifests professionnels. Le Feu
  // Vert dit si une PERSONNE peut sauter ; ceci dit si cet AVION est prêt.
  // Deux questions différentes : un avion sans largueur n'a aucun feu rouge à
  // bord et ne part pas.
  const masse = masseEmbarquee(places.map(p => p.masse_kg));

  const etat = verifierPlanche({
    largueurId: r.largueur_id,
    chefAvionId: r.chef_avion_id,
    largueurABord: places.some(p => p.parachutiste_id === r.largueur_id),
    heurePrevue: r.heure_prevue,
    heureDecollage: r.heure_decollage,
    cloturee: r.cloturee_le !== null || r.statut === 'annulee',
    aeronefPlaces: aeronef?.places ?? null,
    places: places.map(p => ({
      rangSortie: p.rang_sortie, aptitude: p.aptitude, typeSaut: p.type_saut,
      passager: p.passager_nom !== null,
      // Le moniteur « a son passager » si quelqu'un partage son groupe.
      aSonPassager: p.passager_nom === null && p.groupe_id !== null
        && places.some(q => q.passager_nom !== null && q.groupe_id === p.groupe_id),
      masseKg: p.masse_kg,
      videoVendue: p.video_option,
      // Quelqu'un filme ce groupe : une place « vidéo » y est présente. Le
      // drapeau dit que c'est vendu, le groupe dit QUI filme.
      aSonVideaste: p.groupe_id !== null
        && places.some(q => q.type_saut === 'video' && q.groupe_id === p.groupe_id),
      sousMinimumDT48: libelleDT48(dt48?.get(p.parachutiste_id ?? ''))?.bloque ?? false,
      // Une PAC est accompagnée : soit un moniteur nommé, soit quelqu'un du
      // même groupe. Sans ni l'un ni l'autre, personne ne sait qui saute avec.
      groupeId: p.groupe_id,
      pacSansMoniteur: radioAttendue(p.type_saut, disciplines) && !p.moniteur_nom
        && !(p.groupe_id !== null && places.some(q => q.id !== p.id
             && q.groupe_id === p.groupe_id && q.parachutiste_id !== null)),
    })),
    largueursDisponibles: (largueurs ?? []).length,
    siegesOccupes: sieges,
  });

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
            {r.demo && (
              <span className="align-middle ml-2 px-1.5 py-0.5 rounded"
                style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                         color: 'var(--c-dim)', border: '1px dashed var(--c-border-f)' }}>
                DÉMO
              </span>
            )}
          </p>
          <p className="mt-1 font-extrabold leading-none"
            style={{ fontSize: 17, color: close ? 'var(--c-muted)' : SEVERITE_COULEUR[sev] }}>
            {r.cloturee_le !== null || r.statut === 'terminee' ? 'clôturé'
             : figee ? 'embarquement validé' : formaterRetard(call.libelle)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 flex-wrap" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            {/* QUEL AVION PORTE CETTE PLANCHE. C'etait un simple texte, et la
                planche etait ouverte en silence sur le premier appareil du
                parc : avec trois avions, on decouvrait l'erreur au nombre de
                places. Il se corrige tant que l'avion n'est pas parti. */}
            {!close && onDefinirAeronef && (flotte?.length ?? 0) > 1 ? (
              <label title="Aéronef de cette planche">
                <span className="sr-only">Aéronef de la planche n°{r.numero}</span>
                <select value={aeronef?.id ?? ''} disabled={occupe}
                  onChange={e => {
                    const v = e.target.value;
                    if (!v || v === aeronef?.id) return;
                    agir('Changement d’aéronef', () =>
                      onDefinirAeronef(v).then(err => ({ error: err ? { message: err } : null })));
                  }}
                  className="rounded-lg px-1.5"
                  style={{ fontSize: 13, fontWeight: 700, minHeight: 28,
                           background: 'var(--c-input, var(--c-bg))', color: 'var(--c-text)',
                           border: '1px solid var(--n2-bord)' }}>
                  {!aeronef && <option value="">aéronef non affecté</option>}
                  {(flotte ?? []).map(f => (
                    <option key={f.id} value={f.id}>{f.immatriculation} · {f.places} pl.</option>
                  ))}
                </select>
              </label>
            ) : (
              <span style={{ fontWeight: 700, color: 'var(--c-text2)' }}>
                {aeronef?.immatriculation ?? 'aéronef non affecté'}
              </span>
            )}
            {/* L'ALTITUDE DE L'AVION, modifiable. Elle est le défaut de tout le
                monde à bord : une place sans altitude propre lit celle-ci, donc
                la changer ici change tout l'avion sans rien recopier. */}
            {!close && onDefinirAltitudeAvion ? (
              <label className="flex items-center gap-1"
                title="Altitude de largage de l’avion — chacun la suit, sauf altitude propre">
                ·
                <span className="sr-only">Altitude de largage de l’avion n°{r.numero}, en mètres</span>
                <input type="number" inputMode="numeric" min={300} max={8000} step={100}
                  defaultValue={r.altitude_largage_m ?? ''} disabled={occupe}
                  placeholder="— m"
                  onBlur={e => {
                    const v = e.target.value.trim();
                    const m = v === '' ? null : Number(v);
                    if (m === (r.altitude_largage_m ?? null)) return;
                    agir('Altitude de l’avion', () =>
                      onDefinirAltitudeAvion(m).then(err => ({ error: err ? { message: err } : null })));
                  }}
                  className="px-1.5 rounded-lg text-right"
                  style={{ width: 74, minHeight: 30, fontSize: 13, background: 'var(--c-input)',
                           color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                m
              </label>
            ) : (
              r.altitude_largage_m ? <span>· {r.altitude_largage_m} m</span> : null
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {/* CE QUE LA PASTILLE COMPTE. « 9/10 » ne veut rien dire tant qu'on
              ignore si le pilote est dans le 10 : selon la reponse on embarque
              un sauteur de trop, ou on laisse un siege vide toute la journee.
              Ce sont les SIEGES PARACHUTISTES — largueur et passager tandem
              compris —, equipage exclu. Le nombre se regle sur la flotte. */}
          <span title={aeronef
              ? `${sieges} personne${sieges > 1 ? 's' : ''} à bord sur ${aeronef.places} siège${aeronef.places > 1 ? 's' : ''} parachutiste${aeronef.places > 1 ? 's' : ''} — largueur et passager tandem compris, pilote non compris. Modifiable dans la flotte, en haut de l’écran.`
              : 'Aucun aéronef n’est rattaché à cette planche : ParaPass ne connaît donc aucune capacité.'}
            style={pastille(sieges >= (aeronef?.places ?? Infinity) ? 'critique' : 'neutre')}>
            {libelleCapacite(sieges, aeronef?.places ?? null)}
          </span>
          {/* Un avion se remplit par la MASSE avant les sièges. Le libellé dit
              ce qu'il ignore : un total sur six masses connues et quatre
              inconnues n'est pas la masse de l'avion, c'est un minimum. */}
          {libelleMasse(masse, aeronef?.masse_max_kg ?? null) && (
            <span style={pastille(
              aeronef?.masse_max_kg && masse.total > aeronef.masse_max_kg ? 'critique'
                : masse.complet ? 'conforme' : 'neutre')}>
              {libelleMasse(masse, aeronef?.masse_max_kg ?? null)}
            </span>
          )}
        </div>
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
        {/* Le carburant se lit dans l'entête, comme sur un manifest : c'est une
            donnée de l'avion, au même titre que son immatriculation. Vide =
            non renseigné, affiché tel quel — « 0 L » serait un chiffre faux. */}
        {!close && onDefinirCarburant && (
          <label className="flex items-center gap-1">
            <Fuel className="w-3.5 h-3.5" aria-hidden />
            <span className="sr-only">Carburant embarqué, en litres — avion n°{r.numero}</span>
            <input type="number" inputMode="numeric" min={0} max={5000} step={10}
              defaultValue={r.carburant_litres ?? ''}
              disabled={occupe}
              placeholder="— L"
              onBlur={e => {
                const v = e.target.value.trim();
                const l = v === '' ? null : Number(v);
                if (l === (r.carburant_litres ?? null)) return;
                agir('Carburant', () =>
                  onDefinirCarburant(l).then(err => ({ error: err ? { message: err } : null })));
              }}
              className="px-1.5 rounded-lg text-right"
              style={{ width: 70, minHeight: 32, fontSize: 12, background: 'var(--c-input)',
                       color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
            L
          </label>
        )}
        {close && r.carburant_litres !== null && <span>{r.carburant_litres} L</span>}
        {r.heure_decollage && <span>décollage {hhmm(r.heure_decollage)}</span>}
        {r.heure_largage && <span>largage {hhmm(r.heure_largage)}</span>}
        {r.cloturee_le && <span>clôturée {hhmm(r.cloturee_le)}</span>}
      </div>

      {/* ── VÉRIFICATION DE LA PLANCHE ────────────────────────────────────
          Ce qui empêche CET AVION de partir, en un bloc. Il se lit avant les
          noms : savoir qu'il manque le largueur importe plus que savoir qui
          est en n°3. Muet quand tout va bien — un panneau qui parle tout le
          temps ne se lit plus. */}
      {!close && etat.anomalies.length > 0 && (
        <div className="mt-2.5 px-3 py-2 rounded-xl"
          style={{ ...rayure(etat.verdict === 'rouge' ? 'critique' : 'vigilance'),
                   background: `color-mix(in srgb, ${SEVERITE_COULEUR[etat.verdict === 'rouge' ? 'critique' : 'vigilance']} 9%, transparent)` }}>
          <p className="flex items-center gap-1.5"
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                     textTransform: 'uppercase',
                     color: SEVERITE_COULEUR[etat.verdict === 'rouge' ? 'critique' : 'vigilance'] }}>
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
            {etat.verdict === 'rouge' ? 'Cet avion ne peut pas partir' : 'À vérifier avant le départ'}
          </p>
          <ul className="mt-1">
            {etat.anomalies.map((an: AnomaliePlanche) => (
              <li key={an.code} className="flex items-start gap-1.5"
                style={{ fontSize: 12.5, color: 'var(--c-text2)' }}>
                {/* La gravité se lit à la FORME, pas à la seule couleur. */}
                <span aria-hidden style={{ fontWeight: 900, lineHeight: '1.45',
                  color: SEVERITE_COULEUR[an.gravite === 'bloquant' ? 'critique' : 'vigilance'] }}>
                  {an.gravite === 'bloquant' ? '■' : '▲'}
                </span>
                <span>{an.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!close && etat.anomalies.length === 0 && places.length > 0 && (
        <p className="mt-2.5 flex items-center gap-1.5"
          style={{ fontSize: 12.5, fontWeight: 700, color: SEVERITE_COULEUR.conforme }}>
          <CheckCircle2 className="w-4 h-4" aria-hidden /> Planche complète — rien à signaler.
        </p>
      )}

      {/* LE LARGUEUR DE CET AVION. Un seul. La liste ne propose que des
          qualifiés valides — et la base refuse les autres, au cas où. */}
      {/* EMBARQUER LE LARGUEUR. Ce sélecteur ne « désigne » plus dans le vide :
          il met le largueur DANS L'AVION, à sa place dans la liste. Il y pèse,
          il y porte son feu — la version précédente en faisait le seul homme
          de l'avion dont on ne voyait ni la masse ni le verdict.
          Une fois à bord, il se désigne depuis sa ligne comme tout le monde. */}
      {!close && onDesignerLargueur && !places.some(p => p.parachutiste_id === r.largueur_id) && (
        <label className="mt-2 flex items-center gap-2 flex-wrap" style={{ fontSize: 12 }}>
          <span style={{ color: SEVERITE_COULEUR.vigilance, fontWeight: 700 }}>
            Largueur — à embarquer
          </span>
          <select value="" disabled={occupe}
            onChange={e => { if (e.target.value) onDesignerLargueur(e.target.value); }}
            className="px-2 rounded-lg"
            style={{ minHeight: 34, fontSize: 12, background: 'var(--c-input)',
                     color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }}>
            <option value="">— choisir —</option>
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
        <div className="mt-3">
          {blocsDePlanche(places).map((bloc, ib) => {
          const cle = bloc.groupeId ?? bloc.places[0].id;
          const reordonnable = !close && !!onReordonner
            && bloc.places.every(p => p.type_saut !== 'largueur');
          return (
          <div key={cle}
            draggable={reordonnable && selection.size === 0}
            onDragStart={e => {
              e.dataTransfer.setData(MIME_SORTIE, cle);
              e.dataTransfer.effectAllowed = 'move';
              setDeplace(cle);
            }}
            onDragEnd={() => { setDeplace(null); setCible(null); }}
            onDragOver={e => {
              if (!reordonnable || !e.dataTransfer.types.includes(MIME_SORTIE)) return;
              e.preventDefault(); e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              if (cible !== cle) setCible(cle);
            }}
            onDragLeave={() => { if (cible === cle) setCible(null); }}
            onDrop={e => {
              if (!e.dataTransfer.types.includes(MIME_SORTIE)) return;
              e.preventDefault(); e.stopPropagation();
              const source = e.dataTransfer.getData(MIME_SORTIE);
              setDeplace(null); setCible(null);
              if (!source || source === cle || !onReordonner) return;
              // On reconstruit l'ordre des SORTIES, pas des personnes : une
              // sortie se déplace d'un bloc, avec tous ses membres.
              const blocs = blocsDePlanche(places)
                .filter(b => b.places.every(p => p.type_saut !== 'largueur'));
              const cles = blocs.map(b => b.groupeId ?? b.places[0].id);
              const depuis = cles.indexOf(source);
              const vers = cles.indexOf(cle);
              if (depuis < 0 || vers < 0) return;
              cles.splice(vers, 0, ...cles.splice(depuis, 1));
              agir('Ordre de sortie', () =>
                onReordonner(cles.map(k =>
                  (blocs.find(b => (b.groupeId ?? b.places[0].id) === k)?.places ?? []).map(p => p.id)))
                  .then(err => ({ error: err ? { message: err } : null })));
            }}
            className={bloc.groupeId ? 'rounded-xl px-2 py-1 mb-1.5' : ''}
            style={bloc.groupeId ? {
              // Un groupe se voit comme un BLOC : fond propre et rayure, pour
              // qu'on lise « ces trois-là sortent ensemble » sans compter.
              ...rayure('neutre'),
              background: 'color-mix(in srgb, var(--c-text) 4%, transparent)',
            } : { borderTop: ib === 0 ? 'none' : '1px solid var(--n3-filet)' }}
            data-deplace={deplace === cle || undefined}>
            {/* Le repère de dépôt se lit à la FORME, pas à une couleur d'état :
                un trait épais au-dessus de la sortie visée. */}
            {cible === cle && deplace !== null && deplace !== cle && (
              <div aria-hidden style={{ height: 3, borderRadius: 2,
                background: 'var(--action-texte)', margin: '2px 0 4px' }} />
            )}
            {bloc.libelle && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                               textTransform: 'uppercase', color: 'var(--c-muted)' }}>
                  {bloc.libelle} · {bloc.places.length} sauteurs
                </span>
                {!close && onDegrouper && (
                  <button type="button" disabled={occupe}
                    onClick={() => agir('Dégroupage', () =>
                      onDegrouper(bloc.groupeId!).then(e => ({ error: e ? { message: e } : null })))}
                    style={{ ...action('texte'), minHeight: 28, fontSize: 11 }}>
                    Dégrouper
                  </button>
                )}
              </div>
            )}
          <ul>
          {bloc.places.map((p, i) => {
            const ouvert = detailsOuverts.has(p.id);
            const aDire = p.aptitude !== 'vert' && p.motifs;
            return (
            <li key={p.id} className="py-1.5"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--n3-filet)' }}>

              {/* ── LIGNE 1 : le NOM, et rien qui puisse l'écraser ──────────
                  La version précédente mettait tout sur une seule ligne :
                  discipline, sigles, radio, masse, altitude, verdict. Le nom,
                  seul élément élastique, se faisait broyer — « T. » pour
                  Thomas LAURENT. Le détail est donc passé sous un volet. */}
              <div className="flex items-center gap-2">
                {!close && onGrouper && (
                  <input type="checkbox" checked={selection.has(p.id)}
                    onChange={() => basculer(p.id)}
                    aria-label={`Sélectionner ${p.nom} pour former un groupe`}
                    style={{ width: 16, height: 16, flexShrink: 0 }} />
                )}
                {/* La poignée dit que ça se déplace. Sans elle, personne ne
                    devine qu'on peut glisser — et le bouton « Ordre de sortie »
                    recalculait sans rien changer de visible. */}
                {!close && onReordonner && p.type_saut !== 'largueur' && i === 0 && (
                  <GripVertical className="w-4 h-4 flex-shrink-0" aria-hidden
                    style={{ color: 'var(--c-dim)', cursor: 'grab' }} />
                )}
                <span className="font-bold flex-shrink-0"
                  style={{ fontSize: 13, color: 'var(--c-muted)', minWidth: 18 }}>
                  {p.type_saut === 'largueur' ? '·' : (p.rang_sortie ?? '·')}
                </span>

                <button type="button" disabled={!p.parachutiste_id}
                  onClick={() => p.parachutiste_id && onOuvrirFiche?.(p.parachutiste_id)}
                  className={`flex-1 min-w-0 text-left ${p.parachutiste_id ? 'hover:underline' : ''}`}
                  style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', minHeight: 32 }}>
                  <span className="truncate block">
                    {p.passager_nom && (
                      <span style={{ color: 'var(--c-muted)', fontWeight: 400 }}>passager · </span>
                    )}
                    {p.nom}
                    {(p.brevet || p.brevet_moniteur) && (
                      <span style={{ color: 'var(--c-muted)', fontWeight: 400 }}>
                        {' ('}{[p.brevet, p.brevet_moniteur].filter(Boolean).join(' · ')}{')'}
                      </span>
                    )}
                  </span>
                </button>

                {/* CE QUE FAIT LA PERSONNE, et ça se change. Un sauteur decide
                    au pied de l'avion qu'il part en VR plutot qu'en solo ; un
                    videaste renonce a filmer. La planche doit suivre, sinon
                    elle ment dans les cinq minutes. Le contenu vient du
                    REFERENTIEL du centre, pas d'une liste ecrite ici. */}
                {!close && onChangerDiscipline && !p.passager_nom ? (
                  <select value={p.type_saut} disabled={occupe}
                    onChange={e => agir('Changement de discipline', () =>
                      onChangerDiscipline(p.id, e.target.value)
                        .then(err => ({ error: err ? { message: err } : null })))}
                    aria-label={`Ce que fait ${p.nom}`}
                    className="flex-shrink-0 px-1.5 rounded"
                    style={{ fontSize: 11, fontWeight: 700, minHeight: 28,

                             // LA COULEUR DE DISCIPLINE EST CHOISIE POUR UN FOND SOMBRE.
                             // Posée telle quelle en mode jour, « Tandem » tombait à 1,68:1 —
                             // illisible. Mélangée à la couleur de texte du thème, elle garde
                             // sa valeur de repérage et redevient lisible des deux côtés.
                             color: `color-mix(in srgb, ${teinteDiscipline(p.type_saut, disciplines)} 55%, var(--c-text))`,
                             background: `color-mix(in srgb, ${teinteDiscipline(p.type_saut, disciplines)} 12%, transparent)`,
                             border: `1px solid ${teinteDiscipline(p.type_saut, disciplines)}` }}>
                    {(disciplines ?? []).map(d => (
                      <option key={d.code} value={d.code}>{d.libelle}</option>
                    ))}
                    {/* La discipline actuelle reste proposée même si le centre
                        l'a retirée du catalogue : on n'efface pas un fait. */}
                    {!(disciplines ?? []).some(d => d.code === p.type_saut) && (
                      <option value={p.type_saut}>{libelleDiscipline(p.type_saut, disciplines)}</option>
                    )}
                  </select>
                ) : (
                  <span className="flex-shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded"
                    style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em',
                             color: `color-mix(in srgb, ${teinteDiscipline(p.type_saut, disciplines)} 55%, var(--c-text))`,
                             border: `1px solid ${teinteDiscipline(p.type_saut, disciplines)}`,
                             background: `color-mix(in srgb, ${teinteDiscipline(p.type_saut, disciplines)} 12%, transparent)` }}>
                    {libelleDiscipline(p.type_saut, disciplines)}
                  </span>
                )}

                {/* LA RADIO SE VOIT SANS OUVRIR. Plein = elle est la ; tirete
                    ambre avec un « ! » = la personne est en progression et ne
                    l'a pas. Le clic la bascule. */}
                {onBasculerRadio && (
                  <button type="button" disabled={occupe || close}
                    onClick={() => agir('Radio', () =>
                      onBasculerRadio(p.id, !p.radio).then(e => ({ error: e ? { message: e } : null })))}
                    title={p.radio ? `${p.nom} a une radio`
                      : radioAttendue(p.type_saut, disciplines) ? `${p.nom} est en PAC et n'a pas de radio`
                      : `Noter que ${p.nom} emporte une radio`}
                    className="flex-shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded"
                    style={{ fontSize: 10.5, fontWeight: 800, cursor: close ? 'default' : 'pointer',
                      color: p.radio ? SEVERITE_COULEUR.conforme
                        : radioAttendue(p.type_saut, disciplines) ? SEVERITE_COULEUR.vigilance : 'var(--c-dim)',
                      border: `1px ${p.radio ? 'solid' : 'dashed'} ${p.radio ? SEVERITE_COULEUR.conforme
                        : radioAttendue(p.type_saut, disciplines) ? SEVERITE_COULEUR.vigilance : 'var(--n2-bord)'}` }}>
                    <Radio className="w-3 h-3 inline-block align-[-1px]" aria-hidden />
                    <span className="sr-only">
                      {p.radio ? 'Radio embarquée' : 'Pas de radio'} — {p.nom}
                    </span>
                    {radioAttendue(p.type_saut, disciplines) && !p.radio ? ' !' : ''}
                  </button>
                )}
                {/* L'OPTION VIDÉO. Plein = vendue et quelqu'un filme ; ambre
                    tireté = vendue et personne à bord pour la faire. Le nom du
                    porteur est dans l'infobulle : c'est lui qu'on cherche. */}
                {p.video_option && (() => {
                  const porteur = places.find(q => q.type_saut === 'video'
                    && q.groupe_id !== null && q.groupe_id === p.groupe_id);
                  return (
                    <span className="flex-shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded"
                      title={porteur ? `Vidéo — filmée par ${porteur.nom}`
                                     : 'Vidéo vendue — aucun porteur vidéo à bord'}
                      style={{ fontSize: 10.5, fontWeight: 800,
                        color: porteur ? teinteDiscipline('video', disciplines) : SEVERITE_COULEUR.vigilance,
                        border: `1px ${porteur ? 'solid' : 'dashed'} ${porteur ? teinteDiscipline('video', disciplines) : SEVERITE_COULEUR.vigilance}` }}>
                      <Video className="w-3 h-3 inline-block align-[-1px]" aria-hidden />
                      <span className="sr-only">
                        {porteur ? `Vidéo filmée par ${porteur.nom}` : 'Vidéo vendue, sans porteur vidéo'}
                      </span>
                      {porteur ? '' : ' !'}
                    </span>
                  );
                })()}
                {/* Le sigle ne double PLUS la puce : quand la discipline est
                    « largueur », la ligne le dit deja. Claire portait deux
                    fois la mention. */}
                {p.parachutiste_id === r.largueur_id && p.type_saut !== 'largueur' && (
                  <SiglesFonctions codes={['largueur']} compact />
                )}

                {/* UN PASSAGER N'A PAS DE VERDICT. Il n'a pas de licence : lui
                    coller « à vérifier » reprocherait à un civil de ne pas
                    avoir un document qu'on ne lui demande pas. */}
                {p.passager_nom ? (
                  <span className="flex-shrink-0 whitespace-nowrap"
                    style={{ ...pastille('neutre'), minHeight: 28 }}>
                    non licencié
                  </span>
                ) : (
                  <button type="button" title="Ouvrir la fiche"
                    onClick={() => p.parachutiste_id && onOuvrirFiche?.(p.parachutiste_id)}
                    className="flex-shrink-0 whitespace-nowrap"
                    style={{ ...pastille(SEV_APTITUDE[p.aptitude]), cursor: 'pointer', minHeight: 28 }}>
                    {LIBELLE_APTITUDE[p.aptitude]}
                  </button>
                )}

                {/* Le volet. Fermé, la ligne tient en une phrase lisible. */}
                <button type="button" onClick={() => basculerDetails(p.id)}
                  aria-expanded={ouvert}
                  title={ouvert ? 'Masquer le détail' : 'Matériel, masse, altitude, encadrement'}
                  className="flex-shrink-0"
                  style={{ ...action('texte'), minHeight: 30, padding: '0 6px' }}>
                  <ChevronDown className="w-4 h-4" aria-hidden
                    style={{ transform: ouvert ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                  <span className="sr-only">Détail de {p.nom}</span>
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
              </div>

              {/* ── LIGNE 2 : POURQUOI, quand ce n'est pas vert ─────────────
                  « À examiner » sans motif oblige à ouvrir la fiche de chacun.
                  Le motif porte son code : on peut remonter au texte. */}
              {/* CHAQUE MOTIF SUR SA LIGNE, ET ACQUITTABLE QUAND IL DOIT L'ÊTRE.
                  Un casque ou une vérification de voile ne se règlent pas par
                  une saisie : ils se CONSTATENT. Sans moyen de le dire, la
                  planche restait en alerte toute la journée — et une planche
                  qui alerte toujours n'alerte plus de rien.
                  La ligne acquittée ne disparaît pas : elle passe au gris avec
                  le nom de qui l'a constatée. Le rappel demeure, la trace
                  aussi. */}
              {aDire && (
                <div className="mt-0.5 ml-7 space-y-0.5">
                  {(p.motifs ?? '').split('\n').filter(Boolean).map(ligne => {
                    const code = ligne.slice(0, 7);
                    const acquitte = ligne.includes('acquitté par');
                    const levable = !acquitte && !!reglesLevables?.has(code) && !!onAcquitter
                                    && !!p.parachutiste_id && !close;
                    return (
                      <p key={ligne} className="flex items-start gap-1.5"
                        style={{ fontSize: 12,
                                 color: acquitte ? 'var(--c-muted)'
                                                 : SEVERITE_COULEUR[SEV_APTITUDE[p.aptitude]] }}>
                        {acquitte
                          ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden />
                          : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden />}
                        <span className="flex-1">{ligne}</span>
                        {levable && (
                          <button type="button" disabled={occupe}
                            title={reglesLevables?.get(code)?.effet ?? 'Constaté par l’encadrement'}
                            onClick={() => agir(`Acquittement ${code}`, () =>
                              onAcquitter!(p.parachutiste_id!, code)
                                .then(e => ({ error: e ? { message: e } : null })))}
                            className="flex-shrink-0 px-2 rounded-lg"
                            style={{ minHeight: 24, fontSize: 11, fontWeight: 700,
                                     color: SEVERITE_COULEUR.conforme,
                                     border: `1px solid ${SEVERITE_COULEUR.conforme}` }}>
                            Acquitter
                          </button>
                        )}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* L'encadrement se lit TOUJOURS : savoir qu'un élève est
                  accompagné, et par qui, ne se cache pas sous un volet. */}
              {p.moniteur_nom && !(p.groupe_id && places.some(q =>
                 q.parachutiste_id === p.moniteur_id && q.groupe_id === p.groupe_id)) && (
                <p className="mt-0.5 ml-7" style={{ fontSize: 12, color: 'var(--c-text2)' }}>
                  accompagné par <strong style={{ fontWeight: 600 }}>{p.moniteur_nom}</strong>
                </p>
              )}

              {/* ── LE VOLET : tout ce qui se saisit, rien qui encombre ───── */}
              {ouvert && (
                <div className="mt-1.5 ml-7 mb-1 px-2.5 py-2 rounded-xl flex items-center gap-3 flex-wrap"
                  style={{ background: 'var(--n3-fond)', border: '1px solid var(--n3-filet)' }}>
                  {p.qualifications.filter(q => !(q === 'largueur' && p.parachutiste_id === r.largueur_id)).length > 0 && (
                    <SiglesFonctions compact
                      codes={p.qualifications.filter(q => !(q === 'largueur' && p.parachutiste_id === r.largueur_id))} />
                  )}

                  {!close && onDefinirMasse && (
                    <label className="flex items-center gap-1" style={{ fontSize: 11, color: 'var(--c-muted)' }}>
                      <span className="sr-only">Masse de {p.nom}, en kilogrammes</span>
                      <input type="number" inputMode="decimal" min={20} max={250} step={0.5}
                        defaultValue={p.masse_kg ?? ''} disabled={occupe} placeholder="— kg"
                        onBlur={e => {
                          const v = e.target.value.trim();
                          const kg = v === '' ? null : Number(v.replace(',', '.'));
                          if (kg === (p.masse_kg ?? null)) return;
                          agir('Saisie de la masse', () =>
                            onDefinirMasse(p, kg).then(err => ({ error: err ? { message: err } : null })));
                        }}
                        className="px-1.5 rounded-lg text-right"
                        style={{ width: 62, minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                 color: 'var(--c-text)',
                                 border: `1px solid ${p.masse_kg == null ? SEVERITE_COULEUR.vigilance : 'var(--n2-bord)'}` }} />
                      kg
                    </label>
                  )}

                  {/* L'ALTITUDE DE L'AVION EST LE DÉFAUT, ET LE PLAFOND. Vide =
                      « celle de l'avion », affichée en gris : si le DT change
                      l'altitude de la planche, tout le monde suit sans qu'on
                      recopie rien. Une valeur propre ne sert qu'à sortir PLUS
                      BAS — la base refuse plus haut. */}
                  {!close && onDefinirAltitude && (
                    <label className="flex items-center gap-1" style={{ fontSize: 11, color: 'var(--c-muted)' }}
                      title={r.altitude_largage_m
                        ? `Vide = ${r.altitude_largage_m} m, l'altitude de l'avion. Une valeur propre ne peut être que plus basse.`
                        : 'Altitude de largage propre à cette personne'}>
                      <span className="sr-only">Altitude de largage de {p.nom}, en mètres</span>
                      <input type="number" inputMode="numeric" min={300} step={100}
                        defaultValue={p.altitude_largage_m ?? ''} disabled={occupe}
                        max={r.altitude_largage_m ?? 8000}
                        placeholder={r.altitude_largage_m ? String(r.altitude_largage_m) : '— m'}
                        onBlur={e => {
                          const v = e.target.value.trim();
                          const m = v === '' ? null : Number(v);
                          if (m === (p.altitude_largage_m ?? null)) return;
                          agir('Altitude du sauteur', () =>
                            onDefinirAltitude(p.id, m).then(err => ({ error: err ? { message: err } : null })));
                        }}
                        className="px-1.5 rounded-lg text-right"
                        style={{ width: 66, minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                 color: p.altitude_largage_m == null ? 'var(--c-muted)' : 'var(--c-text)',
                                 border: '1px solid var(--n2-bord)' }} />
                      m
                    </label>
                  )}

                  {!close && p.parachutiste_id && onDesignerLargueur
                    && p.parachutiste_id !== r.largueur_id
                    && (largueurs ?? []).some(l => l.parachutiste_id === p.parachutiste_id) && (
                    <button type="button" disabled={occupe}
                      onClick={() => onDesignerLargueur(p.parachutiste_id!)}
                      style={{ ...action('texte'), minHeight: 28, fontSize: 11 }}>
                      désigner largueur
                    </button>
                  )}

                  {/* La vidéo se vend au comptoir : l'écran ne fait que le
                      constater. Proposée sur les sauts qui l'admettent. */}
                  {!close && onBasculerVideo && !p.passager_nom
                    && ['tandem', 'accompagne', 'ecole', 'solo', 'groupe'].includes(p.type_saut) && (
                    <button type="button" disabled={occupe}
                      onClick={() => agir('Option vidéo', () =>
                        onBasculerVideo(p.id, !p.video_option).then(e => ({ error: e ? { message: e } : null })))}
                      className="whitespace-nowrap px-1.5 py-0.5 rounded"
                      style={{ fontSize: 11, fontWeight: 700,
                        color: p.video_option ? teinteDiscipline('video', disciplines) : 'var(--c-dim)',
                        border: `1px ${p.video_option ? 'solid' : 'dashed'} ${p.video_option ? teinteDiscipline('video', disciplines) : 'var(--n2-bord)'}` }}>
                      <Video className="w-3 h-3 inline-block align-[-1px] mr-1" aria-hidden />
                      {p.video_option ? 'vidéo vendue' : 'pas de vidéo'}
                    </button>
                  )}

                  {/* LE PASSAGER DU TANDEM. C'est un civil : pas de compte, pas
                      de licence, pas de verdict. Un nom et une masse suffisent,
                      et la masse se demande au comptoir — personne ne peut la
                      deviner. Il prend un siège, donc il compte. */}
                  {!close && onAjouterPassager && p.type_saut === 'tandem' && !p.passager_nom
                    && !places.some(q => q.passager_nom && q.groupe_id && q.groupe_id === p.groupe_id) && (
                    <form className="flex items-center gap-1.5 flex-wrap"
                      onSubmit={e => {
                        e.preventDefault();
                        const f = e.currentTarget as HTMLFormElement;
                        const nom = (f.elements.namedItem('nom') as HTMLInputElement).value.trim();
                        const kgTexte = (f.elements.namedItem('kg') as HTMLInputElement).value.trim();
                        if (!nom) return;
                        agir('Ajout du passager', () =>
                          onAjouterPassager(p, nom, kgTexte === '' ? null : Number(kgTexte.replace(',', '.')))
                            .then(err => ({ error: err ? { message: err } : null })));
                      }}>
                      <span style={{ fontSize: 11, color: SEVERITE_COULEUR.vigilance, fontWeight: 700 }}>
                        Passager à saisir
                      </span>
                      <input name="nom" type="text" placeholder="nom du passager" disabled={occupe}
                        className="px-2 rounded-lg"
                        style={{ width: 150, minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                 color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                      <input name="kg" type="number" inputMode="decimal" min={20} max={250} step={0.5}
                        placeholder="kg" disabled={occupe}
                        className="px-1.5 rounded-lg text-right"
                        style={{ width: 62, minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                 color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                      <button type="submit" disabled={occupe}
                        style={{ ...action('secondaire'), minHeight: 30, fontSize: 11 }}>
                        Ajouter
                      </button>
                    </form>
                  )}

                  {/* L'ÉQUIPEMENT, tel qu'il est DÉCLARÉ — jamais deviné. La
                      source est ce que le sauteur a saisi en se déclarant
                      présent (perso ou location), ou à défaut son matériel
                      enregistré. Rien n'est affiché qui ne vienne de là. */}
                  {/* LA CHARGE ALAIRE. Elle dit d'où vient son seuil : sans
                      référence saisie, c'est un repère du centre, pas une
                      règle fédérale. Et quand elle n'est pas calculable, elle
                      NOMME ce qui manque — une case vide se lirait « tout va
                      bien », et ce serait faux. */}
                  {/* LA VOILE DE CE SAUT. Le sauteur la déclare en se mettant
                      en file ; le DT la corrige ou la saisit ici, à côté du
                      minimum exigé — les deux chiffres se lisent ensemble. */}
                  {!close && !p.passager_nom && onDefinirSurfaceVoile && (
                    <label className="flex items-center gap-1"
                      style={{ fontSize: 11,
                               color: p.surface_voile_ft2 == null ? 'var(--c-dim)' : 'var(--c-muted)' }}>
                      <span className="sr-only">Surface de la voile de {p.nom}, en ft²</span>
                      <input type="number" inputMode="numeric" min={50} max={500} step={1}
                        defaultValue={p.surface_voile_ft2 ?? ''} disabled={occupe}
                        placeholder="voile"
                        onBlur={e => {
                          const v = e.target.value.trim();
                          const ft2 = v === '' ? null : Number(v);
                          if (ft2 === (p.surface_voile_ft2 ?? null)) return;
                          agir('Surface de voile', () =>
                            onDefinirSurfaceVoile(p.id, ft2).then(err => ({ error: err ? { message: err } : null })));
                        }}
                        className="px-1.5 rounded-lg text-right"
                        style={{ width: 72, minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                 color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                      ft²
                    </label>
                  )}

                  {!p.passager_nom && p.parachutiste_id && (() => {
                    const v = dt48?.get(p.parachutiste_id);
                    const l = libelleDT48(v);
                    if (!l || !v) return null;
                    // L'AMÉNAGEMENT NE SE PROPOSE QUE S'IL CHANGE QUELQUE CHOSE.
                    // Sous la tolérance, il ne rattrape rien : offrir le bouton
                    // laisserait croire qu'un clic règle le problème.
                    const rattrapable = v.etat === 'non_conforme' && !v.amenagement
                      && v.surfaceDeclareeFt2 !== null && v.surfaceMinFt2 !== null
                      && v.surfaceDeclareeFt2 >= Math.round(v.surfaceMinFt2 * 0.89 * 10) / 10;
                    return (
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {/* COURT sur la ligne, complet au survol. L'infobulle
                            porte la tranche, l'origine de la voile et les
                            réserves — ça ne se lit pas au pied d'un avion. */}
                        <span title={`${l.detail}\n\n${SOURCE_DT48}`}
                          className="whitespace-nowrap"
                          style={{ fontSize: 11,
                            color: l.bloque ? SEVERITE_COULEUR.critique
                                 : l.inconnu ? 'var(--c-dim)' : 'var(--c-text2)',
                            fontWeight: l.bloque ? 700 : 400 }}>
                          <Scale className="w-3 h-3 inline-block align-[-1px] mr-1" aria-hidden />
                          {l.texte}
                          {l.suite && (
                            <span style={{ color: l.bloque ? 'inherit' : 'var(--c-dim)', fontWeight: 400 }}>
                              {' · '}{l.suite}
                            </span>
                          )}
                        </span>
                        {!close && onAmenagementDT48 && (rattrapable || v.amenagement) && (
                          <button type="button" disabled={occupe}
                            title={v.amenagement
                              ? 'Retirer l’aménagement −11 % accordé à cette personne'
                              : 'Accorder l’aménagement DT 48 de −11 % — réservé au DT ou à un initiateur BI5/B5'}
                            onClick={() => agir('Aménagement DT 48', () =>
                              onAmenagementDT48(p.parachutiste_id!, !v.amenagement)
                                .then(e => ({ error: e ? { message: e } : null })))}
                            className="whitespace-nowrap px-1.5 py-0.5 rounded"
                            style={{ fontSize: 10.5, fontWeight: 800,
                              color: v.amenagement ? SEVERITE_COULEUR.vigilance : 'var(--action-texte)',
                              border: `1px solid ${v.amenagement ? SEVERITE_COULEUR.vigilance : 'var(--action-texte)'}` }}>
                            {v.amenagement ? 'retirer −11 %' : 'accorder −11 %'}
                          </button>
                        )}
                      </span>
                    );
                  })()}

                  {/* « perso · voile perso » disait deux fois la même chose.
                      On garde le nom de la voile quand il en dit plus que la
                      provenance ; sinon la provenance seule suffit. */}
                  {!p.passager_nom && (() => {
                    const brut = p.equipement ?? null;
                    const court = brut === null ? 'équipement non déclaré'
                      : brut.replace(/^(perso|location DZ) · (voile perso|voile du centre)$/,
                                     (_, provenance) => provenance);
                    return (
                      <span className="whitespace-nowrap"
                        title={brut ?? undefined}
                        style={{ fontSize: 11, color: brut ? 'var(--c-text2)' : 'var(--c-dim)' }}>
                        <Package className="w-3 h-3 inline-block align-[-1px] mr-1" aria-hidden />
                        {court}
                      </span>
                    );
                  })()}

                  {/* Vert : on le dit aussi, sinon le volet semble vide. */}
                  {!aDire && p.aptitude === 'vert' && (
                    <span style={{ fontSize: 11, color: SEVERITE_COULEUR.conforme }}>
                      dossier complet
                    </span>
                  )}
                </div>
              )}
            </li>
          );})}
          </ul>
          </div>
          );})}

          {!close && onReordonner && places.length > 1 && (
            <p className="mt-1.5" style={{ fontSize: 11.5, color: 'var(--c-dim)' }}>
              Glissez une ligne — ou un groupe entier — pour changer l’ordre de sortie.
            </p>
          )}

          {/* Former un groupe : on coche, on réunit. Deux minimum — « grouper
              une personne » ne veut rien dire. */}
          {!close && onGrouper && selection.size > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button type="button" disabled={occupe || selection.size < 2}
                className="disabled:opacity-50"
                onClick={() => agir('Groupage', () =>
                  onGrouper([...selection]).then(e => {
                    if (!e) setSelection(new Set());
                    return { error: e ? { message: e } : null };
                  }))}
                style={{ ...action('secondaire'), minHeight: 34, fontSize: 12 }}>
                <Users className="w-3.5 h-3.5" aria-hidden />
                Grouper {selection.size} sélectionné{selection.size > 1 ? 's' : ''}
              </button>
              <button type="button" onClick={() => setSelection(new Set())}
                style={{ ...action('texte'), minHeight: 34, fontSize: 12 }}>
                Annuler
              </button>
              {selection.size < 2 && (
                <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  sélectionnez-en au moins deux
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Les gestes de la planche, dans leur ordre réel ────────────────── */}
      {!cloturee && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {/* FIGER L'EMBARQUEMENT. Tant qu'on charge l'avion, tout se corrige ;
              une fois validé, la planche est ce qu'on a annoncé à l'équipage.
              On rouvre tant que l'avion n'est pas parti — un sauteur se
              décommande, ça arrive. Après le décollage, la base refuse. */}
          {!r.heure_decollage && onValiderEmbarquement && (
            <button type="button" disabled={occupe}
              onClick={() => agir(figee ? 'Réouverture' : 'Validation de l’embarquement', () =>
                onValiderEmbarquement(!figee).then(e => ({ error: e ? { message: e } : null })))}
              title={figee
                ? 'Rouvrir pour corriger — possible tant que l’avion n’est pas parti'
                : 'Figer la composition : elle ne se modifiera plus'}
              style={action('secondaire')}>
              {figee ? <Unlock className="w-4 h-4" aria-hidden /> : <Lock className="w-4 h-4" aria-hidden />}
              {figee ? 'Rouvrir l’embarquement' : 'Valider l’embarquement'}
            </button>
          )}
          {!figee && places.length > 1 && (
            <button type="button" disabled={occupe} style={action('secondaire')}
              title={'Reclasse selon l’ordre de sortie réglé pour ce centre — '
                + 'modifiable par la roue crantée, en haut du module. '
                + 'REMPLACE l’ordre posé à la main.'}
              onClick={() => agir('Ordre de sortie', async () => {
                // Un ordre pose a la main marque les places « rang_manuel », et
                // le calcul automatique les ignore — sinon il ecraserait une
                // decision humaine. Ce bouton dit explicitement « reprends la
                // main » : on leve donc le drapeau AVANT de recalculer, sans
                // quoi il ne ferait visiblement rien.
                const { error } = await supabase.from('places_rotation')
                  .update({ rang_manuel: false }).eq('rotation_id', r.id);
                if (error) return { error };
                return supabase.rpc('calculer_ordre_sortie', { p_rotation_id: r.id })
                  .then(x => ({ error: x.error }));
              })}>
              <ArrowDownUp className="w-4 h-4" aria-hidden /> Réordonner automatiquement
            </button>
          )}
          {/* SUPPRIMER UNE PLANCHE OUVERTE PAR ERREUR. On ouvrait un avion d'un
              clic et rien ne permettait de le refermer : une fausse manoeuvre
              restait dans la journée pour toujours.
              Le bouton disparaît dès que l'avion est parti — une rotation qui a
              volé ne s'efface pas, et la base le refuse de toute façon. */}
          {!r.heure_decollage && !close && onSupprimerPlanche && (
            confirmerSuppression ? (
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--c-text2)' }}>
                  Supprimer la planche n°{r.numero}
                  {places.length > 0 && ` et remettre ${places.length} personne${places.length > 1 ? 's' : ''} en file`} ?
                </span>
                <button type="button" disabled={occupe}
                  onClick={() => { setConfirmerSuppression(false);
                    agir('Suppression de la planche', () =>
                      onSupprimerPlanche().then(e => ({ error: e ? { message: e } : null }))); }}
                  className="px-2.5 py-1 rounded-lg font-bold"
                  style={{ color: '#fff', background: '#DC2626' }}>Oui, supprimer</button>
                <button type="button" onClick={() => setConfirmerSuppression(false)}
                  className="px-2.5 py-1 rounded-lg"
                  style={{ color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>Annuler</button>
              </span>
            ) : (
              <button type="button" disabled={occupe}
                onClick={() => setConfirmerSuppression(true)}
                title={places.length > 0
                  ? 'Supprimer cette planche — les personnes placées repartent en file d’avionnage'
                  : 'Supprimer cette planche vide'}
                className="flex items-center gap-1.5 px-2.5 rounded-lg"
                style={{ minHeight: 36, fontSize: 13, fontWeight: 600,
                         color: '#DC2626', border: '1px solid rgba(220,38,38,0.4)' }}>
                <Trash2 className="w-4 h-4" aria-hidden /> Supprimer
              </button>
            )
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
