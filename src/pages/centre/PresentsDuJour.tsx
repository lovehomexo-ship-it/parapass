import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Avatar } from '../../components/Avatar';
import {
  MapPin, AlertTriangle, RefreshCw, Plane, Users, Search, Package, Clock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// QUI EST SUR LE TERRAIN — la liste, en une ligne par personne.
//
// La donnée existait depuis longtemps : `dz_presences`, alimentée par le
// check-in que le parachutiste fait lui-même. Mais elle n'était lue que de
// biais — l'encadrement comptait des têtes, l'avionnage composait des
// rotations. Aucun écran ne répondait à la question la plus simple qu'un DT se
// pose le matin : QUI EST LÀ, ET AVEC QUOI ?
//
// CE QUI VIENT D'ÊTRE CORRIGÉ. La première version posait une carte par
// personne : trois lignes de hauteur pour un nom, une heure et une voile. Vingt
// présents tenaient sur deux écrans et demi, et comparer deux personnes
// supposait de faire défiler entre les deux. Une liste de présence se lit en
// BALAYANT : le regard descend une colonne, il ne saute pas de bulle en bulle.
// Donc une ligne par personne, les mêmes informations toujours au même endroit
// horizontal, et la densité qui permet de voir tout le hangar d'un coup.
//
// Quatre partis pris :
//
//   • LA DATE EST UN CHAMP. « Qui était là samedi dernier » est une question
//     aussi légitime que « qui est là maintenant » — pour un compte rendu, une
//     déclaration, ou après un incident.
//
//   • PRÉSENT ET REPARTI SONT SÉPARÉS. Quelqu'un qui a plié bagage ne doit pas
//     se compter dans les têtes du hangar, mais il ne doit pas disparaître non
//     plus : il était là.
//
//   • LES CHIFFRES DU BANDEAU SONT DES FILTRES. Un compteur sur lequel on ne
//     peut pas cliquer oblige à chercher soi-même les quatre personnes qu'il
//     annonce. « 6 sacs du centre » doit donner la liste des six.
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
  qualifications: string[] | null;
  encadrant: boolean;
  heure_debut: string | null;
  heure_fin: string | null;
  statut: string;
  materiel_type: string | null;
  voile: string | null;
  surface_ft2: number | null;
  sac_nom: string | null;
  sac_statut: string | null;
  checked_in_at: string | null;
  position_file: number | null;
  embarque: boolean;
  sauts_du_jour: number;
  total_sauts: number;
  demo: boolean;
}

type Filtre = 'tous' | 'encadrants' | 'file' | 'materiel_dz' | 'sans_materiel';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—');

/** La voile, en une chaîne, sans jamais répéter la surface.
 *  Certains modèles SONT le chiffre de surface — « 182 ». Les afficher tous
 *  les deux donnait « 182 182 ft² ». */
function libelleVoile(p: Present): string | null {
  const surface = p.surface_ft2 ? `${p.surface_ft2} ft²` : null;
  if (!p.voile) return surface;
  if (surface && p.voile.trim() === String(p.surface_ft2)) return surface;
  // Sur un sac du centre, la base retombe sur le nom du sac faute de voile
  // personnelle : la ligne affichait « ROP-01 · ROP-01 260 ft² ». Le nom du sac
  // est déjà écrit juste avant ; ici on ne garde que la surface.
  if (p.sac_nom && p.voile.trim() === p.sac_nom.trim()) return surface;
  return [p.voile, surface].filter(Boolean).join(' ');
}

function Pastille({ actif, onClick, couleur, children }: {
  actif: boolean; onClick: () => void; couleur: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif}
      className="text-xs px-2.5 rounded-full font-semibold inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
      style={{
        minHeight: 32,
        background: actif ? `color-mix(in srgb, ${couleur} 20%, transparent)` : 'var(--c-surface)',
        color: actif ? couleur : 'var(--c-muted)',
        border: `1px solid ${actif ? couleur : 'var(--c-border)'}`,
      }}>
      {children}
    </button>
  );
}

// ─── Une ligne ────────────────────────────────────────────────────────────────
// Trois zones à position fixe : identité, matériel, activité. Le regard apprend
// la position une fois et ne la cherche plus.

