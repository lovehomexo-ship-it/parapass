import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Avatar } from '../../components/Avatar';
import { MapPin, AlertTriangle, RefreshCw, Plane, Users, Search } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// QUI EST SUR LE TERRAIN — la liste qui manquait.
//
// La donnée existait depuis longtemps : `dz_presences`, alimentée par le
// check-in que le parachutiste fait lui-même. Mais elle n'était lue que de
// biais — l'encadrement comptait des têtes, l'avionnage composait des
// rotations. Aucun écran ne répondait à la question la plus simple qu'un DT se
// pose le matin : QUI EST LÀ ?
//
// Trois partis pris :
//
//   • LA DATE EST UN CHAMP. « Qui était là samedi dernier » est une question
//     aussi légitime que « qui est là maintenant » — pour un compte rendu, une
//     déclaration, ou après un incident.
//
//   • PRÉSENT ET REPARTI SONT SÉPARÉS. Quelqu'un qui a plié bagage ne doit pas
//     se compter dans les têtes du hangar, mais il ne doit pas disparaître non
//     plus : il était là.
//
//   • LA PRÉSENCE SE DÉCLARE, ELLE NE SE SAISIT PAS. Le DT lit, il n'inscrit
//     personne. Un registre où le centre peut ajouter des gens n'atteste plus
//     rien. La seule action possible ici est de rafraîchir.
// ═══════════════════════════════════════════════════════════════════════════

interface Present {
  user_id: string;
  prenom: string;
  nom: string;
  photo_profil_url: string | null;
  brevet: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  statut: string;
  materiel_type: string | null;
  voile: string | null;
  surface_ft2: number | null;
  checked_in_at: string | null;
  position_file: number | null;
  embarque: boolean;
  sauts_du_jour: number;
  demo: boolean;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—');

function Ligne({ p }: { p: Present }) {
  const parti = p.statut === 'parti';
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3"
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        opacity: parti ? 0.6 : 1,
      }}>
      <Avatar photo={p.photo_profil_url} prenom={p.prenom} nom={p.nom} taille={36} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>
            {p.prenom} {p.nom}
          </span>
          {p.brevet && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(249,115,22,0.15)', color: '#FDBA74' }}>{p.brevet}</span>
          )}
          {p.demo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--c-dim)' }}>démo</span>
          )}
        </div>
        <p className="text-[11px] truncate" style={{ color: 'var(--c-muted)' }}>
          arrivé à {hhmm(p.heure_debut)}
          {/* Certains modèles de voile SONT le chiffre de surface — « 182 ».
              Les afficher tous les deux donnait « 182 182 ft² ». */}
          {p.voile
            ? ` · ${p.voile}${p.surface_ft2 && p.voile.trim() !== String(p.surface_ft2) ? ` ${p.surface_ft2} ft²` : p.surface_ft2 ? ' ft²' : ''}`
            : ' · matériel non déclaré'}
          {p.materiel_type === 'location' ? ' (location)' : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {p.sauts_du_jour > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(96,165,250,0.15)', color: '#93C5FD' }}>
            {p.sauts_du_jour} saut{p.sauts_du_jour > 1 ? 's' : ''}
          </span>
        )}
        {p.embarque ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#6EE7B7' }}>
            <Plane className="w-3 h-3" aria-hidden /> embarqué
          </span>
        ) : p.position_file !== null ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#FDBA74' }}>
            file #{p.position_file}
          </span>
        ) : null}
        {parti && (
          <span className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: 'var(--c-border)', color: 'var(--c-dim)' }}>reparti</span>
        )}
      </div>
    </div>
  );
}

function Inner({ centreId }: { centreId: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Present[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await supabase.rpc('presents_du_jour', {
      p_centre_id: centreId, p_date: date,
    });
    setChargement(false);
    if (error) {
      console.error('Lecture des présences échouée :', error);
      // Aucune liste plutôt qu'une liste fausse : annoncer « personne » parce
      // qu'une requête a échoué ferait croire le hangar vide.
      setErreur(error.message);
      setRows([]);
      return;
    }
    setErreur(null);
    setRows((data ?? []) as Present[]);
  }, [centreId, date]);

  useEffect(() => { charger(); }, [charger]);

  // Le temps réel est branché sur `dz_presences` : un check-in fait au portail
  // apparaît ici sans rechargement.
  useEffect(() => {
    const canal = supabase
      .channel(`presences-${centreId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dz_presences', filter: `dz_id=eq.${centreId}` },
        () => charger())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [centreId, charger]);

  const filtre = recherche.trim().toLowerCase();
  const visibles = filtre
    ? rows.filter(r => `${r.prenom} ${r.nom}`.toLowerCase().includes(filtre))
    : rows;
  const presents = visibles.filter(r => r.statut !== 'parti');
  const partis = visibles.filter(r => r.statut === 'parti');
  const aujourdhui = date === new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
          <MapPin className="w-6 h-6" style={{ color: '#F97316' }} aria-hidden /> Présents sur la DZ
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
          Chaque parachutiste déclare lui-même sa présence. Le centre lit ce registre, il n’y inscrit personne —
          c’est ce qui lui donne sa valeur.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          aria-label="Date des présences"
          style={{
            background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
            borderRadius: 8, padding: '8px 12px', fontSize: 13, minHeight: 40,
          }} />
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <Search className="w-4 h-4 absolute" aria-hidden
            style={{ left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-dim)' }} />
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Chercher un nom" aria-label="Chercher un nom"
            style={{
              background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
              borderRadius: 8, padding: '8px 12px 8px 32px', fontSize: 13, width: '100%', minHeight: 40,
            }} />
        </div>
        <button onClick={charger} disabled={chargement}
          className="p-2 rounded-lg disabled:opacity-50" aria-label="Rafraîchir"
          style={{ background: 'var(--c-border)', color: 'var(--c-text2)', minHeight: 40, minWidth: 40 }}>
          <RefreshCw className="w-4 h-4" aria-hidden />
        </button>
      </div>

      {erreur && (
        <div role="alert" className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--sev-critique)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden /> {erreur}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--c-text2)' }}>
        <Users className="w-4 h-4" style={{ color: 'var(--c-muted)' }} aria-hidden />
        <span><b>{presents.length}</b> sur le terrain</span>
        {partis.length > 0 && <span style={{ color: 'var(--c-dim)' }}>· {partis.length} reparti{partis.length > 1 ? 's' : ''}</span>}
        {!aujourdhui && <span style={{ color: 'var(--c-dim)' }}>· journée passée</span>}
      </div>

      {chargement ? null : rows.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>
          Personne ne s’est déclaré présent {aujourdhui ? 'aujourd’hui' : 'ce jour-là'}.
        </p>
      ) : (
        <div className="space-y-2">
          {presents.map(p => <Ligne key={p.user_id} p={p} />)}
          {partis.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide pt-2"
                style={{ color: 'var(--c-dim)' }}>Repartis</p>
              {partis.map(p => <Ligne key={p.user_id} p={p} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PresentsDuJour({ centreId }: { centreId: string }) {
  return <ErrorBoundary><Inner centreId={centreId} /></ErrorBoundary>;
}
