import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ymdLocal } from '../../lib/datetime';
import {
  Plane, Plus, Users, ArrowDownUp, Lock, AlertTriangle, ShieldCheck,
  XCircle, ChevronRight, Trash2,
} from 'lucide-react';
import { siegesOccupes, libelleCapacite, phaseRotation } from '../../lib/avionnage';
import { PastillePhase } from './FriseRotations';
import { FicheAeronef } from './FicheAeronef';
import { capacitePlein, type FicheAeronef as FicheAeronefData } from '../../lib/masseCentrage';

// ═══════════════════════════════════════════════════════════════════════════
// P3 — MANIFEST : rotations, chargements, ordre de sortie.
//
// L'objet autour duquel tourne réellement la journée d'une DZ. Tant qu'il est
// absent, la DZ manifeste ailleurs et ParaPass reste un outil de plus.
//
// L'aptitude (P2) s'affiche sur chaque place mais n'empêche JAMAIS une
// inscription : l'application informe, le DT décide. C'est la doctrine du
// produit, et elle vaut ici comme partout.
//
// La date du jour vient de ymdLocal : une rotation de 21 h basculerait au
// lendemain avec un cast UTC.
// ═══════════════════════════════════════════════════════════════════════════

const TYPES_SAUT = [
  ['ecole', 'École'], ['accompagne', 'Accompagné'], ['solo', 'Solo'],
  ['groupe', 'Groupe'], ['tandem', 'Tandem'], ['wingsuit', 'Wingsuit'], ['video', 'Vidéo'],
] as const;

const STATUTS_PLACE = [
  ['inscrit', 'Inscrit'], ['embarque', 'Embarqué'], ['largue', 'Largué'],
  ['pose', 'Posé'], ['sorti', 'Sorti'],
] as const;

interface Rotation {
  id: string; numero: number; pilote: string | null;
  altitude_largage_m: number | null; heure_prevue: string | null;
  statut: string; aeronef_id: string | null; cloturee_le: string | null;
  heure_decollage: string | null; heure_largage: string | null; embarquement_valide_le: string | null;
}
/** Un avion de la flotte, avec sa fiche (masses, vol, carburant, centrage). */
export interface Aeronef extends FicheAeronefData {
  id: string; immatriculation: string; places: number;
  altitude_max_m: number | null; type?: string | null;
  nom?: string | null; couleur?: string | null;
}
interface Place {
  id: string; rotation_id: string; parachutiste_id: string | null;
  moniteur_id: string | null;
  type_saut: string; rang_sortie: number | null; statut: string; groupe_id: string | null;
  nom: string; aptitude: 'vert' | 'orange' | 'rouge' | null; motif: string | null;
}

const lib = (l: readonly (readonly [string, string, ...unknown[]])[], c: string) =>
  l.find(([k]) => k === c)?.[1] ?? c;

