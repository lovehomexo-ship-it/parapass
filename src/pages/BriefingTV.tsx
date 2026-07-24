import { useParams } from 'react-router-dom';
import { useBriefingDuJour } from '../lib/briefing';
import { formatHeureParis } from '../lib/datetime';
import { BriefingScene } from '../components/BriefingScene';

/** Mode TV plein écran pour l'écran de la DZ (rechargement manuel suffisant). */
export function BriefingTVPage() {
  const { dzId } = useParams<{ dzId: string }>();
  const { settings, briefing, circuit, backgroundUrl, loading } = useBriefingDuJour(dzId);

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#020617' }}>
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!briefing || !settings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8" style={{ background: '#020617' }}>
        <div className="text-7xl mb-6">🪂</div>
        <h1 className="text-4xl font-extrabold text-white mb-3">Briefing du jour</h1>
        <p className="text-2xl capitalize mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>{today}</p>
        <p className="text-xl" style={{ color: 'rgba(255,255,255,0.35)' }}>Aucun briefing publié pour aujourd'hui.</p>
      </div>
    );
  }

  const heurePub = formatHeureParis(briefing.published_at);

  return (
    <div className="min-h-screen flex flex-col px-8 py-6" style={{ background: '#020617' }}>
      <div className="flex items-end justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold text-white">Briefing du jour</h1>
          <p className="text-lg capitalize" style={{ color: 'rgba(255,255,255,0.5)' }}>{today}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold" style={{ color: '#7DD3FC' }}>
            Vent {briefing.vent_direction_deg}°{briefing.vent_vitesse_kt != null ? ` · ${briefing.vent_vitesse_kt} kt` : ''}
          </p>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>publié à {heurePub}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-full max-w-[1500px]">
          <BriefingScene
            settings={settings}
            circuit={circuit}
            vent={{ direction_deg: briefing.vent_direction_deg, vitesse_kt: briefing.vent_vitesse_kt }}
            backgroundUrl={backgroundUrl}
            mode="view"
          />
        </div>
      </div>

      {briefing.consignes && (
        <div className="flex-shrink-0 mt-4 rounded-2xl px-8 py-5" style={{ background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.4)' }}>
          <p className="text-2xl font-bold leading-relaxed" style={{ color: '#FDE68A' }}>
            📢 {briefing.consignes}
          </p>
        </div>
      )}
    </div>
  );
}