function Ligne({ p }: { p: Present }) {
  const parti = p.statut === 'parti';
  const quals = p.qualifications ?? [];
  const visibles = quals.slice(0, 2);
  const reste = quals.length - visibles.length;
  const voile = libelleVoile(p);
  const dz = p.materiel_type === 'location';

  return (
    <div className="px-2.5 py-1.5 flex items-center gap-x-2.5 gap-y-1 flex-wrap sm:flex-nowrap"
      style={{
        borderBottom: '1px solid var(--c-border)',
        opacity: parti ? 0.55 : 1,
      }}>
      {/* IDENTITÉ — nom, niveau, expérience. Le visage et le nom ne se séparent
          jamais : en dessous de `sm` ils prennent la ligne entière, le reste
          passe dessous. Les colonnes à largeur fixe, elles, ne tiennent pas sur
          un téléphone — elles ne s'imposent qu'à partir de `sm`. */}
      <div className="flex items-center gap-2.5 min-w-0 basis-full sm:basis-0 sm:flex-1">
        <Avatar photo={p.photo_profil_url} prenom={p.prenom} nom={p.nom} taille={28} />
        <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
          <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>
            {p.prenom} {p.nom}
          </span>
          {p.brevet && (
            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#FDBA74' }}>{p.brevet}</span>
          )}
          {/* L'EXPÉRIENCE EST UNE INFORMATION DE SÉCURITÉ. Un B à 70 sauts et un
              B à 600 ne se briefent pas pareil ; le brevet seul ne le dit pas. */}
          {p.total_sauts > 0 && (
            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--c-dim)' }}>
              {p.total_sauts}&nbsp;sauts
            </span>
          )}
          {p.demo && (
            <span className="text-[9px] px-1 rounded flex-shrink-0"
              style={{ background: 'var(--c-border)', color: 'var(--c-dim)' }}>démo</span>
          )}
        </div>
        </div>
      </div>

      {/* COMPÉTENCES — ce que la personne sait faire, pas seulement son niveau.
          Deux au plus : au-delà, le reste tient dans l'infobulle. Un DT cherche
          ses largueurs et ses moniteurs, pas la liste exhaustive. */}
      <div className="flex items-center gap-1 min-w-0 flex-1 basis-full sm:basis-0">
        {visibles.map(q => (
          <span key={q} title={q}
            className="text-[10px] px-1.5 rounded-full truncate" style={{
              maxWidth: 150, lineHeight: '18px',
              background: 'rgba(16,185,129,0.12)', color: '#6EE7B7',
              border: '1px solid rgba(16,185,129,0.25)',
            }}>{q}</span>
        ))}
        {reste > 0 && (
          <span title={quals.join(' · ')} className="text-[10px] flex-shrink-0"
            style={{ color: '#6EE7B7' }}>+{reste}</span>
        )}
      </div>

      {/* MATÉRIEL — et à qui il est. Un sac du centre se nomme : c'est celui
          qu'il faudra retrouver au soir s'il manque. */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-none sm:w-[190px]">
        <Package className="w-3 h-3 flex-shrink-0"
          style={{ color: dz ? '#93C5FD' : 'var(--c-dim)' }} aria-hidden />
        {voile || p.sac_nom ? (
          <span className="text-[11px] truncate" style={{ color: 'var(--c-text2)' }}>
            {dz && <span style={{ color: '#93C5FD', fontWeight: 700 }}>DZ&nbsp;</span>}
            {p.sac_nom ? `${p.sac_nom}${voile ? ` · ${voile}` : ''}` : voile}
          </span>
        ) : (
          // P1 — une absence de matériel se dit, elle ne se devine pas au vide.
          <span className="text-[11px]" style={{ color: 'var(--sev-vigilance)' }}>non déclaré</span>
        )}
      </div>

      {/* CRÉNEAU */}
      <div className="flex items-center gap-1 flex-shrink-0 sm:w-[104px]">
        <Clock className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--c-muted)' }}>
          {hhmm(p.heure_debut)}{p.heure_fin ? `–${hhmm(p.heure_fin)}` : ''}
        </span>
      </div>

      {/* ACTIVITÉ */}
      <div className="flex items-center gap-1.5 flex-shrink-0 justify-end sm:w-[118px]">
        {p.sauts_du_jour > 0 && (
          <span className="text-[10px] font-bold px-1.5 rounded-full tabular-nums"
            style={{ lineHeight: '18px', background: 'rgba(96,165,250,0.15)', color: '#93C5FD' }}>
            {p.sauts_du_jour} saut{p.sauts_du_jour > 1 ? 's' : ''}
          </span>
        )}
        {p.embarque ? (
          <span className="text-[10px] font-bold px-1.5 rounded-full inline-flex items-center gap-1"
            style={{ lineHeight: '18px', background: 'rgba(16,185,129,0.15)', color: '#6EE7B7' }}>
            <Plane className="w-3 h-3" aria-hidden /> embarqué
          </span>
        ) : p.position_file !== null ? (
          <span className="text-[10px] font-bold px-1.5 rounded-full"
            style={{ lineHeight: '18px', background: 'rgba(249,115,22,0.15)', color: '#FDBA74' }}>
            file&nbsp;#{p.position_file}
          </span>
        ) : null}
        {parti && (
          <span className="text-[10px] px-1.5 rounded-full"
            style={{ lineHeight: '18px', background: 'var(--c-border)', color: 'var(--c-dim)' }}>reparti</span>
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
  const [filtre, setFiltre] = useState<Filtre>('tous');

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

  // LES COMPTEURS SE CALCULENT SUR LE TERRAIN, PAS SUR LA VUE FILTRÉE. Sinon
  // cliquer « encadrants » ferait tomber « 18 présents » à 9, et le bandeau
  // mentirait sur l'état du hangar.
  const surLeTerrain = useMemo(() => rows.filter(r => r.statut !== 'parti'), [rows]);
  const cpt = useMemo(() => ({
    presents: surLeTerrain.length,
    encadrants: surLeTerrain.filter(r => r.encadrant).length,
    file: surLeTerrain.filter(r => r.position_file !== null || r.embarque).length,
    materielDz: surLeTerrain.filter(r => r.materiel_type === 'location').length,
    sansMateriel: surLeTerrain.filter(r => !r.voile && !r.sac_nom).length,
    sauts: surLeTerrain.reduce((n, r) => n + r.sauts_du_jour, 0),
    partis: rows.length - surLeTerrain.length,
  }), [rows, surLeTerrain]);

  const texte = recherche.trim().toLowerCase();
  const visibles = useMemo(() => rows.filter(r => {
    if (texte && !`${r.prenom} ${r.nom}`.toLowerCase().includes(texte)) return false;
    switch (filtre) {
      case 'encadrants': return r.encadrant;
      case 'file': return r.position_file !== null || r.embarque;
      case 'materiel_dz': return r.materiel_type === 'location';
      case 'sans_materiel': return !r.voile && !r.sac_nom;
      default: return true;
    }
  }), [rows, texte, filtre]);

  const presents = visibles.filter(r => r.statut !== 'parti');
  const partis = visibles.filter(r => r.statut === 'parti');
  const aujourdhui = date === new Date().toISOString().slice(0, 10);
  const bascule = (f: Filtre) => setFiltre(v => (v === f ? 'tous' : f));

  return (
    <div className="space-y-3">
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

      {/* LE BANDEAU EST LA TABLE DES MATIÈRES DE LA JOURNÉE — et chaque chiffre
          mène à ses lignes. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold pr-1" style={{ color: 'var(--c-text)' }}>
          <Users className="w-4 h-4" style={{ color: 'var(--c-muted)' }} aria-hidden />
          {cpt.presents} sur le terrain
        </span>
        <Pastille actif={filtre === 'encadrants'} onClick={() => bascule('encadrants')} couleur="#6EE7B7">
          {cpt.encadrants} encadrant{cpt.encadrants > 1 ? 's' : ''}
        </Pastille>
        <Pastille actif={filtre === 'file'} onClick={() => bascule('file')} couleur="#FDBA74">
          {cpt.file} en file ou embarqué{cpt.file > 1 ? 's' : ''}
        </Pastille>
        <Pastille actif={filtre === 'materiel_dz'} onClick={() => bascule('materiel_dz')} couleur="#93C5FD">
          {cpt.materielDz} sac{cpt.materielDz > 1 ? 's' : ''} du centre
        </Pastille>
        {/* Un présent sans matériel déclaré n'est pas une anomalie de saisie :
            c'est quelqu'un dont on ne sait pas sous quoi il va voler. */}
        {cpt.sansMateriel > 0 && (
          <Pastille actif={filtre === 'sans_materiel'} onClick={() => bascule('sans_materiel')} couleur="var(--sev-vigilance)">
            {cpt.sansMateriel} sans matériel déclaré
          </Pastille>
        )}
        <span className="text-xs" style={{ color: 'var(--c-dim)' }}>
          · {cpt.sauts} saut{cpt.sauts > 1 ? 's' : ''} aujourd’hui
          {cpt.partis > 0 && ` · ${cpt.partis} reparti${cpt.partis > 1 ? 's' : ''}`}
          {!aujourdhui && ' · journée passée'}
        </span>
      </div>

      {chargement ? null : rows.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>
          Personne ne s’est déclaré présent {aujourdhui ? 'aujourd’hui' : 'ce jour-là'}.
        </p>
      ) : visibles.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>
          Aucun présent ne correspond à ce filtre.
        </p>
      ) : (
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          {presents.map(p => <Ligne key={p.user_id} p={p} />)}
          {partis.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1"
                style={{ color: 'var(--c-dim)', background: 'var(--c-border)' }}>Repartis</p>
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
