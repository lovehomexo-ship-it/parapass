import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ymdLocal } from '../../lib/datetime';
import {
  Plane, Plus, Users, ArrowDownUp, Lock, AlertTriangle, ShieldCheck,
  XCircle, ChevronRight, Trash2,
} from 'lucide-react';
import { siegesOccupes, libelleCapacite } from '../../lib/avionnage';

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

const STATUTS_ROTATION = [
  ['preparation', 'En préparation', '#94A3B8'],
  ['complete', 'Complète', '#60A5FA'],
  ['embarquement', 'Embarquement', '#FBBF24'],
  ['en_vol', 'En vol', '#34D399'],
  ['terminee', 'Terminée', '#94A3B8'],
  ['annulee', 'Annulée', '#F87171'],
] as const;

const STATUTS_PLACE = [
  ['inscrit', 'Inscrit'], ['embarque', 'Embarqué'], ['largue', 'Largué'],
  ['pose', 'Posé'], ['sorti', 'Sorti'],
] as const;

interface Rotation {
  id: string; numero: number; pilote: string | null;
  altitude_largage_m: number | null; heure_prevue: string | null;
  statut: string; aeronef_id: string | null; cloturee_le: string | null;
}
export interface Aeronef { id: string; immatriculation: string; places: number; altitude_max_m: number | null }
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
  const [avionnageOuvert, setAvionnageOuvert] = useState(false);

  // L'ouverture de la file est un réglage du CENTRE, pas un état d'écran :
  // elle doit survivre au rechargement et être vue par les parachutistes.
  const basculerAvionnage = async (v: boolean) => {
    const precedent = avionnageOuvert;
    setAvionnageOuvert(v);            // retour immédiat, un interrupteur doit répondre
    const { error } = await supabase.from('centres')
      .update({ avionnage_actif: v }).eq('id', centreId);
    if (error) {
      console.error('Ouverture de l’avionnage échouée :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setAvionnageOuvert(precedent);  // on ne laisse pas l'écran mentir
      setErreur('Impossible de ' + (v ? 'ouvrir' : 'fermer') + ' les inscriptions : ' + error.message);
    }
  };

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    const [{ data: rot, error: e1 }, { data: av }, { data: apt }, { data: ctr }] = await Promise.all([
      supabase.from('rotations').select('*')
        .eq('centre_id', centreId).eq('date_jour', jour).order('numero'),
      supabase.from('aeronefs').select('id, immatriculation, places, altitude_max_m')
        .eq('centre_id', centreId).eq('actif', true).order('immatriculation'),
      supabase.rpc('get_aptitude_du_jour', { p_centre_id: centreId }),
      supabase.from('centres').select('avionnage_actif').eq('id', centreId).maybeSingle(),
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
    setAvionnageOuvert(Boolean((ctr as { avionnage_actif?: boolean } | null)?.avionnage_actif));

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
          border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>{erreur}</div>
      )}

      {/* Sans avion, pas de largage : la saisie est ICI, là où le manque se
          constate — plutôt qu'un renvoi vers un écran où le formulaire
          n'existe pas. */}
      <AjouterAeronef centreId={centreId} aeronefs={aeronefs} onFait={charger} />


      {rotations.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--c-dim)' }}>
          Aucune rotation aujourd’hui.
        </p>
      ) : rotations.map(r => {
        const pl = places.filter(p => p.rotation_id === r.id)
          .sort((a, b) => (a.rang_sortie ?? 99) - (b.rang_sortie ?? 99));
        const av = aeronefs.find(a => a.id === r.aeronef_id);
        const s = STATUTS_ROTATION.find(([c]) => c === r.statut);
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
              <span className="text-[11px] font-semibold px-2 rounded-full"
                style={{ background: `${s?.[2] ?? '#94A3B8'}22`, color: s?.[2] ?? '#94A3B8' }}>
                {lib(STATUTS_ROTATION, r.statut)}
              </span>
              <span className="text-xs" style={{ color: 'var(--c-dim)' }}>
                {av?.immatriculation ?? 'aéronef ?'} · {r.altitude_largage_m ?? '?'} m
                {' · '}{libelleCapacite(sieges, av?.places ?? null)}
              </span>
              {complet && !close && (
                <span className="flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: '#FB923C' }}>
                  <AlertTriangle className="w-3 h-3" aria-hidden /> avion complet
                </span>
              )}
              <div className="ml-auto flex gap-2">
                {!close && pl.length > 1 && (
                  <button onClick={() => ordonner(r.id)} disabled={!!action}
                    className="flex items-center gap-1 px-2.5 rounded-lg text-[11px] font-semibold"
                    style={{ minHeight: 36, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
                    <ArrowDownUp className="w-3 h-3" aria-hidden /> Ordre de sortie
                  </button>
                )}
                {!close && (
                  <button onClick={() => cloturer(r)} disabled={!!action}
                    className="flex items-center gap-1 px-2.5 rounded-lg text-[11px] font-bold"
                    style={{ minHeight: 36, background: '#10B981', color: '#fff' }}>
                    <Lock className="w-3 h-3" aria-hidden /> Clôturer
                  </button>
                )}
              </div>
            </div>

            {close && (
              <p className="text-[11px]" style={{ color: '#34D399' }}>
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
                    <span className="text-[11px] px-1.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--c-hover)', color: 'var(--c-muted)' }}>
                      {lib(TYPES_SAUT, p.type_saut)}
                    </span>
                    {!close && (
                      <>
                        <select value={p.statut} onChange={e => majPlace(p.id, { statut: e.target.value })}
                          className="text-[11px] rounded-lg px-1.5 flex-shrink-0"
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
                      <span className="w-full text-[11px] pl-8"
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
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
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

export function AjouterAeronef({ centreId, aeronefs, onFait }: {
  centreId: string; aeronefs: Aeronef[]; onFait: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [immat, setImmat] = useState('');
  const [type, setType] = useState('');
  const [places, setPlaces] = useState('4');
  const [altMax, setAltMax] = useState('4000');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    if (!immat.trim()) return;
    setEnvoi(true); setErreur(null);
    const { error } = await supabase.from('aeronefs').insert({
      centre_id: centreId, immatriculation: immat.trim().toUpperCase(),
      type: type.trim() || null, places: Number(places) || 4,
      altitude_max_m: Number(altMax) || null,
    });
    setEnvoi(false);
    if (error) {
      console.error('Ajout d\u2019aéronef — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message);
      return;
    }
    setImmat(''); setType(''); setOuvert(false); onFait();
  };

  const st = { minHeight: 40, background: 'var(--c-bg)',
    border: '1px solid var(--c-border)', color: 'var(--c-text)' } as const;

  if (!ouvert) {
    return (
      <div className="rounded-2xl p-3 flex items-center justify-between gap-2 flex-wrap"
        style={{ background: aeronefs.length === 0 ? 'rgba(251,191,36,0.10)' : 'var(--c-surface)',
          border: `1px solid ${aeronefs.length === 0 ? 'rgba(251,191,36,0.35)' : 'var(--c-border)'}` }}>
        <p className="text-xs" style={{ color: 'var(--c-text2)' }}>
          {aeronefs.length === 0
            ? "Aucun aéronef enregistré — sans avion, pas de largage."
            : `${aeronefs.length} aéronef(s) : ${aeronefs.map(a => a.immatriculation).join(', ')}`}
        </p>
        <button onClick={() => setOuvert(true)}
          className="flex items-center gap-1 px-3 rounded-lg text-xs font-bold"
          style={{ minHeight: 36, background: 'var(--c-bg)', color: 'var(--c-text)',
            border: '1px solid var(--c-border)' }}>
          <Plus className="w-3 h-3" aria-hidden /> Aéronef
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 space-y-2"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex gap-2 flex-wrap">
        <input value={immat} onChange={e => setImmat(e.target.value)} placeholder="Immatriculation *"
          className="flex-1 min-w-[130px] rounded-lg px-2 text-xs" style={st} />
        <input value={type} onChange={e => setType(e.target.value)} placeholder="Type (ex : PC-6)"
          className="flex-1 min-w-[110px] rounded-lg px-2 text-xs" style={st} />
        <input value={places} onChange={e => setPlaces(e.target.value)} placeholder="Places"
          inputMode="numeric" className="w-20 rounded-lg px-2 text-xs" style={st} />
        <input value={altMax} onChange={e => setAltMax(e.target.value)} placeholder="Alt. max (m)"
          inputMode="numeric" className="w-28 rounded-lg px-2 text-xs" style={st} />
      </div>
      {erreur && <p className="text-[11px]" style={{ color: '#F87171' }}>{erreur}</p>}
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
  );
}

export function Rotations({ centreId }: { centreId: string }) {
  return <ErrorBoundary><RotationsInner centreId={centreId} /></ErrorBoundary>;
}
