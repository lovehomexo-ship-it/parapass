import { useMemo, useState } from 'react';
import { ListOrdered, Timer, CalendarDays, ArrowDownUp, TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Layout } from '../components/Layout';
import { usePassport } from '../lib/usePassport';
import { getRegles } from '../data/reglesFFP';
import type { Saut } from '../lib/types';
import { NATURE_SAUT_LABELS, TYPE_BREVET_LABELS } from '../lib/types';
import { Colonnes, Barres, CarteStats, TuileStat, type Colonne } from '../components/stats/Graphiques';

// ═══════════════════════════════════════════════════════════════════════════
// MES STATISTIQUES — ce qui intéresse vraiment un parachutiste.
//
// L'ancienne page montrait six tuiles de chiffres bruts, un camembert d'un
// écran entier (une part dominée par l'ouverture commandée, une autre
// invisible en thème sombre), une courbe d'altitudes plate et des cartes qui
// débordaient du téléphone. Elle disait combien, jamais ce que ça veut dire.
//
// Celle-ci répond, dans l'ordre, à ce qu'un sauteur se demande :
//   1. est-ce que je saute plus ou moins qu'avant ?      → la période comparée
//   2. combien de temps ai-je passé en chute ?            → le temps de chute libre
//   3. suis-je à jour, mes ouvertures sont-elles saines ? → récence et sécurité
//   4. quand je saute, où, sur quoi, comment              → activité et répartitions
//   5. mes records, et le prochain palier                 → ce qu'on aime partager
// ═══════════════════════════════════════════════════════════════════════════

