import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { Plane, Radio, MapPin, Users, ArrowDownUp, ShieldAlert, Save, History } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// P8 — Contenu OPÉRATIONNEL du briefing.
//
// Ce qu'un parachutiste doit savoir avant de monter, et qui ne figurait nulle
// part : quel avion, quel pilote, à quelle altitude, dans quel ordre, sur
// quelle fréquence, où se rassembler, et QUI est le DT de service.
//
// Un briefing publié n'est pas modifiable : enregistrer crée une RÉVISION
// (P8). Les acquittements déjà recueillis restent attachés à leur version —
// c'est dit clairement à l'écran, parce que ça change la portée du geste.
// ═══════════════════════════════════════════════════════════════════════════

interface Champs {
  aeronef: string;
  pilote: string;
  altitude_largage_m: string;
  ordre_sortie: string;
  separation: string;
  activites: string;
  frequence_radio: string;
  consigne_hors_zone: string;
  point_rassemblement: string;
  dt_service: string;
}

const VIDE: Champs = {
  aeronef: '', pilote: '', altitude_largage_m: '', ordre_sortie: '', separation: '',
  activites: '', frequence_radio: '', consigne_hors_zone: '', point_rassemblement: '',
  dt_service: '',
};

function OperationnelInner({ centreId }: { centreId: string }) {
  const [champs, setChamps] = useState<Champs>(VIDE);
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const [revision, setRevision] = useState(1);
  const [acquittements, setAcquittements] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null); setMessage(null);
    const jour = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from('dz_briefings')
      .select('*').eq('dz_id', centreId).eq('date_briefing', jour)
      .not('published_at', 'is', null)
      .order('revision', { ascending: false }).limit(1).maybeSingle();
    if (error) {
      console.error('Briefing opérationnel — chargement échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message); setChargement(false); return;
    }
    if (!data) { setBriefingId(null); setChargement(false); return; }

    setBriefingId(data.id);
    setRevision(data.revision ?? 1);
    setChamps({
      aeronef: data.aeronef ?? '', pilote: data.pilote ?? '',
      altitude_largage_m: data.altitude_largage_m?.toString() ?? '',
      ordre_sortie: data.ordre_sortie ?? '', separation: data.separation ?? '',
      activites: data.activites ?? '', frequence_radio: data.frequence_radio ?? '',
      consigne_hors_zone: data.consigne_hors_zone ?? '',
      point_rassemblement: data.point_rassemblement ?? '',
      dt_service: data.dt_service ?? '',
    });
    const { count } = await supabase.from('briefing_acknowledgements')
      .select('*', { count: 'exact', head: true }).eq('briefing_id', data.id);
    setAcquittements(count ?? 0);
    setChargement(false);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async () => {
    if (!briefingId) return;
    setEnvoi(true); setErreur(null); setMessage(null);
    const { data, error } = await supabase.rpc('publier_revision_briefing', {
      p_briefing_id: briefingId,
      p_champs: {
        ...champs,
        altitude_largage_m: champs.altitude_largage_m.trim() === ''
          ? null : Number(champs.altitude_largage_m),
      },
    });
    setEnvoi(false);
    if (error) {
      console.error('Révision du briefing — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message);
      return;
    }
    const nouvelle = (data as { revision: number } | null)?.revision;
    setMessage(`Révision ${nouvelle ?? revision + 1} publiée. `
      + `Les personnes ayant acquitté la révision ${revision} seront invitées à relire.`);
    charger();
  };

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  if (!briefingId) {
    return (
      <div className="rounded-2xl p-4 text-sm"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-dim)' }}>
        Publiez d’abord le briefing du jour (circuit et vent) : le contenu
        opérationnel viendra le compléter.
      </div>
    );
  }

  const champ = (
    cle: keyof Champs, label: string, Icone: typeof Plane,
    placeholder: string, multiligne = false,
  ) => (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>
        <Icone className="w-3.5 h-3.5" aria-hidden /> {label}
      </span>
      {multiligne ? (
        <textarea rows={2} value={champs[cle]} placeholder={placeholder}
          onChange={e => setChamps(c => ({ ...c, [cle]: e.target.value }))}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
      ) : (
        <input value={champs[cle]} placeholder={placeholder}
          onChange={e => setChamps(c => ({ ...c, [cle]: e.target.value }))}
          className="w-full rounded-xl px-3 text-sm"
          style={{ minHeight: 44, background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
      )}
    </label>
  );

  return (
    <div className="rounded-2xl p-4 space-y-4"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div>
        <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
          <Plane className="w-4 h-4" style={{ color: '#60A5FA' }} aria-hidden />
          Contenu opérationnel du jour
          {revision > 1 && (
            <span className="text-[11px] font-semibold px-1.5 rounded-full"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#FB923C' }}>
              révision {revision}
            </span>
          )}
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
          Ce que le parachutiste doit savoir avant de monter.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {champ('aeronef', 'Aéronef', Plane, 'ex : Pilatus PC-6 F-GXXX')}
        {champ('pilote', 'Pilote', Users, 'Prénom NOM')}
        {champ('altitude_largage_m', 'Altitude de largage (m)', ArrowDownUp, '4000')}
        {champ('frequence_radio', 'Fréquence radio', Radio, 'ex : 123.500')}
        {champ('dt_service', 'DT de service', Users, 'Prénom NOM')}
        {champ('point_rassemblement', 'Point de rassemblement', MapPin, 'ex : hangar principal')}
      </div>

      {champ('ordre_sortie', 'Ordre de sortie', ArrowDownUp,
        'ex : élèves et accompagnés, groupes RW du plus grand au plus petit, freefly, wingsuit', true)}
      {champ('separation', 'Séparation', ArrowDownUp, 'ex : 7 secondes entre groupes', true)}
      {champ('activites', 'Activités particulières', Users,
        'ex : 2 tandems à 10h, vidéo sur la rotation 3', true)}
      {champ('consigne_hors_zone', 'Consigne de poser hors zone', ShieldAlert,
        'ex : privilégier les champs à l’ouest, éviter la ligne HT au nord', true)}

      {/* La portée du geste, dite avant de le faire. */}
      <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
        style={{ background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.30)' }}>
        <History className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FB923C' }} aria-hidden />
        <p className="text-[11px]" style={{ color: 'var(--c-text2)' }}>
          Un briefing publié n’est pas modifiable. Enregistrer crée la
          <strong> révision {revision + 1}</strong>.
          {acquittements > 0 && (
            <> Les <strong>{acquittements} acquittement{acquittements > 1 ? 's' : ''}</strong> de
            la révision {revision} resteront attachés à cette version — les personnes
            concernées apparaîtront comme ayant lu une version antérieure.</>
          )}
        </p>
      </div>

      {erreur && <p className="text-xs" style={{ color: '#F87171' }}>Échec : {erreur}</p>}
      {message && <p className="text-xs" style={{ color: '#34D399' }}>{message}</p>}

      <button onClick={enregistrer} disabled={envoi}
        className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
        style={{ minHeight: 48, background: '#2563EB', color: '#fff' }}>
        <Save className="w-4 h-4" aria-hidden />
        {envoi ? 'Publication…' : `Publier la révision ${revision + 1}`}
      </button>
    </div>
  );
}

export function BriefingOperationnel({ centreId }: { centreId: string }) {
  return <ErrorBoundary><OperationnelInner centreId={centreId} /></ErrorBoundary>;
}
