import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Users, ListOrdered, Plane, Hourglass } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Avatar } from '../../components/Avatar';
import { surface } from '../../lib/jetons';
import { ymdLocal } from '../../lib/datetime';
import { Colonnes, Barres, CarteStats, TuileStat } from '../../components/stats/Graphiques';

// ═══════════════════════════════════════════════════════════════════════════
// STATISTIQUES DU CENTRE.
//
// CE QUI N'ALLAIT PAS. Trois cartes blanches codées en dur (illisibles en
// thème sombre), des sauts comptés pour les MEMBRES où qu'ils aient sauté, un
// top 5 calculé sur des lignes tronquées à 1 000, et aucune période : on ne
// pouvait ni comparer, ni répondre à « est-ce qu'on fait mieux que l'an
// dernier ? ».
//
// CE QUE ÇA DEVIENT, dans la grammaire du tableau de bord :
//   • une période choisie en un geste (30 j, 3 mois, 12 mois, depuis janvier),
//     comparée à la période précédente de même durée ;
//   • quatre tuiles à grands chiffres, chacune avec sa variation ;
//   • l'évolution dans le temps (semaines ou mois selon la période) ;
//   • la répartition — nature des sauts, jours de la semaine, brevets ;
//   • les parachutistes les plus actifs.
//
// Tout vient d'une seule fonction en base, `statistiques_centre` : un saut
// compte pour le centre où il a eu lieu, validé ou historique ; les sauts en
// attente de signature sont montrés à part, jamais mélangés.
// ═══════════════════════════════════════════════════════════════════════════

interface Stats {
  periode: { debut: string; fin: string; pas: 'week' | 'month' };
  sauts: number; sauts_prec: number;
  actifs: number; actifs_prec: number;
  tandems: number; en_attente: number; licencies: number;
  rotations: number; remplissage: number | null;
  serie: { debut: string; sauts: number; tandems: number }[];
  par_nature: { nature: string; n: number }[];
  par_jour: { jour: number; n: number }[];
  par_brevet: { brevet: string; n: number }[];
  top: { id: string; prenom: string; nom: string; photo: string | null; n: number }[];
}

type CleePeriode = '30j' | '3m' | '12m' | 'annee';
const PERIODES: { cle: CleePeriode; libelle: string; comparaison: string }[] = [
  { cle: '30j', libelle: '30 jours', comparaison: 'aux 30 jours précédents' },
  { cle: '3m', libelle: '3 mois', comparaison: 'aux 3 mois précédents' },
  { cle: '12m', libelle: '12 mois', comparaison: 'aux 12 mois précédents' },
  { cle: 'annee', libelle: 'Depuis janvier', comparaison: 'à la même durée juste avant' },
];

function bornes(cle: CleePeriode): { debut: string; fin: string } {
  const fin = new Date();
  const debut = new Date(fin);
  if (cle === '30j') debut.setDate(debut.getDate() - 29);
  // En mois entiers : une première colonne de 4 jours (« oct ») se lisait
  // comme un mois creux.
  else if (cle === '3m') debut.setMonth(debut.getMonth() - 2, 1);
  else if (cle === '12m') debut.setMonth(debut.getMonth() - 11, 1);
  else { debut.setMonth(0, 1); }
  return { debut: ymdLocal(debut), fin: ymdLocal(fin) };
}

const NATURE: Record<string, string> = {
  entrainement: 'Entraînement', tandem: 'Tandem', competition: 'Compétition',
  travail_aerien: 'Travail aérien', demonstration: 'Démonstration', formation: 'Formation',
};
const JOURS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const nf = new Intl.NumberFormat('fr-FR');

// ── Pièces ─────────────────────────────────────────────────────────────────

