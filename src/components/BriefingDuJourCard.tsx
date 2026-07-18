import { useState } from 'react';
import { Megaphone, CheckCircle, WifiOff, CloudOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useBriefingDuJour, useBriefingAck } from '../lib/briefing';
import { BriefingScene } from './BriefingScene';

/** Bloc « Briefing du jour » côté jumpeur — rendu à DEUX emplacements du
 *  dashboard, l'état d'acquittement étant partagé entre les instances :
 *  - position « haut » : visible tant que NON acquitté (ou à relire) —
 *    bandeau d'appel + carte complète, premier élément de la page ;
 *  - position « bas » : visible une fois acquitté — version compacte
 *    repliée, consultable sans monopoliser le haut de l'écran.
 *  La bascule est immédiate (état local partagé, pas de rechargement) ; une
 *  republication rend l'acquittement périmé et fait remonter le bloc en haut.
 *  Un briefing est périssable : rien ne s'accumule, aucune relance.
 *  Fonctionne hors ligne (copie locale + file d'acquittements). */
export function BriefingDuJourBlock({ dzId, dzNom, userId, position = 'haut' }: {
  dzId: string | undefined; dzNom?: string; userId: string | undefined; position?: 'haut' | 'bas';
}) {
  const { settings, briefing, circuit, backgroundUrl, offline, loadError, refresh } = useBriefingDuJour(dzId);
  const { ackAt, stale, pending, saving, acknowledge, error } = useBriefingAck(briefing?.id, userId, briefing?.published_at);
  const [deplie, setDeplie] = useState(false);

  // Position basse : uniquement une fois acquitté — version compacte repliée
  if (position === 'bas') {
    if (!briefing || !settings || !ackAt) return null;
    return (
      <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setDeplie(d => !d)}
          className="w-full px-4 py-3 flex items-center gap-2 flex-wrap text-left"
          style={{ minHeight: 48 }}
        >
          <Megaphone className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(249,115,22,0.7)' }} />
          <span className="text-sm font-bold text-white">Briefing du jour{dzNom ? ` — ${dzNom}` : ''}</span>
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#34D399' }}>
            <CheckCircle className="w-3.5 h-3.5" />
            Acquitté à {new Date(ackAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {pending && <CloudOff className="w-3.5 h-3.5" style={{ color: '#CBD5E1' }} />}
          <span className="ml-auto flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {deplie ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {deplie && (
          <div className="px-4 pb-4">
            <BriefingScene
              settings={settings}
              circuit={circuit}
              vent={{ direction_deg: briefing.vent_direction_deg, vitesse_kt: briefing.vent_vitesse_kt }}
              backgroundUrl={backgroundUrl}
              mode="view"
            />
            {briefing.consignes && (
              <p className="text-sm leading-relaxed mt-3 font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                📢 {briefing.consignes}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Position haute : visible tant que non acquitté (ou à relire) ──

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

  // Pas de briefing publié AUJOURD'HUI (et rien en cache) : rien ne s'affiche.
  // Une fois acquitté (confirmé), le bloc haut disparaît : l'instance basse
  // prend le relais. Pendant l'écriture on reste monté pour afficher
  // « Enregistrement… » puis, en cas d'échec, l'erreur et le retour du bandeau.
  if (!briefing || !settings || (ackAt && !saving)) return null;

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
