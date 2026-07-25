import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { useMeteoAltitude, indexHeureCourante, kmhEnKt } from '../lib/meteoAltitude';
import { useCurrencyRules } from '../lib/currency';
import {
  verdictMeteo, computeReadiness, DEFAULT_METEO_SEUILS,
  type MeteoSeuils, type MeteoLevel, type PresentDecision,
} from '../lib/decision';

const LEVEL_UI: Record<MeteoLevel, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  vert:   { emoji: '🟢', label: 'Feu vert',  color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  orange: { emoji: '🟠', label: 'Vigilance', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  rouge:  { emoji: '🔴', label: 'Défavorable', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
};

function DecisionInner({ centreId }: { centreId: string }) {
  const { payload, loading: meteoLoading } = useMeteoAltitude(centreId);
  const { rules: currencyRules } = useCurrencyRules();
  const [seuils, setSeuils] = useState<MeteoSeuils>(DEFAULT_METEO_SEUILS);
  const [presents, setPresents] = useState<PresentDecision[]>([]);

  useEffect(() => {
    if (!centreId) return;
    // Seuils paramétrables (repli en dur si aucune ligne).
    supabase.from('meteo_seuils').select('*').eq('centre_id', centreId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Chargement seuils météo échoué :', error); return; }
        if (data) setSeuils(data as MeteoSeuils);
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
  const readiness = computeReadiness(presents, currencyRules);
  const ui = verdict ? LEVEL_UI[verdict.level] : null;

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-s)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>Décision du jour</span>
        <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>· l'appli informe, vous décidez</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Verdict météo */}
        <div className="rounded-xl p-3 sm:col-span-1" style={{ background: ui?.bg ?? 'var(--c-hover)', border: `1px solid ${ui?.border ?? 'var(--c-border-s)'}` }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>Météo</div>
          {meteoLoading && !verdict ? (
            <div className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>Chargement…</div>
          ) : verdict && ui ? (
            <>
              <div className="text-base font-extrabold mt-0.5 flex items-center gap-1.5" style={{ color: ui.color }}>
                <span>{ui.emoji}</span> {ui.label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--c-text2)' }}>{verdict.reason}</div>
            </>
          ) : (
            <div className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>Météo indisponible</div>
          )}
        </div>

        {/* Prêts vs bloqués */}
        <div className="rounded-xl p-3" style={{ background: 'var(--c-hover)', border: '1px solid var(--c-border-s)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>Présents prêts</div>
          <div className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--c-text)' }}>
            {readiness.prets}<span className="text-sm font-semibold" style={{ color: 'var(--c-muted)' }}> / {readiness.presents}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: readiness.bloques > 0 ? '#F59E0B' : 'var(--c-muted)' }}>
            {readiness.bloques > 0 ? `${readiness.bloques} à vérifier` : 'aucun blocage détecté'}
          </div>
        </div>

        {/* Alertes bloquantes */}
        <div className="rounded-xl p-3" style={{ background: 'var(--c-hover)', border: '1px solid var(--c-border-s)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>À vérifier</div>
          {readiness.bloquesDetail.length === 0 ? (
            <div className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>—</div>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {readiness.bloquesDetail.slice(0, 3).map((b, i) => (
                <li key={i} className="text-xs" style={{ color: 'var(--c-text2)' }}>
                  <span className="font-semibold" style={{ color: 'var(--c-text)' }}>{b.nom}</span> — {b.raison}
                </li>
              ))}
              {readiness.bloquesDetail.length > 3 && (
                <li className="text-[11px]" style={{ color: 'var(--c-muted)' }}>+{readiness.bloquesDetail.length - 3} autre(s)</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bloc « Décision du jour » — synthèse en tête du dashboard DT. Informe et
 *  alerte, ne décide ni n'interdit rien. Sous ErrorBoundary : un souci de calcul
 *  n'emporte pas le dashboard. */
export function DecisionDuJour({ centreId }: { centreId: string | undefined }) {
  if (!centreId) return null;
  return <ErrorBoundary><DecisionInner centreId={centreId} /></ErrorBoundary>;
}
