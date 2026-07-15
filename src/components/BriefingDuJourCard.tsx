import { useEffect, useState } from 'react';
import { Megaphone, CheckCircle } from 'lucide-react';
import { getSignedUrl } from '../lib/usePassport';
import { useBriefingDuJour, useBriefingAck } from '../lib/briefing';
import { BriefingScene } from './BriefingScene';

/** Carte « Briefing du jour » côté jumpeur : scène compacte + consignes +
 *  acquittement horodaté. Republication = badge « mis à jour — à relire ». */
export function BriefingDuJourCard({ dzId, userId }: { dzId: string | undefined; userId: string | undefined }) {
  const { settings, briefing } = useBriefingDuJour(dzId);
  const { ackAt, acknowledge, error } = useBriefingAck(briefing?.id, userId);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!settings?.image_fond_url) { setBgUrl(null); return; }
    getSignedUrl(settings.image_fond_url).then(setBgUrl);
  }, [settings?.image_fond_url]);

  // Pas de briefing publié aujourd'hui : la carte ne s'affiche pas
  if (!briefing || !settings) return null;

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4" style={{ color: '#F97316' }} />
          <h3 className="text-sm font-bold text-white">Briefing du jour</h3>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Vent {briefing.wind_direction_deg}°{briefing.wind_speed_kt != null ? ` · ${briefing.wind_speed_kt} kt` : ''}
          </span>
        </div>
        {briefing.version > 1 && !ackAt && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.35)' }}>
            mis à jour — à relire
          </span>
        )}
      </div>

      <div className="px-4">
        <BriefingScene briefing={briefing} settings={settings} backgroundUrl={bgUrl} mode="view" />
      </div>

      <div className="px-4 py-3">
        {briefing.consignes && (
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
            📢 {briefing.consignes}
          </p>
        )}
        {error && (
          <p className="text-xs mb-2" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>
        )}
        {ackAt ? (
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#34D399' }}>
            <CheckCircle className="w-4 h-4" />
            Briefing acquitté à {new Date(ackAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        ) : (
          <button
            onClick={acknowledge}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: '#F97316', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}
          >
            J'ai pris connaissance du briefing
          </button>
        )}
      </div>
    </div>
  );
}