function Variation({ actuel, precedent }: { actuel: number; precedent: number }) {
  if (precedent === 0) {
    return <span className="text-[13px]" style={{ color: 'var(--c-dim)' }}>{actuel > 0 ? 'rien sur la période précédente' : '—'}</span>;
  }
  const pct = Math.round(((actuel - precedent) / precedent) * 100);
  const Icone = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: 'var(--c-text2)' }}
      title={`Période précédente : ${nf.format(precedent)}`}>
      <Icone className="w-3.5 h-3.5" aria-hidden />
      {pct > 0 ? '+' : ''}{pct} % <span className="font-normal" style={{ color: 'var(--c-dim)' }}>vs {nf.format(precedent)}</span>
    </span>
  );
}

// ── L'écran ────────────────────────────────────────────────────────────────

function Inner({ centreId }: { centreId: string }) {
  const [periode, setPeriode] = useState<CleePeriode>(() => {
    try { return (localStorage.getItem('parapass.stats.periode') as CleePeriode) || '12m'; } catch { return '12m'; }
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    try { localStorage.setItem('parapass.stats.periode', periode); } catch { /* sans stockage, on garde la période en mémoire */ }
    const { debut, fin } = bornes(periode);
    setErreur(null);
    supabase.rpc('statistiques_centre', { p_centre_id: centreId, p_debut: debut, p_fin: fin })
      .then(({ data, error }) => {
        if (annule) return;
        if (error) { console.error('Statistiques — lecture échouée :', error); setErreur(error.message); return; }
        setStats(data as Stats);
      });
    return () => { annule = true; };
  }, [centreId, periode]);

  const def = PERIODES.find(p => p.cle === periode)!;
  const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* ── En-tête : titre, période, sélecteur ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>Statistiques</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
            {stats ? `Du ${fmtDate(stats.periode.debut)} au ${fmtDate(stats.periode.fin)} · comparé ${def.comparaison}` : 'Lecture…'}
          </p>
        </div>
        <div role="group" aria-label="Période" className="inline-flex rounded-xl p-1 gap-1 flex-wrap" style={surface(2)}>
          {PERIODES.map(p => {
            const actif = p.cle === periode;
            return (
              <button key={p.cle} type="button" aria-pressed={actif} onClick={() => setPeriode(p.cle)}
                className="px-3 rounded-lg text-sm font-bold transition whitespace-nowrap"
                style={{ minHeight: 40, background: actif ? 'var(--action-fond)' : 'transparent', color: actif ? '#fff' : 'var(--c-muted)' }}>
                {p.libelle}
              </button>
            );
          })}
        </div>
      </div>

      {erreur && (
        // Pas de zéros sur une lecture ratée : un centre sans activité et un
        // calcul qui a échoué ne se ressemblent pas.
        <p role="alert" className="px-3 py-2 rounded-xl text-[13px]" style={{
          borderLeft: '5px solid var(--sev-critique)', color: 'var(--c-text2)',
          background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>
          Statistiques illisibles — {erreur}
        </p>
      )}

      {!stats ? (!erreur && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl animate-pulse" style={{ minHeight: 132, background: 'var(--c-card)', border: '1px solid var(--c-border)' }} />
      ))}</div>) : (
        <>
          {/* ── Les quatre chiffres ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TuileStat icone={<ListOrdered className="w-4 h-4" />} titre="Sauts au centre" valeur={nf.format(stats.sauts)}>
              <Variation actuel={stats.sauts} precedent={stats.sauts_prec} />
            </TuileStat>
            <TuileStat icone={<Users className="w-4 h-4" />} titre="Parachutistes actifs" valeur={nf.format(stats.actifs)}>
              <Variation actuel={stats.actifs} precedent={stats.actifs_prec} />
            </TuileStat>
            <TuileStat icone={<Plane className="w-4 h-4" />} titre="Remplissage des avions"
              valeur={stats.remplissage ?? '—'} unite={stats.remplissage != null ? '%' : undefined}>
              <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>
                {stats.rotations > 0 ? `moyenne sur ${stats.rotations} rotation${stats.rotations > 1 ? 's' : ''} clôturée${stats.rotations > 1 ? 's' : ''}` : 'aucune rotation clôturée'}
              </span>
            </TuileStat>
            <TuileStat icone={<Hourglass className="w-4 h-4" />} titre="Sauts à valider" valeur={nf.format(stats.en_attente)}>
              <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>
                {stats.en_attente > 0 ? 'non comptés dans le total' : 'tout est signé'}
              </span>
            </TuileStat>
          </div>

          {/* ── L'évolution ── */}
          <CarteStats titre={`Sauts par ${stats.periode.pas === 'month' ? 'mois' : 'semaine'}`}
            aide={stats.tandems > 0 ? `dont ${nf.format(stats.tandems)} tandem${stats.tandems > 1 ? 's' : ''} sur la période — détail au survol` : 'détail au survol'}>
            {stats.sauts === 0
              ? <p className="text-[13px] py-8 text-center" style={{ color: 'var(--c-dim)' }}>Aucun saut enregistré au centre sur cette période.</p>
              : <Colonnes points={stats.serie.map(p => {
                  const d = new Date(`${p.debut}T12:00:00`), mois = stats.periode.pas === 'month';
                  return { cle: p.debut,
                    court: mois ? d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', ''),
                    long: mois ? d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : `semaine du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')}`,
                    valeur: p.sauts, detail: p.tandems > 0 ? `dont ${p.tandems} tandem${p.tandems > 1 ? 's' : ''}` : undefined };
                })} />}
          </CarteStats>

          {/* ── Les répartitions ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CarteStats titre="Nature des sauts">
              <Barres total={stats.sauts}
                lignes={stats.par_nature.map(x => ({ libelle: NATURE[x.nature] ?? x.nature, n: x.n }))} />
            </CarteStats>
            <CarteStats titre="Jours de la semaine" aide="Où tombe l'activité — utile pour le planning.">
              <Barres total={stats.sauts}
                lignes={[1, 2, 3, 4, 5, 6, 7].map(j => ({ libelle: JOURS[j], n: stats.par_jour.find(x => x.jour === j)?.n ?? 0 }))} />
            </CarteStats>
            <CarteStats titre="Licenciés par brevet" aide={`${nf.format(stats.licencies)} licencié${stats.licencies > 1 ? 's' : ''} actif${stats.licencies > 1 ? 's' : ''} aujourd'hui`}>
              <Barres total={stats.licencies}
                lignes={stats.par_brevet.map(x => ({ libelle: x.brevet === 'sans brevet' ? 'Sans brevet' : `Brevet ${x.brevet}`, n: x.n }))} />
            </CarteStats>
          </div>

          {/* ── Les plus actifs ── */}
          <CarteStats titre="Les plus actifs sur la période">
            {stats.top.length === 0
              ? <p className="text-[13px] py-4 text-center" style={{ color: 'var(--c-dim)' }}>Aucun saut sur la période.</p>
              : (
                <ol className="list-none p-0 m-0 grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  {stats.top.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                      <span className="text-[15px] font-extrabold tabular-nums w-6 text-center" style={{ color: i < 3 ? 'var(--c-text)' : 'var(--c-dim)' }}>{i + 1}</span>
                      <Avatar photo={p.photo} prenom={p.prenom} nom={p.nom} taille={32} />
                      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{p.prenom} {p.nom}</span>
                      <span className="text-sm tabular-nums" style={{ color: 'var(--c-text2)' }}>
                        <strong style={{ color: 'var(--c-text)' }}>{nf.format(p.n)}</strong> saut{p.n > 1 ? 's' : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
          </CarteStats>

          <p className="text-[13px]" style={{ color: 'var(--c-dim)' }}>
            Un saut compte pour le centre où il a eu lieu, validé ou repris d'un carnet existant. Les sauts en soufflerie ne sont pas comptés.
          </p>
        </>
      )}
    </div>
  );
}

export function StatistiquesCentre({ centreId }: { centreId: string | undefined }) {
  if (!centreId) return null;
  return <ErrorBoundary><Inner centreId={centreId} /></ErrorBoundary>;
}