type Periode = '12m' | 'annee' | 'tout';
const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: '12m', libelle: '12 mois' },
  { cle: 'annee', libelle: 'Cette saison' },
  { cle: 'tout', libelle: 'Tout le carnet' },
];
const JALONS = [10, 25, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000];
const CATEGORIE_COURT: Record<string, string> = {
  OC: 'Commandée', OA: 'Automatique', OR30: 'Retardée < 30 s',
  OR60: 'Retardée < 60 s', OR60plus: 'Retardée > 60 s',
};
const nf = new Intl.NumberFormat('fr-FR');
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const jour = (iso: string) => new Date(`${iso}T12:00:00`);
const frJour = (iso: string) => jour(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const joursEntre = (a: string, b: string) => Math.round((jour(b).getTime() - jour(a).getTime()) / 864e5);

/**
 * TEMPS DE CHUTE LIBRE, ESTIMÉ depuis la hauteur de largage et d'ouverture :
 * une douzaine de secondes pour atteindre la vitesse limite (≈ 450 m), puis
 * ≈ 55 m/s. 4 000 → 1 200 m donne ~55 s, l'ordre de grandeur que connaît tout
 * sauteur. Sans hauteur d'ouverture, le saut ne compte pas : pas de chiffre
 * inventé.
 */
function chuteLibreSecondes(s: Saut): number | null {
  if (!s.hauteur_m || !s.hauteur_ouverture || s.hauteur_ouverture >= s.hauteur_m) return null;
  const d = s.hauteur_m - s.hauteur_ouverture;
  return d <= 450 ? Math.sqrt((2 * d) / 9.81) * 1.1 : 12 + (d - 450) / 55;
}
function duree(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

function Variation({ actuel, precedent, libelle }: { actuel: number; precedent: number | null; libelle: string }) {
  if (precedent === null) return null;
  if (precedent === 0) return <span className="text-[13px]" style={{ color: 'var(--c-dim)' }}>{actuel > 0 ? `rien ${libelle}` : '—'}</span>;
  const pct = Math.round(((actuel - precedent) / precedent) * 100);
  const Icone = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    // Deux lignes nettes plutôt qu'un « +33 » et un « % » séparés par le retour à la ligne.
    <span className="text-[13px]" style={{ color: 'var(--c-text2)' }}>
      <span className="inline-flex items-center gap-1 font-bold whitespace-nowrap">
        <Icone className="w-3.5 h-3.5" aria-hidden /> {pct > 0 ? '+' : ''}{pct}&nbsp;%
      </span>
      <span className="block" style={{ color: 'var(--c-dim)' }}>{libelle}</span>
    </span>
  );
}

function Ligne({ libelle, valeur, detail, alerte }: { libelle: string; valeur: React.ReactNode; detail?: string; alerte?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5" style={{ borderTop: '1px solid var(--c-border-s)' }}>
      <span className="text-sm" style={{ color: 'var(--c-text2)' }}>{libelle}</span>
      <span className="text-right">
        <span className="block text-sm font-bold tabular-nums" style={{ color: alerte ? 'var(--sev-vigilance)' : 'var(--c-text)' }}>{valeur}</span>
        {detail && <span className="block text-[13px]" style={{ color: 'var(--c-muted)' }}>{detail}</span>}
      </span>
    </div>
  );
}

export function StatsPage({ sauts }: { sauts: Saut[] }) {
  const { profile, user } = useAuth();
  const { brevets } = usePassport(user?.id);
  const brevet = brevets[0]?.type_brevet ?? null;
  const [periode, setPeriode] = useState<Periode>(() => {
    try { return (localStorage.getItem('parapass.mesStats.periode') as Periode) || '12m'; } catch { return '12m'; }
  });
  const choisir = (p: Periode) => { setPeriode(p); try { localStorage.setItem('parapass.mesStats.periode', p); } catch { /* mémoire seule */ } };

  const st = useMemo(() => {
    // Les vrais sauts, du plus ancien au plus récent (la soufflerie a ses minutes à part).
    const tous = sauts.filter(s => !s.is_tunnel && s.statut !== 'declaration_honneur')
      .sort((a, b) => a.date_saut.localeCompare(b.date_saut));
    if (tous.length === 0) return null;
    const auj = new Date();
    const fin = ymd(auj);
    let debut: string, precDebut: string | null = null, precFin: string | null = null;
    if (periode === '12m') {
      const d = new Date(auj.getFullYear(), auj.getMonth() - 11, 1); debut = ymd(d);
      precDebut = ymd(new Date(d.getFullYear() - 1, d.getMonth(), 1));
      precFin = ymd(new Date(d.getFullYear(), d.getMonth(), 0));
    } else if (periode === 'annee') {
      debut = `${auj.getFullYear()}-01-01`;
      precDebut = `${auj.getFullYear() - 1}-01-01`;
      precFin = ymd(new Date(auj.getFullYear() - 1, auj.getMonth(), auj.getDate()));
    } else {
      debut = tous[0].date_saut;
    }
    const cur = tous.filter(s => s.date_saut >= debut && s.date_saut <= fin);
    const prev = precDebut && precFin ? tous.filter(s => s.date_saut >= precDebut! && s.date_saut <= precFin!) : null;

    const secondes = (l: Saut[]) => l.reduce((t, s) => t + (chuteLibreSecondes(s) ?? 0), 0);
    const avecChute = cur.filter(s => chuteLibreSecondes(s) !== null).length;
    const jours = new Set(cur.map(s => s.date_saut));
    const moy = (v: number[]) => v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    const largageMoy = moy(cur.map(s => s.hauteur_m).filter(Boolean));
    const ouvertures = cur.map(s => s.hauteur_ouverture).filter((v): v is number => typeof v === 'number' && v > 0);
    const ouvertureMoy = moy(ouvertures);

    // ── Sécurité et récence
    const dernier = tous[tous.length - 1];
    let pause = { jours: 0, de: '', a: '' };
    for (let i = 1; i < cur.length; i++) {
      const g = joursEntre(cur[i - 1].date_saut, cur[i].date_saut);
      if (g > pause.jours) pause = { jours: g, de: cur[i - 1].date_saut, a: cur[i].date_saut };
    }
    const minimum = getRegles(brevet).hauteurOuvertureMin;
    const sousMinimum = cur.filter(s => s.hauteur_ouverture && s.hauteur_ouverture < minimum).length;
    const plusBasse = ouvertures.length ? Math.min(...ouvertures) : null;

    // ── Activité : mois (12 mois, saison) ou années (tout le carnet)
    const serie: Colonne[] = [];
    if (periode === 'tout') {
      for (let y = Number(debut.slice(0, 4)); y <= auj.getFullYear(); y++) {
        const n = cur.filter(s => s.date_saut.startsWith(String(y))).length;
        serie.push({ cle: String(y), court: `'${String(y).slice(2)}`, long: String(y), valeur: n });
      }
    } else {
      const d0 = jour(debut);
      for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= auj; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        serie.push({ cle, court: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
          long: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          valeur: cur.filter(s => s.date_saut.startsWith(cle)).length });
      }
    }

    // ── Répartitions
    const compter = (cle: (s: Saut) => string | null | undefined, n = 6) => {
      const m = new Map<string, number>();
      cur.forEach(s => { const k = cle(s); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([libelle, v]) => ({ libelle, n: v }));
    };

    // ── Records (tout le carnet)
    const plusHaut = tous.reduce((b, s) => (s.hauteur_m > b.hauteur_m ? s : b), tous[0]);
    const parJour = new Map<string, number>(); tous.forEach(s => parJour.set(s.date_saut, (parJour.get(s.date_saut) ?? 0) + 1));
    const meilleurJour = [...parJour.entries()].sort((a, b) => b[1] - a[1])[0];
    const parMois = new Map<string, number>(); tous.forEach(s => parMois.set(s.date_saut.slice(0, 7), (parMois.get(s.date_saut.slice(0, 7)) ?? 0) + 1));
    const meilleurMois = [...parMois.entries()].sort((a, b) => b[1] - a[1])[0];
    const plusLongue = tous.reduce<{ s: Saut; t: number } | null>((b, s) => {
      const t = chuteLibreSecondes(s); return t !== null && (!b || t > b.t) ? { s, t } : b;
    }, null);
    const premier = tous[0];
    const annees = Math.floor(joursEntre(premier.date_saut, fin) / 365.25);
    const palier = JALONS.find(j => j > tous.length) ?? null;

    return {
      debut, cur, prev, secondes: secondes(cur), secondesPrev: prev ? secondes(prev) : null, avecChute,
      jours: jours.size, largageMoy, ouvertureMoy, dernier, pause, minimum, sousMinimum, plusBasse, serie,
      dz: compter(s => s.lieu), avions: compter(s => s.aeronef_immat?.toUpperCase(), 5),
      natures: compter(s => NATURE_SAUT_LABELS[s.nature_saut] ?? s.nature_saut),
      categories: compter(s => CATEGORIE_COURT[s.categorie] ?? s.categorie),
      plusHaut, meilleurJour, meilleurMois, plusLongue, premier, annees, palier, total: tous.length,
      secondesTotal: secondes(tous),
    };
  }, [sauts, periode, brevet]);

  if (!profile) return null;

  if (!st) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>Statistiques</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--c-muted)' }}>Tes statistiques apparaîtront dès ton premier saut inscrit au carnet.</p>
        </div>
      </Layout>
    );
  }

  const comparaison = periode === '12m' ? 'vs les 12 mois d’avant' : 'vs l’an dernier à date';
  const jamaisRecent = (() => {
    const j = joursEntre(st.dernier.date_saut, ymd(new Date()));
    return j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} jours`;
  })();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* ── En-tête et période ── */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight" style={{ color: 'var(--c-text)' }}>Statistiques</h1>
            <p className="text-[13px]" style={{ color: 'var(--c-muted)' }}>
              {periode === 'tout' ? `Depuis ton premier saut, le ${frJour(st.debut)}` : `Depuis le ${frJour(st.debut)}`}
            </p>
          </div>
          <div role="group" aria-label="Période" className="inline-flex rounded-xl p-1 gap-1" style={{ background: 'var(--c-hover)' }}>
            {PERIODES.map(p => {
              const actif = p.cle === periode;
              return (
                <button key={p.cle} type="button" aria-pressed={actif} onClick={() => choisir(p.cle)}
                  className="px-3 rounded-lg text-sm font-bold whitespace-nowrap"
                  style={{ minHeight: 38, background: actif ? 'var(--accent-fond)' : 'transparent', color: actif ? '#fff' : 'var(--c-muted)' }}>
                  {p.libelle}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Les quatre chiffres ── */}
        <div className="grid grid-cols-2 gap-3">
          <TuileStat icone={<ListOrdered className="w-4 h-4" />} titre="Sauts" valeur={nf.format(st.cur.length)}>
            <Variation actuel={st.cur.length} precedent={st.prev ? st.prev.length : null} libelle={comparaison} />
          </TuileStat>
          <TuileStat icone={<Timer className="w-4 h-4" />} titre="Chute libre" valeur={duree(st.secondes)}>
            <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>
              estimée sur {st.avecChute} saut{st.avecChute > 1 ? 's' : ''} · {duree(st.secondesTotal)} en tout
            </span>
          </TuileStat>
          <TuileStat icone={<CalendarDays className="w-4 h-4" />} titre="Jours de saut" valeur={nf.format(st.jours)}>
            <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>
              {st.jours ? `${(st.cur.length / st.jours).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} sauts par jour` : '—'}
            </span>
          </TuileStat>
          <TuileStat icone={<ArrowDownUp className="w-4 h-4" />} titre="Largage → ouverture"
            valeur={st.largageMoy ? `${nf.format(st.largageMoy)}` : '—'} unite={st.largageMoy ? 'm' : undefined}>
            <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>
              {st.ouvertureMoy ? `ouverture moyenne ${nf.format(st.ouvertureMoy)} m` : 'ouverture non renseignée'}
            </span>
          </TuileStat>
        </div>

        {/* ── Récence et sécurité : ce que le DT regardera ── */}
        <CarteStats titre="Ma régularité et ma sécurité">
          <div className="flex items-center gap-2 mb-1">
            {st.sousMinimum === 0
              ? <><ShieldCheck className="w-5 h-5" style={{ color: 'var(--sev-conforme)' }} aria-hidden /><span className="text-sm font-semibold" style={{ color: 'var(--sev-conforme)' }}>Toutes tes ouvertures respectent le minimum de ton brevet</span></>
              : <><AlertTriangle className="w-5 h-5" style={{ color: 'var(--sev-vigilance)' }} aria-hidden /><span className="text-sm font-semibold" style={{ color: 'var(--sev-vigilance)' }}>{st.sousMinimum} ouverture{st.sousMinimum > 1 ? 's' : ''} sous le minimum de ton brevet</span></>}
          </div>
          <Ligne libelle="Dernier saut" valeur={jamaisRecent} detail={`${st.dernier.lieu} · ${frJour(st.dernier.date_saut)}`} />
          <Ligne libelle="Plus longue pause" valeur={st.pause.jours ? `${st.pause.jours} jours` : '—'}
            detail={st.pause.jours ? `du ${jour(st.pause.de).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${jour(st.pause.a).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}
            alerte={st.pause.jours > 90} />
          <Ligne libelle="Ouverture la plus basse" valeur={st.plusBasse ? `${nf.format(st.plusBasse)} m` : '—'}
            detail={`minimum ${brevet ? (TYPE_BREVET_LABELS[brevet] ?? `Brevet ${brevet}`) : 'BPA'} : ${nf.format(st.minimum)}\u00a0m`}
            alerte={st.plusBasse !== null && st.plusBasse < st.minimum} />
        </CarteStats>

        {/* ── L'activité dans le temps ── */}
        <CarteStats titre={periode === 'tout' ? 'Sauts par année' : 'Sauts par mois'} aide="Détail au survol">
          <Colonnes points={st.serie} />
        </CarteStats>

        {/* ── Où et comment ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CarteStats titre="Drop zones"><Barres total={st.cur.length} lignes={st.dz} /></CarteStats>
          <CarteStats titre="Avions"><Barres total={st.cur.length} lignes={st.avions} vide="Avion non renseigné." /></CarteStats>
          <CarteStats titre="Nature des sauts"><Barres total={st.cur.length} lignes={st.natures} /></CarteStats>
          <CarteStats titre="Type d'ouverture"><Barres total={st.cur.length} lignes={st.categories} /></CarteStats>
        </div>

        {/* ── Records, sur tout le carnet ── */}
        <CarteStats titre="Mes records" aide="Sur tout le carnet">
          <Ligne libelle="Ancienneté" valeur={st.annees >= 1 ? `${st.annees} an${st.annees > 1 ? 's' : ''}` : 'moins d’un an'}
            detail={`premier saut le ${frJour(st.premier.date_saut)}`} />
          <Ligne libelle="Plus haut largage" valeur={`${nf.format(st.plusHaut.hauteur_m)} m`} detail={`${st.plusHaut.lieu} · ${frJour(st.plusHaut.date_saut)}`} />
          {st.plusLongue && <Ligne libelle="Plus longue chute libre" valeur={`≈ ${Math.round(st.plusLongue.t)} s`}
            detail={`${nf.format(st.plusLongue.s.hauteur_m)} → ${nf.format(st.plusLongue.s.hauteur_ouverture ?? 0)} m · ${frJour(st.plusLongue.s.date_saut)}`} />}
          <Ligne libelle="Meilleure journée" valeur={`${st.meilleurJour[1]} saut${st.meilleurJour[1] > 1 ? 's' : ''}`} detail={frJour(st.meilleurJour[0])} />
          <Ligne libelle="Meilleur mois" valeur={`${st.meilleurMois[1]} sauts`}
            detail={jour(`${st.meilleurMois[0]}-15`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} />
        </CarteStats>

        {/* ── Le prochain palier ── */}
        {st.palier && (
          <CarteStats titre="Prochain palier">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--c-text)' }}>
                {nf.format(st.total)} <span className="text-[15px] font-semibold" style={{ color: 'var(--c-muted)' }}>/ {nf.format(st.palier)} sauts</span>
              </span>
              <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>encore {st.palier - st.total}</span>
            </div>
            <div className="h-2.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--c-hover)' }}>
              <div className="h-full rounded-full" style={{ width: `${(st.total / st.palier) * 100}%`, background: 'var(--accent-texte)' }} />
            </div>
          </CarteStats>
        )}

        <p className="text-[13px] pb-2" style={{ color: 'var(--c-dim)' }}>
          Chute libre estimée à partir des hauteurs de largage et d'ouverture inscrites (≈ 12 s pour atteindre la vitesse limite, puis 55 m/s). La soufflerie n'est pas comptée.
        </p>
      </div>
    </Layout>
  );
}
