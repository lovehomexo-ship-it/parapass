import { useState } from 'react';
import { Users, UserMinus, Clock } from 'lucide-react';
import { usePresencesDZ, hhmm } from '../../lib/presence';
import { TYPE_BREVET_LABELS } from '../../lib/types';

/** « Présents aujourd'hui » — état des lieux opérationnel du DT, en temps réel.
 *  Les non-acquittés du briefing d'abord (info de sécurité clé), puis par
 *  heure d'arrivée. L'appli montre, elle ne bloque ni ne relance personne. */
export function PresencesDZ({ dzId }: { dzId: string }) {
  const { rows, loading, retirer } = usePresencesDZ(dzId);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;

  const tries = [...rows].sort((a, b) => {
    if (a.briefingAcquitte !== b.briefingAcquitte) return a.briefingAcquitte ? 1 : -1;
    return a.checked_in_at.localeCompare(b.checked_in_at);
  });

  return (
    <div className="rounded-2xl p-4 mb-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5" style={{ color: '#60A5FA' }} />
        <h2 className="text-sm font-bold text-white">
          {rows.length === 0 ? 'Présents aujourd\'hui' : `${rows.length} parachutiste${rows.length > 1 ? 's' : ''} présent${rows.length > 1 ? 's' : ''}`}
        </h2>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--c-dim)' }}>mise à jour en direct</span>
      </div>

      {error && (
        <p className="text-xs mb-2" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>
      )}

      {tries.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--c-dim)' }}>
          Personne ne s'est encore déclaré présent — les parachutistes se déclarent depuis leur téléphone.
        </p>
      ) : (
        <div className="space-y-1">
          {tries.map(p => (
            <div key={p.id} className="flex items-center gap-3 flex-wrap rounded-xl px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.briefingAcquitte ? 'rgba(255,255,255,0.06)' : 'rgba(249,115,22,0.35)'}` }}>
              <span className="text-sm font-semibold text-white">
                {p.prenom} {p.nom}
                {p.brevet && <span className="text-xs font-normal ml-1.5" style={{ color: 'var(--c-dim)' }}>{TYPE_BREVET_LABELS[p.brevet] ?? p.brevet}</span>}
              </span>
              <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--c-text2)' }}>
                <Clock className="w-3 h-3" /> {hhmm(p.heure_debut)} – {hhmm(p.heure_fin)}
                {/* La fin déclarée est indicative : dépassée = signalée, jamais masquée.
                    Seul « Je quitte » ou le retrait DT sort de la liste. */}
                {hhmm(p.heure_fin) < new Date().toTimeString().substring(0, 5) && (
                  <span className="text-[10px]" style={{ color: 'var(--c-dim)' }}>(fin déclarée dépassée)</span>
                )}
              </span>
              <span className="text-xs" style={{ color: 'var(--c-text2)' }}>
                {p.materiel_type === 'location'
                  ? `Location — voile n°${p.voile_location_ref ?? '?'}`
                  : `Voile perso — ${p.voile_perso_nom ?? p.voile_perso_libre ?? 'non précisée'}`}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 ml-auto"
                style={p.briefingAcquitte
                  ? { background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }
                  : { background: 'rgba(249,115,22,0.12)', color: '#FDBA74', border: '1px solid rgba(249,115,22,0.35)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.briefingAcquitte ? '#34D399' : '#F97316' }} />
                {p.briefingAcquitte ? 'Briefing OK' : 'Briefing non acquitté'}
              </span>
              <button
                onClick={async () => { setError(null); const err = await retirer(p.id); if (err) setError(err); }}
                title="Retirer de la liste (parti sans se déclarer) — réversible si la personne se re-déclare"
                aria-label={`Retirer ${p.prenom} ${p.nom}`}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--c-dim)' }}>
                <UserMinus className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
