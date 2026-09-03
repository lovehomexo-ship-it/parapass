import { useEffect, useState, type ComponentType } from 'react';
import { CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { surface, enTeteSection, action, SEVERITE_COULEUR, type Severite } from '../lib/jetons';
import { ErrorBoundary } from './ErrorBoundary';
import { useMeteoAltitude, indexHeureCourante, kmhEnKt } from '../lib/meteoAltitude';
import { useCurrencyRules } from '../lib/currency';
import { evaluerTousPublics, type SeuilsPublic, type MesuresMeteo, type Feu } from '../lib/meteoPublics';
import {
  verdictMeteo, computeReadiness, DEFAULT_METEO_SEUILS,
  type MeteoSeuils, type MeteoLevel, type PresentDecision,
} from '../lib/decision';

// Icônes vectorielles (famille unique) — plus d'emojis système 🟢🟠🔴.
// P13 — les feux sont des ÉTATS : ils passent par les jetons de sévérité, qui
// s'assombrissent en thème clair. Les teintes en dur (#34D399, #F87171…) n'y
// faisaient que 1,7 à 2,5:1 — invisibles sur fond clair.
const LEVEL_UI: Record<MeteoLevel, { Icon: ComponentType<{ className?: string }>; label: string; color: string; bg: string; border: string }> = {
  vert:   { Icon: CheckCircle2,  label: 'Feu vert',    ...teinte('conforme') },
  orange: { Icon: AlertTriangle, label: 'Vigilance',   ...teinte('vigilance') },
  rouge:  { Icon: XOctagon,      label: 'Défavorable', ...teinte('critique') },
};

function teinte(s: Severite) {
  const c = SEVERITE_COULEUR[s];
  return {
    color: c,
    bg: `color-mix(in srgb, ${c} 12%, transparent)`,
    border: `color-mix(in srgb, ${c} 35%, transparent)`,
  };
}

// Feux du récapitulatif par public — mêmes jetons que la grille « Qui peut
// sauter ? », pour que l'œil fasse le lien immédiatement.
const FEU_COULEUR: Record<Feu, string> = {
  vert: SEVERITE_COULEUR.conforme, orange: SEVERITE_COULEUR.vigilance, rouge: SEVERITE_COULEUR.critique,
};

function DecisionInner({ centreId }: { centreId: string }) {
  const { payload, loading: meteoLoading } = useMeteoAltitude(centreId);
  const { rules: currencyRules } = useCurrencyRules();
  const [seuils, setSeuils] = useState<MeteoSeuils>(DEFAULT_METEO_SEUILS);
  const [presents, setPresents] = useState<PresentDecision[]>([]);
  const [seuilsPublics, setSeuilsPublics] = useState<SeuilsPublic[]>([]);

  useEffect(() => {
    if (!centreId) return;
    // Seuils paramétrables (repli en dur si aucune ligne).
    supabase.from('meteo_seuils').select('*').eq('centre_id', centreId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Chargement seuils météo échoué :', error); return; }
        if (data) setSeuils(data as MeteoSeuils);
      });
  }, [centreId]);

  // « Présents prêts » vient désormais du MOTEUR D'APTITUDE (P2), plus d'un
  // second calcul local. computeReadiness ne bloquait que sur un document
  // 'expire' et jamais sur 'inconnu' : un document ABSENT passait donc pour
  // conforme, et la tuile annonçait « aucun blocage détecté » pendant que
  // l'aptitude listait trois blocages sur la même personne.
  const [aptitude, setAptitude] = useState<{ nom: string; prenom: string; statut: string; nb_blocages: number; motifs: Array<{ libelle: string; severite: string; levee: boolean }> }[] | null>(null);

  useEffect(() => {
    if (!centreId) return;
    supabase.from('meteo_seuils_public').select('*').eq('centre_id', centreId)
      .then(({ data, error }) => {
        if (error) { console.error('Seuils par public — chargement échoué :', {
          code: error.code, message: error.message, details: error.details, hint: error.hint }); return; }
        setSeuilsPublics((data ?? []) as SeuilsPublic[]);
      });
  }, [centreId]);

  useEffect(() => {
    if (!centreId) return;
    supabase.rpc('get_aptitude_du_jour', { p_centre_id: centreId })
      .then(({ data, error }) => {
        if (error) {
          console.error('Aptitude du jour (tuile décision) — échec :', {
            code: error.code, message: error.message, details: error.details, hint: error.hint,
          });
          setAptitude(null);   // on retombe alors sur l'ancien calcul, jamais sur un chiffre faux
          return;
        }
        setAptitude((data ?? []) as typeof aptitude);
      });
  }, [centreId]);

  useEffect(() => {
    if (!centreId) return;
    supabase.rpc('get_decision_du_jour', { p_centre_id: centreId })
      .then(({ data, error }) => {
        if (error) { console.error('Chargement décision du jour échoué :', error); return; }
        setPresents((data as PresentDecision[]) ?? []);
      });
  }, [centreId]);

  // Vent/rafales courants (kt) depuis le profil sol de l'heure en cours.
  const meteoCourante = (() => {
    if (!payload) return null;
    const i = indexHeureCourante(payload.times);
    return {
      ventKt: kmhEnKt(payload.sol.speed[i] ?? 0),
      rafalesKt: kmhEnKt(payload.sol.gusts[i] ?? 0),
      plafondM: null, // plafond estimé qualitativement ailleurs — n'aggrave pas le verdict ici
    };
  })();

  const verdict = meteoCourante ? verdictMeteo(meteoCourante, seuils) : null;

  // ── Récapitulatif par public — MÊME logique que la grille « Qui peut sauter ? »
  // (src/lib/meteoPublics.ts). Deux affichages, un seul calcul : la tuile ne
  // peut pas contredire la grille située plus bas sur la même page.
  const iH = payload ? indexHeureCourante(payload.times) : 0;
  const niveauLargage = payload?.niveaux
    ?.slice().sort((a, b) => Math.abs(a.altM - 4000) - Math.abs(b.altM - 4000))[0];
  const mesuresPublics: MesuresMeteo = {
    ventKt: payload ? kmhEnKt(payload.sol.speed[iH] ?? 0) : 0,
    rafalesKt: payload ? kmhEnKt(payload.sol.gusts[iH] ?? 0) : 0,
    ventAltitudeKt: niveauLargage ? kmhEnKt(niveauLargage.speed[iH] ?? 0) : null,
    plafondM: (payload?.nuages.bas[iH] ?? 0) >= 70 ? 900
            : (payload?.nuages.bas[iH] ?? 0) >= 40 ? 1500 : null,
    visibiliteKm: null,
  };
  const verdictsPublics = payload ? evaluerTousPublics(seuilsPublics, mesuresPublics) : [];
  const nbPraticables = verdictsPublics.filter(v => v.feu === 'vert').length;
  const pireFeu: Feu = verdictsPublics.some(v => v.feu === 'rouge') ? 'rouge'
                     : verdictsPublics.some(v => v.feu === 'orange') ? 'orange' : 'vert';
  // Source unique quand le moteur d'aptitude répond ; repli sur l'ancien calcul
  // seulement s'il est indisponible — mieux vaut un chiffre ancien qu'aucun.
  const readinessLocal = computeReadiness(presents, currencyRules);
  const readiness = aptitude
    ? {
        presents: aptitude.length,
        prets: aptitude.filter(a => a.statut === 'vert').length,
        bloques: aptitude.filter(a => a.statut !== 'vert').length,
        bloquesDetail: aptitude
          .filter(a => a.statut !== 'vert')
          .map(a => ({
            nom: `${a.prenom} ${a.nom}`.trim(),
            raison: a.motifs.find(m => !m.levee && m.severite === 'blocage')?.libelle
                 ?? a.motifs.find(m => !m.levee)?.libelle
                 ?? 'à vérifier',
          })),
      }
    : readinessLocal;
  const ui = verdict ? LEVEL_UI[verdict.level] : null;

  return (
    <section className="p-4 sm:p-5" style={surface(1)}>
      {/* P14.3 — 13 px / 700 / 0,08 em sur un filet qui traverse la colonne.
          Avant : 12 px gris à 2,5:1 — la structure existait dans le code, pas
          à l'écran. */}
      <h2 style={enTeteSection}>
        Décision du jour
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0, textTransform: 'none',
                       color: 'var(--c-muted)', marginLeft: 8 }}>
          l’appli informe, vous décidez
        </span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Verdict météo */}
        <div className="rounded-xl p-3 sm:col-span-1" style={{ background: ui?.bg ?? 'var(--c-hover)', border: `1px solid ${ui?.border ?? 'var(--c-border-s)'}` }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--c-text2)' }}>Météo par public</div>
          {meteoLoading && !verdict ? (
            <div className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>Chargement…</div>
          ) : verdictsPublics.length > 0 ? (
            <>
              {/* Récapitulatif de « Qui peut sauter ? » : le DT voit ici la même
                  chose que dans la grille, sans avoir à défiler. Un seul feu ne
                  pouvait pas dire qu'un vent ferme les élèves et laisse partir
                  les confirmés. */}
              <div className="text-base font-extrabold mt-0.5 flex items-center gap-1.5"
                style={{ color: FEU_COULEUR[pireFeu] }}>
                {nbPraticables}/{verdictsPublics.length} praticable{nbPraticables > 1 ? 's' : ''}
              </div>
              <ul className="mt-1 space-y-0.5">
                {verdictsPublics.map(v => (
                  <li key={v.public_cible} className="flex items-baseline gap-1.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: FEU_COULEUR[v.feu] }} aria-hidden />
                    <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--c-text2)' }}>{v.libelle}</span>
                    {v.declencheur && (
                      <span className="flex-shrink-0" style={{ color: FEU_COULEUR[v.feu] }}>{v.declencheur}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : verdict && ui ? (
            // Repli sur l'ancien feu unique tant qu'aucun seuil par public n'est
            // paramétré pour ce centre.
            <>
              <div className="text-base font-extrabold mt-0.5 flex items-center gap-1.5" style={{ color: ui.color }}>
                <ui.Icon className="w-4 h-4" /> {ui.label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--c-text2)' }}>{verdict.reason}</div>
            </>
          ) : (
            <div className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>Météo indisponible</div>
          )}
        </div>

        {/* Prêts vs bloqués */}
        <div className="rounded-xl p-3" style={{ background: 'var(--c-hover)', border: '1px solid var(--c-border-s)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--c-text2)' }}>Présents prêts</div>
          <div className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--c-text)' }}>
            {readiness.prets}<span className="text-sm font-semibold" style={{ color: 'var(--c-muted)' }}> / {readiness.presents}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: readiness.bloques > 0 ? 'var(--sev-vigilance)' : 'var(--c-muted)' }}>
            {readiness.bloques > 0 ? `${readiness.bloques} à vérifier` : 'aucun blocage détecté'}
          </div>
        </div>

        {/* Alertes bloquantes */}
        <div className="rounded-xl p-3" style={{ background: 'var(--c-hover)', border: '1px solid var(--c-border-s)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--c-text2)' }}>À vérifier</div>
          {readiness.bloquesDetail.length === 0 ? (
            <div className="text-sm mt-1 font-medium" style={{ color: 'var(--sev-conforme)' }}>Rien à vérifier</div>
          ) : (
            <>
              <div className="text-2xl font-extrabold mt-0.5" style={{ color: SEVERITE_COULEUR.vigilance }}>
                {readiness.bloquesDetail.length}
              </div>
              {/* Règle 3 : les motifs ont UN endroit qui fait autorité, le
                  tableau « Sur le terrain ». Ici on renvoie, on ne redit pas. */}
              <button type="button" style={action('texte')}
                onClick={() => document.getElementById('sur-le-terrain')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                voir qui, sur le terrain
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/** Bloc « Décision du jour » — synthèse en tête du dashboard DT. Informe et
 *  alerte, ne décide ni n'interdit rien. Sous ErrorBoundary : un souci de calcul
 *  n'emporte pas le dashboard. */
export function DecisionDuJour({ centreId }: { centreId: string | undefined }) {
  if (!centreId) return null;
  return <ErrorBoundary><DecisionInner centreId={centreId} /></ErrorBoundary>;
}
