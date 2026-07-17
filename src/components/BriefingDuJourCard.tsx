import { Megaphone, CheckCircle, WifiOff, CloudOff, ChevronDown } from 'lucide-react';
import { useBriefingDuJour, useBriefingAck } from '../lib/briefing';
import { BriefingScene } from './BriefingScene';

/** Bloc « Briefing du jour » côté jumpeur : bandeau d'appel (tant que non
 *  acquitté) + carte avec scène, consignes et acquittement horodaté.
 *  Un briefing est périssable : rien ne s'accumule, aucune relance — le
 *  lendemain sans nouveau briefing, il ne reste rien à l'écran.
 *  Fonctionne hors ligne (copie locale + file d'acquittements). */
export function BriefingDuJourBlock({ dzId, dzNom, userId }: { dzId: string | undefined; dzNom?: string; userId: string | undefined }) {
  const { settings, briefing, circuit, backgroundUrl, offline, loadError, refresh } = useBriefingDuJour(dzId);
  const { ackAt, stale, pending, saving, acknowledge, error } = useBriefingAck(briefing?.id, userId, briefing?.published_at);

  // Échec de chargement SANS copie locale : on le dit au lieu de ne rien monter
  if (loadError) {
    return (
      <div className="mb-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.3)' }}>
        <span className="text-sm" style={{ color: '#CBD5E1' }}>
          ⚠️ Briefing{dzNom ? ` — ${dzNom}` : ''} : {loadError}
        </span>
        <button onClick={refresh} className="text-sm font-bold px-4 rounded-lg text-white flex-shrink-0"
          style={{ background: '#475569', minHeight: 44 }}>
          Réessayer
        </button>
      </div>
    );
  }

  // Pas de briefing publié AUJOURD'HUI (et rien en cache) : rien ne s'affiche
  if (!briefing || !settings) return null;

  const cardId = `briefing-card-${briefing.id}`;
  const dateFr = new Date(briefing.date_briefing).toLocaleDateString('fr-FR');

  return (
    <>
      {/* Bandeau — informe sans jamais bloquer ; disparaît dès l'acquittement.
          Acquittement antérieur à la republication = périmé → « à relire ». */}
      {!ackAt && (
        <div
          className="mb-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: 'rgba(249,115,22,0.14)', border: '1.5px solid rgba(249,115,22,0.45)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone className="w-4 h-4 flex-shrink-0" style={{ color: '#FB923C' }} />
            {/* Contraste fort : lisible au soleil */}
            <span className="text-sm font-extrabold" style={{ color: '#FFEDD5' }}>
              {stale ? 'À relire — briefing mis à jour' : 'Briefing du jour à consulter'}
              {dzNom ? ` — ${dzNom}` : ''}
            </span>
          </div>
          <button
            onClick={() => document.getElementById(cardId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-1.5 text-sm font-bold px-5 rounded-lg text-white flex-shrink-0"
            style={{ background: '#F97316', minHeight: 44 }}
          >
            Ouvrir <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Carte briefing */}
      <div id={cardId} className="rounded-2xl overflow-hidden mb-3 scroll-mt-24" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4" style={{ color: '#F97316' }} />
            <h3 className="text-sm font-bold text-white">Briefing du jour{dzNom ? ` — ${dzNom}` : ''}</h3>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Vent {briefing.vent_direction_deg}°{briefing.vent_vitesse_kt != null ? ` · ${briefing.vent_vitesse_kt} kt` : ''}
            </span>
            {stale && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.35)' }}>
                mis à jour — à relire
              </span>
            )}
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
            <div className="flex items-center gap-2 text-sm font-semibold flex-wrap" style={{ color: '#34D399' }}>
              <CheckCircle className="w-4 h-4" />
              Acquitté à {new Date(ackAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {pending && (
                <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: '#CBD5E1' }}>
                  <CloudOff className="w-3 h-3" /> sera synchronisé à la reconnexion
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={acknowledge}
              disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: '#F97316', boxShadow: '0 4px 12px rgba(249,115,22,0.3)', minHeight: 48 }}
            >
              {saving ? 'Enregistrement…' : 'J\'ai pris connaissance du briefing'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