function RotationsInner({ centreId }: { centreId: string }) {
  const jour = ymdLocal(new Date());
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [aeronefs, setAeronefs] = useState<Aeronef[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [presents, setPresents] = useState<{ id: string; nom: string; aptitude: string; motif: string | null }[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    const [{ data: rot, error: e1 }, { data: av }, { data: apt }] = await Promise.all([
      supabase.from('rotations').select('*')
        .eq('centre_id', centreId).eq('date_jour', jour).order('numero'),
      supabase.from('aeronefs').select('*')
        .eq('centre_id', centreId).eq('actif', true).order('immatriculation'),
      supabase.rpc('get_aptitude_du_jour', { p_centre_id: centreId }),
    ]);
    if (e1) {
      console.error('Rotations — chargement échoué :', {
        code: e1.code, message: e1.message, details: e1.details, hint: e1.hint,
      });
      setErreur(e1.message); setChargement(false); return;
    }
    const rr = (rot ?? []) as Rotation[];
    setRotations(rr);
    setAeronefs((av ?? []) as Aeronef[]);

    type Apt = { parachutiste_id: string; nom: string; prenom: string; statut: string;
                 motifs: { libelle: string; levee: boolean }[] };
    const aptitudes = (apt ?? []) as Apt[];
    setPresents(aptitudes.map(a => ({
      id: a.parachutiste_id, nom: `${a.prenom} ${a.nom}`, statut: a.statut,
      aptitude: a.statut, motif: a.motifs.find(m => !m.levee)?.libelle ?? null,
    })).map(({ id, nom, aptitude, motif }) => ({ id, nom, aptitude, motif })));

    if (rr.length > 0) {
      const { data: pl, error: e2 } = await supabase.from('places_rotation')
        .select('id, rotation_id, parachutiste_id, moniteur_id, type_saut, rang_sortie, statut, groupe_id, profiles!parachutiste_id(nom, prenom)')
        .in('rotation_id', rr.map(r => r.id)).order('rang_sortie', { nullsFirst: false });
      if (e2) {
        console.error('Places — chargement échoué :', {
          code: e2.code, message: e2.message, details: e2.details, hint: e2.hint,
        });
      }
      type Pr = { nom: string; prenom: string };
      setPlaces(((pl ?? []) as Array<Place & { profiles: Pr | Pr[] | null }>).map(p => {
        const pr = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const a = aptitudes.find(x => x.parachutiste_id === p.parachutiste_id);
        return {
          ...p,
          nom: pr ? `${pr.prenom} ${pr.nom}` : 'Passager tandem',
          aptitude: (a?.statut as Place['aptitude']) ?? null,
          motif: a?.motifs.find(m => !m.levee)?.libelle ?? null,
        };
      }));
    } else setPlaces([]);
    setChargement(false);
  }, [centreId, jour]);

  useEffect(() => { charger(); }, [charger]);

  const appel = async (fn: () => PromiseLike<{ error: unknown }>, nom: string) => {
    setAction(nom);
    const { error } = await Promise.resolve(fn());
    setAction(null);
    if (error) {
      const e = error as { code?: string; message?: string; details?: string; hint?: string };
      console.error(`${nom} — échec :`, { code: e.code, message: e.message, details: e.details, hint: e.hint });
      alert(`${nom} a échoué : ${e.message}`);
      return false;
    }
    charger();
    return true;
  };

  const nouvelleRotation = () =>
    appel(() => supabase.from('rotations').insert({
      centre_id: centreId, date_jour: jour,
      numero: (rotations.length > 0 ? rotations[rotations.length - 1].numero : 0) + 1,
      aeronef_id: aeronefs[0]?.id ?? null,
      altitude_largage_m: aeronefs[0]?.altitude_max_m ?? 4000,
    }).then(r => ({ error: r.error })), 'Création de la rotation');

  const inscrire = (rotationId: string, parachutisteId: string, type: string) =>
    appel(() => supabase.from('places_rotation').insert({
      rotation_id: rotationId, parachutiste_id: parachutisteId, type_saut: type,
    }).then(r => ({ error: r.error })), 'Inscription');

  const majPlace = (id: string, patch: Record<string, unknown>) =>
    appel(() => supabase.from('places_rotation').update(patch).eq('id', id)
      .then(r => ({ error: r.error })), 'Mise à jour de la place');

  const retirer = (id: string) =>
    appel(() => supabase.from('places_rotation').delete().eq('id', id)
      .then(r => ({ error: r.error })), 'Retrait de la place');

  const ordonner = (rotationId: string) =>
    appel(() => supabase.rpc('calculer_ordre_sortie', { p_rotation_id: rotationId })
      .then(r => ({ error: r.error })), 'Calcul de l’ordre de sortie');

  const cloturer = async (r: Rotation) => {
    const posees = places.filter(p => p.rotation_id === r.id && p.statut === 'pose').length;
    if (posees === 0) {
      alert('Aucune place au statut « posé » : rien à consigner.\n\n'
        + 'Passez les places à « posé » une fois la rotation revenue.');
      return;
    }
    setAction('cloture');
    const { data, error } = await supabase.rpc('cloturer_rotation', { p_rotation_id: r.id });
    setAction(null);
    if (error) {
      console.error('Clôture de rotation — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      alert('La clôture a échoué : ' + error.message);
      return;
    }
    const res = data as { sauts_crees: number; tandems_ignores: number };
    alert(`${res.sauts_crees} saut(s) créé(s), en attente de validation moniteur.`
      + (res.tandems_ignores > 0
          ? `\n${res.tandems_ignores} passager(s) tandem : pas de carnet de sauts.` : ''));
    charger();
  };

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  const APT = { vert: '#34D399', orange: '#FB923C', rouge: '#F87171' } as const;

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
            <Plane className="w-5 h-5" style={{ color: '#60A5FA' }} aria-hidden />
            Rotations du jour
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--c-dim)' }}>
            L’aptitude s’affiche sur chaque place, mais n’empêche jamais une
            inscription : l’application informe, vous décidez.
          </p>
        </div>
        <button onClick={nouvelleRotation} disabled={!!action || aeronefs.length === 0}
          className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ minHeight: 44, background: 'var(--action-fond)', color: '#fff' }}>
          <Plus className="w-4 h-4" aria-hidden /> Rotation
        </button>
      </div>

      {erreur && (
        <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.35)', color: 'var(--sev-critique)' }}>{erreur}</div>
      )}

      {/* Sans avion, pas de largage : la saisie est ICI, là où le manque se
          constate — plutôt qu'un renvoi vers un écran où le formulaire
          n'existe pas. */}
      <FlotteAeronefs centreId={centreId} aeronefs={aeronefs} onFait={charger} />


      {rotations.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--c-dim)' }}>
          Aucune rotation aujourd’hui.
        </p>
      ) : rotations.map(r => {
        const pl = places.filter(p => p.rotation_id === r.id)
          .sort((a, b) => (a.rang_sortie ?? 99) - (b.rang_sortie ?? 99));
        const av = aeronefs.find(a => a.id === r.aeronef_id);
        // siegesOccupes compte le moniteur accompagnant, que pl.length
        // ignorait : « 3/4 » s'affichait sur un avion déjà plein.
        const sieges = siegesOccupes(pl);
        const complet = av ? sieges >= av.places : false;
        const close = r.statut === 'terminee';

        return (
          <div key={r.id} className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-extrabold" style={{ color: 'var(--c-text)' }}>
                Rotation {r.numero}
              </span>
              {/* La phase commune — mêmes mots, mêmes couleurs que la frise. */}
              <PastillePhase phase={phaseRotation(r)} />
              <span className="text-xs" style={{ color: 'var(--c-dim)' }}>
                {av?.immatriculation ?? 'aéronef ?'} · {r.altitude_largage_m ?? '?'} m
                {' · '}{libelleCapacite(sieges, av?.places ?? null)}
              </span>
              {complet && !close && (
                <span className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: '#FB923C' }}>
                  <AlertTriangle className="w-3 h-3" aria-hidden /> avion complet
                </span>
              )}
              <div className="ml-auto flex gap-2">
                {!close && pl.length > 1 && (
                  <button onClick={() => ordonner(r.id)} disabled={!!action}
                    className="flex items-center gap-1 px-2.5 rounded-lg text-xs font-semibold"
                    style={{ minHeight: 36, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
                    <ArrowDownUp className="w-3 h-3" aria-hidden /> Ordre de sortie
                  </button>
                )}
                {!close && (
                  <button onClick={() => cloturer(r)} disabled={!!action}
                    className="flex items-center gap-1 px-2.5 rounded-lg text-xs font-bold"
                    style={{ minHeight: 36, background: '#10B981', color: '#fff' }}>
                    <Lock className="w-3 h-3" aria-hidden /> Clôturer
                  </button>
                )}
              </div>
            </div>

            {close && (
              <p className="text-xs" style={{ color: 'var(--sev-conforme)' }}>
                Clôturée — les sauts ont été créés, en attente de validation moniteur.
              </p>
            )}

            {pl.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--c-dim)' }}>Aucun inscrit.</p>
            ) : (
              <ul className="space-y-1">
                {pl.map(p => (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 flex-wrap"
                    style={{ background: 'var(--c-bg)' }}>
                    <span className="text-xs font-mono w-6 flex-shrink-0" style={{ color: 'var(--c-dim)' }}>
                      {p.rang_sortie ?? '—'}
                    </span>
                    {p.aptitude && (
                      <span title={p.motif ?? 'Rien à signaler'} className="flex-shrink-0">
                        {p.aptitude === 'vert'
                          ? <ShieldCheck className="w-3.5 h-3.5" style={{ color: APT.vert }} aria-hidden />
                          : p.aptitude === 'orange'
                            ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: APT.orange }} aria-hidden />
                            : <XCircle className="w-3.5 h-3.5" style={{ color: APT.rouge }} aria-hidden />}
                      </span>
                    )}
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--c-text)' }}>
                      {p.nom}
                    </span>
                    <span className="text-xs px-1.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--c-hover)', color: 'var(--c-muted)' }}>
                      {lib(TYPES_SAUT, p.type_saut)}
                    </span>
                    {!close && (
                      <>
                        <select value={p.statut} onChange={e => majPlace(p.id, { statut: e.target.value })}
                          className="text-xs rounded-lg px-1.5 flex-shrink-0"
                          style={{ minHeight: 32, background: 'var(--c-surface)',
                            border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                          {STATUTS_PLACE.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                        </select>
                        <button onClick={() => retirer(p.id)} aria-label="Retirer"
                          className="p-1 flex-shrink-0" style={{ color: 'var(--c-dim)' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {p.motif && (
                      <span className="w-full text-xs pl-8"
                        style={{ color: p.aptitude === 'rouge' ? APT.rouge : APT.orange }}>
                        {p.motif}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!close && <Inscrire rotationId={r.id} presents={presents}
              dejaInscrits={pl.map(p => p.parachutiste_id).filter(Boolean) as string[]}
              onInscrire={inscrire} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Inscription d'un présent ────────────────────────────────────────────────

export function Inscrire({ rotationId, presents, dejaInscrits, onInscrire }: {
  rotationId: string;
  presents: { id: string; nom: string; aptitude: string; motif: string | null }[];
  dejaInscrits: string[];
  onInscrire: (rotationId: string, parachutisteId: string, type: string) => void;
}) {
  const [qui, setQui] = useState('');
  const [type, setType] = useState<string>('solo');
  const dispo = presents.filter(p => !dejaInscrits.includes(p.id));

  if (dispo.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
        {presents.length === 0
          ? 'Aucune présence enregistrée aujourd’hui : personne à inscrire.'
          : 'Tous les présents sont déjà inscrits sur cette rotation.'}
      </p>
    );
  }

  const st = { minHeight: 40, background: 'var(--c-bg)',
    border: '1px solid var(--c-border)', color: 'var(--c-text)' } as const;

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />
      <select value={qui} onChange={e => setQui(e.target.value)}
        className="flex-1 min-w-[160px] rounded-lg px-2 text-xs" style={st}>
        <option value="">Ajouter un présent…</option>
        {dispo.map(p => (
          <option key={p.id} value={p.id}>
            {p.nom}{p.aptitude !== 'vert' ? ` — ${p.motif ?? 'à vérifier'}` : ''}
          </option>
        ))}
      </select>
      <select value={type} onChange={e => setType(e.target.value)}
        className="rounded-lg px-2 text-xs" style={st}>
        {TYPES_SAUT.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
      </select>
      <button onClick={() => { if (qui) { onInscrire(rotationId, qui, type); setQui(''); } }}
        disabled={!qui}
        className="flex items-center gap-1 px-3 rounded-lg text-xs font-bold disabled:opacity-40"
        style={{ minHeight: 40, background: '#2563EB', color: '#fff' }}>
        <ChevronRight className="w-3 h-3" aria-hidden /> Inscrire
      </button>
    </div>
  );
}

// ─── Aéronefs du centre ──────────────────────────────────────────────────────

/**
 * DES CAPACITÉS CONNUES, PROPOSÉES — JAMAIS IMPOSÉES.
 *
 * Choisir un type pré-remplit les places et le plafond. Ce sont les
 * configurations courantes de ces avions en parachutisme, pas une vérité :
 * un même PC-6 vole à 8 ou à 10 selon son aménagement. La valeur reste
 * modifiable, et l’écran renvoie à la seule source qui fasse foi — la fiche de
 * pesée de l’avion.
 */
const TYPES_CONNUS: { type: string; places: number; plafond: number }[] = [
  { type: 'Cessna 182', places: 4, plafond: 4000 },
  { type: 'Cessna 206', places: 5, plafond: 4000 },
  { type: 'GA8 Airvan', places: 6, plafond: 4000 },
  { type: 'Pilatus PC-6', places: 10, plafond: 4200 },
  { type: 'PAC 750XL', places: 16, plafond: 4200 },
  { type: 'Cessna 208 Caravan', places: 17, plafond: 4200 },
  { type: 'Let L-410', places: 16, plafond: 4200 },
  { type: 'DHC-6 Twin Otter', places: 22, plafond: 4200 },
];

/**
 * LA FLOTTE DU CENTRE. Elle était jusqu’ici en écriture seule : on ajoutait un
 * avion, on ne pouvait plus jamais corriger ses places. Un chiffre faux —
 * saisi vite, ou laissé au défaut de 4 — condamnait chaque planche à compter
 * de travers, sans recours depuis l’application.
 *
 * CE QUE « PLACES » COMPTE, ET QUE RIEN NE DISAIT : les sièges occupables par
 * des PARACHUTISTES — largueur et passager tandem compris —, ÉQUIPAGE EXCLU.
 * Le pilote ne s’inscrit jamais sur une planche : le compter dans la capacité
 * que la planche remplit aurait fait perdre un siège à chaque rotation.
 */
export function FlotteAeronefs({ centreId, aeronefs, onFait }: {
  centreId: string; aeronefs: Aeronef[]; onFait: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [deplie, setDeplie] = useState(false);
  const [immat, setImmat] = useState('');
  const [type, setType] = useState('');
  const [places, setPlaces] = useState('4');
  const [altMax, setAltMax] = useState('4000');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /** Choisir un type connu remplit les deux chiffres d’un coup. */
  const choisirType = (valeur: string) => {
    setType(valeur);
    const connu = TYPES_CONNUS.find(t => t.type.toLowerCase() === valeur.trim().toLowerCase());
    if (connu) { setPlaces(String(connu.places)); setAltMax(String(connu.plafond)); }
  };

  /**
   * RETIRER UN AÉRONEF — ce qui manquait aussi. Une immatriculation saisie de
   * travers restait dans la flotte pour toujours et polluait le choix à chaque
   * nouvelle planche.
   *
   * La base décide seule entre supprimer et désactiver : un avion cité par une
   * rotation porte une trace — la planche du 12 mars dit quel avion a largué —
   * et l'effacer réécrirait l'histoire. Il est alors désactivé, et l'écran dit
   * lequel des deux a eu lieu.
   */
  const [aRetirer, setARetirer] = useState<Aeronef | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const retirer = async (a: Aeronef) => {
    setErreur(null); setMessage(null); setARetirer(null);
    const { data, error } = await supabase.rpc('retirer_aeronef', { p_aeronef_id: a.id });
    if (error) {
      console.error('Retrait d’aéronef — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint });
      setMessage(`${a.immatriculation} n’a pas pu être retiré : ${error.message}`);
      setErreur(error.message);
      return;
    }
    const r = (data ?? {}) as { action?: string; rotations?: number };
    setMessage(r.action === 'supprime'
      ? `${a.immatriculation} supprimé de la flotte.`
      : `${a.immatriculation} retiré des listes. Il reste nommé sur ${r.rotations ?? 0} planche(s) `
        + 'déjà enregistrée(s) : ParaPass ne réécrit pas une journée passée.');
    onFait();
  };

  const valider = async () => {
    if (!immat.trim()) return;
    setEnvoi(true); setErreur(null);
    const { data: cree, error } = await supabase.from('aeronefs').insert({
      centre_id: centreId, immatriculation: immat.trim().toUpperCase(),
      type: type.trim() || null, places: Number(places) || 4,
      altitude_max_m: Number(altMax) || null,
    }).select('*').single();
    setEnvoi(false);
    if (error) {
      console.error('Ajout d\u2019aéronef — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message);
      return;
    }
    setImmat(''); setType(''); setOuvert(false); onFait();
    // L'avion existe : on ouvre sa fiche, c'est là que la planche trouve ses chiffres.
    if (cree) { setDeplie(true); setFiche(cree as Aeronef); }
  };

  const nf = new Intl.NumberFormat('fr-FR');
  const plage = (a?: number | null, b?: number | null, u = '') =>
    a && b ? `${nf.format(a)}–${nf.format(b)} ${u}` : a || b ? `${nf.format((a || b)!)} ${u}` : '—';
  const [fiche, setFiche] = useState<Aeronef | null>(null);

  /** Ce qui manque pour que la planche calcule la masse, puis le centrage. */
  const EtatFiche = ({ a }: { a: Aeronef }) => {
    const masse = a.masse_a_vide_kg != null && a.masse_max_kg != null && a.masse_pilote_kg != null;
    const centrage = a.corde_mac_m != null && a.distance_reference_m != null && a.bras_vide_m != null
      && (a.domaine_centrage?.length ?? 0) >= 3 && (a.bras_places_m?.filter(x => x != null).length ?? 0) >= a.places;
    const carbu = capacitePlein(a) !== null;
    const ok = masse && centrage && carbu;
    return (
      <span className="inline-flex items-center rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap"
        style={{ minHeight: 26,
          background: ok ? 'color-mix(in srgb, var(--sev-conforme, #15803D) 14%, transparent)' : 'var(--c-hover)',
          color: ok ? 'var(--sev-conforme, #15803D)' : 'var(--c-muted)' }}>
        {ok ? 'Fiche complète' : !masse ? 'Masses à renseigner' : !centrage ? 'Centrage à renseigner' : 'Carburant à renseigner'}
      </span>
    );
  };

  const ActionsAvion = ({ a }: { a: Aeronef }) => aRetirer?.id === a.id ? (
    <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
      <span style={{ color: 'var(--c-text2)' }}>Retirer ?</span>
      <button onClick={() => retirer(a)} className="px-3 rounded-lg font-bold" style={{ minHeight: 36, color: '#fff', background: '#DC2626' }}>Oui</button>
      <button onClick={() => setARetirer(null)} className="px-3 rounded-lg" style={{ minHeight: 36, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>Non</button>
    </span>
  ) : (
    <span className="flex items-center gap-1.5">
      <button onClick={() => setFiche(a)} className="px-3 rounded-lg text-[13px] font-bold whitespace-nowrap"
        style={{ minHeight: 36, color: 'var(--accent-texte)', border: '1px solid var(--c-border)' }}>
        Fiche
      </button>
      <button onClick={() => { setARetirer(a); setMessage(null); }}
        aria-label={`Retirer ${a.immatriculation} de la flotte`} title={`Retirer ${a.immatriculation} de la flotte`}
        className="w-9 h-9 flex items-center justify-center rounded-lg"
        style={{ color: '#DC2626', border: '1px solid rgba(220,38,38,0.4)' }}>
        <Trash2 className="w-4 h-4" aria-hidden />
      </button>
    </span>
  );

  const st = { minHeight: 40, background: 'var(--c-bg)',
    border: '1px solid var(--c-border)', color: 'var(--c-text)' } as const;

  return (
    <div className="rounded-2xl p-3 space-y-2"
      style={{ background: aeronefs.length === 0 ? 'rgba(251,191,36,0.10)' : 'var(--c-surface)',
        border: `1px solid ${aeronefs.length === 0 ? 'rgba(251,191,36,0.35)' : 'var(--c-border)'}` }}>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs" style={{ color: 'var(--c-text2)' }}>
          {aeronefs.length === 0
            ? 'Aucun aéronef enregistré — sans avion, pas de largage.'
            : <>
                <strong>{aeronefs.length} aéronef{aeronefs.length > 1 ? 's' : ''}</strong>
                {' · '}
                {aeronefs.map(a => `${a.immatriculation} (${a.places} pl.)`).join(', ')}
              </>}
        </p>
        <div className="flex gap-2">
          {aeronefs.length > 0 && (
            <button onClick={() => setDeplie(v => !v)} aria-expanded={deplie}
              className="flex items-center gap-1 px-3 rounded-lg text-xs font-bold"
              style={{ minHeight: 36, color: 'var(--c-text2)', border: '1px solid var(--c-border)' }}>
              {deplie ? 'Masquer la flotte' : 'Flotte et fiches'}
            </button>
          )}
          {!ouvert && (
            <button onClick={() => setOuvert(true)}
              className="flex items-center gap-1 px-3 rounded-lg text-xs font-bold"
              style={{ minHeight: 36, background: 'var(--c-bg)', color: 'var(--c-text)',
                border: '1px solid var(--c-border)' }}>
              <Plus className="w-3 h-3" aria-hidden /> Aéronef
            </button>
          )}
        </div>
      </div>

      {/* ── LA FLOTTE, D'UN COUP D'ŒIL ────────────────────────────────────
          Un tableau comme ceux des logiciels de manifest : le type, les
          places, les varios, la consommation et le temps d'un plein. Chaque
          ligne ouvre sa fiche ; « fiche à compléter » dit ce qui manque pour
          que la planche calcule la masse et le centrage. */}
      {deplie && aeronefs.length > 0 && (
        <div className="space-y-2">
          <div className="hidden md:block overflow-x-auto rounded-xl" style={{ border: '1px solid var(--c-border)' }}>
            <table className="w-full text-[13px]" style={{ color: 'var(--c-text)' }}>
              <thead>
                <tr style={{ background: 'var(--c-hover)', color: 'var(--c-muted)' }}>
                  {['Avion', 'Type', 'Places', 'Montée', 'Descente', 'Conso / rot.', 'Kéro', 'Masse et centrage', ''].map(t => (
                    <th key={t} scope="col" className="text-left font-semibold px-3 py-2 whitespace-nowrap">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aeronefs.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--c-border)' }}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-bold whitespace-nowrap">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" aria-hidden style={{ background: a.couleur ?? 'var(--c-border)' }} />
                        {a.immatriculation}
                      </span>
                      {a.nom && <span className="block" style={{ color: 'var(--c-muted)' }}>{a.nom}</span>}
                    </td>
                    <td className="px-3 py-2">{a.type ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{a.places}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{plage(a.vario_montee_min_ftmin, a.vario_montee_max_ftmin, 'ft/min')}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{a.taux_descente_max_ftmin ? `−${nf.format(a.taux_descente_max_ftmin)} ft/min` : '—'}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{a.conso_rotation_l ? `${nf.format(a.conso_rotation_l)} L` : '—'}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{a.temps_kero_min ? `${a.temps_kero_min} min` : '—'}</td>
                    <td className="px-3 py-2"><EtatFiche a={a} /></td>
                    <td className="px-3 py-2"><ActionsAvion a={a} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Au téléphone, une carte par avion. */}
          <ul className="md:hidden list-none p-0 m-0 space-y-2">
            {aeronefs.map(a => (
              <li key={a.id} className="rounded-xl p-3" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" aria-hidden style={{ background: a.couleur ?? 'var(--c-border)' }} />
                  <span className="flex-1 min-w-0 text-[14px] font-bold truncate">
                    {a.immatriculation}{a.nom && <span className="font-normal" style={{ color: 'var(--c-muted)' }}> · {a.nom}</span>}
                  </span>
                </div>
                <p className="text-[13px] mt-1" style={{ color: 'var(--c-muted)' }}>
                  {[a.type, `${a.places} places`, a.vario_montee_max_ftmin ? `montée ${plage(a.vario_montee_min_ftmin, a.vario_montee_max_ftmin, 'ft/min')}` : null,
                    a.conso_rotation_l ? `${nf.format(a.conso_rotation_l)} L/rot.` : null, a.temps_kero_min ? `kéro ${a.temps_kero_min} min` : null]
                    .filter(Boolean).join(' · ')}
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap"><EtatFiche a={a} /><span className="flex-1" /><ActionsAvion a={a} /></div>
              </li>
            ))}
          </ul>
          {message && (
            <p role="status" className="text-xs px-2 py-1.5 rounded-lg"
              style={{ color: 'var(--c-text2)', background: 'var(--c-bg)',
                       borderLeft: `4px solid ${message.includes('n’a pas pu') ? '#DC2626' : '#10B981'}` }}>
              {message}
            </p>
          )}
          <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
            <strong>Places</strong> = sièges parachutistes, largueur et passager tandem compris, pilote non compris.
            {' '}<strong>Retirer</strong> supprime un avion qui n’a jamais servi ; s’il figure déjà sur une planche,
            il quitte les listes mais reste nommé sur les journées passées.
          </p>
        </div>
      )}

      {/* ── AJOUTER UN AÉRONEF ─────────────────────────────────────────── */}
      {ouvert && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2 flex-wrap items-end">
            <label className="flex-1 min-w-[130px] text-xs" style={{ color: 'var(--c-muted)' }}>
              Immatriculation *
              <input value={immat} onChange={e => setImmat(e.target.value)} placeholder="F-HPCJ"
                className="block w-full rounded-lg px-2 text-xs mt-0.5" style={st} />
            </label>
            <label className="flex-1 min-w-[140px] text-xs" style={{ color: 'var(--c-muted)' }}>
              Type
              <input value={type} onChange={e => choisirType(e.target.value)}
                list="types-aeronefs" placeholder="ex : Pilatus PC-6"
                className="block w-full rounded-lg px-2 text-xs mt-0.5" style={st} />
              <datalist id="types-aeronefs">
                {TYPES_CONNUS.map(t => <option key={t.type} value={t.type}>{t.places} places</option>)}
              </datalist>
            </label>
            <label className="w-24 text-xs" style={{ color: 'var(--c-muted)' }}>
              Places
              <input value={places} onChange={e => setPlaces(e.target.value)}
                inputMode="numeric" className="block w-full rounded-lg px-2 text-xs mt-0.5" style={st} />
            </label>
            <label className="w-28 text-xs" style={{ color: 'var(--c-muted)' }}>
              Plafond (m)
              <input value={altMax} onChange={e => setAltMax(e.target.value)}
                inputMode="numeric" className="block w-full rounded-lg px-2 text-xs mt-0.5" style={st} />
            </label>
          </div>
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
            <strong>Places = sièges parachutistes, pilote non compris.</strong>{' '}
            Choisir un type connu remplit les deux chiffres ; ce sont des
            configurations courantes, à confronter à la fiche de pesée de votre avion.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOuvert(false)} className="px-3 rounded-lg text-xs font-semibold"
              style={{ minHeight: 36, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
              Annuler
            </button>
            <button onClick={valider} disabled={!immat.trim() || envoi}
              className="px-3 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{ minHeight: 36, background: '#2563EB', color: '#fff' }}>
              {envoi ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {erreur && <p className="text-xs" style={{ color: 'var(--sev-critique)' }}>{erreur}</p>}
      {fiche && (
        <FicheAeronef aeronef={fiche} onFermer={() => setFiche(null)}
          onEnregistre={() => { setFiche(null); setMessage(`Fiche de ${fiche.immatriculation} enregistrée.`); onFait(); }} />
      )}
    </div>
  );
}

export function Rotations({ centreId }: { centreId: string }) {
  return <ErrorBoundary><RotationsInner centreId={centreId} /></ErrorBoundary>;
}
