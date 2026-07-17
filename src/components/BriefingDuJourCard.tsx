import { Megaphone, CheckCircle, WifiOff, CloudOff } from 'lucide-react';
import { useBriefingDuJour, useBriefingAck } from '../lib/briefing';
import { BriefingScene } from './BriefingScene';

/** Carte « Briefing du jour » côté jumpeur : circuit du jour, consignes,
 *  acquittement horodaté. Fonctionne hors ligne (copie locale + file d'acquittements). */
export function BriefingDuJourCard({ dzId, userId }: { dzId: string | undefined; userId: string | undefined }) {
  const { settings, briefing, circuit, backgroundUrl, offline } = useBriefingDuJour(dzId);
  const { ackAt, pending, acknowledge, error } = useBriefingAck(briefing?.id, userId);

  // Pas de briefing publié aujourd'hui (et rien en cache) : la carte ne s'affiche pas
  if (!briefing || !settings) return null;

  const dateFr = new Date(briefing.date_briefing).toLocaleDateString('fr-FR');

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4" style={{ color: '#F97316' }} />
          <h3 className="text-sm font-bold text-white">Briefing du jour</h3>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Vent {briefing.vent_direction_deg}°{briefing.vent_vitesse_kt != null ? ` · ${briefing.vent_vitesse_kt} kt` : ''}
          </span>
        </div>
        {offline && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(148,163,184,0.15)', color: '#CBD5E1', border: '1px solid rgba(148,163,184,0.3)' }}>
            <WifiOff className="w-3 h-3" /> briefing du {dateFr} — hors ligne
          </span>
        )}
      </div>

      <div className="px-4">
        <BriefingScene
          settings={settings}
          circuit={circuit}
          vent={{ direction_deg: briefing.vent_direction_deg, vitesse_kt: briefing.vent_vitesse_kt }}
          backgroundUrl={backgroundUrl}
          mode="view"
        />
      </div>

      <div className="px-4 py-3">
        {briefing.consignes && (
          <p className="text-sm leading-relaxed mb-3 font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
            📢 {briefing.consignes}
          </p>
        )}
        {error && <p className="text-xs mb-2" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>}
        {ackAt ? (
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#34D399' }}>
            <CheckCircle className="w-4 h-4" />
            Briefing acquitté à {new Date(ackAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {pending && (
              <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: '#CBD5E1' }}>
                <CloudOff className="w-3 h-3" /> sera synchronisé à la reconnexion
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={acknowledge}
            className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: '#F97316', boxShadow: '0 4px 12px rgba(249,115,22,0.3)', minHeight: 48 }}
          >
            J'ai pris connaissance du briefing
          </button>
        )}
      </div>
    </div>
  );
}
