import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useBriefingDuJour, sensAtterrissageDerive } from '../../lib/briefing';
import { BriefingScene } from '../../components/BriefingScene';
import { Megaphone, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';

// Flèche de vent — même convention que partout : orientée dans le sens où le
// vent souffle, le chiffre indique d'où il vient.
function FlecheVent({ dirProvenance }: { dirProvenance: number }) {
  return (
    <svg width={16} height={16} viewBox="0 0 20 20" style={{ transform: `rotate(${(dirProvenance + 180) % 360}deg)` }} aria-hidden>
      <path d="M10 2 L13 11 L10 9 L7 11 Z" fill="currentColor" />
      <line x1="10" y1="9" x2="10" y2="17" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Récapitulatif du briefing du jour en tête du dashboard DZ — lecture seule,
 *  l'état d'un coup d'œil ; les actions se font dans le module complet.
 *  Réutilise useBriefingDuJour (mêmes données, même source de vérité que la
 *  publication : le circuit affiché EST celui du circuit_id publié). */
export function BriefingRecapDZ({ centreId, onOuvrir }: { centreId: string; onOuvrir: () => void }) {
  const { settings, briefing, circuit, backgroundUrl, loading } = useBriefingDuJour(centreId);
  const [acks, setAcks] = useState<number | null>(null);
  const [membres, setMembres] = useState<number | null>(null);
  const [voirPlus, setVoirPlus] = useState(false);

  // Compteur d'acquittements — même règle que le Suivi du jour :
  // seuls les acquittements >= published_at comptent. Requêtes head/count légères.
  const loadCompteur = useCallback(async () => {
    if (!briefing) return;
    const [{ count: nbAcks, error: aErr }, { count: nbMembres, error: mErr }] = await Promise.all([
      supabase.from('briefing_acknowledgements')
        .select('*', { count: 'exact', head: true })
        .eq('briefing_id', briefing.id)
        .gte('acknowledged_at', briefing.published_at),
      supabase.from('licencies_centres')
        .select('*', { count: 'exact', head: true })
        .eq('centre_id', centreId)
        .eq('statut', 'actif'),
    ]);
    if (aErr) console.error('Compteur acquittements échoué :', aErr);
    if (mErr) console.error('Compteur membres échoué :', mErr);
    if (nbAcks !== null) setAcks(nbAcks);
    if (nbMembres !== null) setMembres(nbMembres);
  }, [briefing?.id, briefing?.published_at, centreId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCompteur(); }, [loadCompteur]);
  // Vivant : Realtime sur les acquittements + filet 30 s (même mécanisme que le Suivi)
  useEffect(() => {
    if (!briefing) return;
    const channel = supabase
      .channel(`briefing-recap-${briefing.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'briefing_acknowledgements', filter: `briefing_id=eq.${briefing.id}` },
        () => loadCompteur())
      .subscribe();
    const poll = setInterval(loadCompteur, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [briefing?.id, loadCompteur]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  // ── Aucun briefing aujourd'hui : invitation, pas d'alarme ──
  if (!briefing || !settings) {
    return (
      <div className="rounded-2xl px-4 py-3 mb-5 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4" style={{ color: 'var(--c-dim)' }} />
          <span className="text-sm" style={{ color: 'var(--c-text2)' }}>Aucun briefing publié aujourd'hui.</span>
        </div>
        <button onClick={onOuvrir}
          className="flex items-center gap-1.5 text-sm font-bold px-4 rounded-lg text-white"
          style={{ background: '#F97316', minHeight: 44 }}>
          Préparer le briefing <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const heurePub = new Date(briefing.published_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  // published_at nettement après created_at (> 60 s) = republication dans la journée
  const republie = new Date(briefing.published_at).getTime() - new Date(briefing.created_at).getTime() > 60_000;
  const sensDerive = circuit ? sensAtterrissageDerive(circuit.trace) : null;
  const consignesLongues = (briefing.consignes?.length ?? 0) > 140;

  return (
    <div className="rounded-2xl p-4 mb-5" style={{ background: 'var(--c-surface)', border: '1px solid rgba(249,115,22,0.35)' }}>
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Miniature — rendu existant en réduit, non interactif (mode view) */}
        <div className="sm:w-64 flex-shrink-0 pointer-events-none">
          <BriefingScene
            settings={settings}
            circuit={circuit}
            vent={{ direction_deg: briefing.vent_direction_deg, vitesse_kt: briefing.vent_vitesse_kt }}
            backgroundUrl={backgroundUrl}
            mode="view"
          />
        </div>

        {/* État du jour */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Megaphone className="w-4 h-4 flex-shrink-0" style={{ color: '#F97316' }} />
            <h2 className="text-base font-extrabold text-white">
              Circuit du jour : <span style={{ color: '#FBBF24' }}>{circuit?.nom ?? 'circuit inconnu'}</span>
            </h2>
          </div>

          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm mb-2" style={{ color: 'var(--c-text2)' }}>
            <span className="inline-flex items-center gap-1.5" style={{ color: '#7DD3FC' }}>
              <FlecheVent dirProvenance={briefing.vent_direction_deg} />
              Vent {briefing.vent_direction_deg}°{briefing.vent_vitesse_kt != null ? ` · ${briefing.vent_vitesse_kt} kt` : ''}
            </span>
            {sensDerive !== null && <span>Atterrissage ~{sensDerive}°</span>}
            {circuit && <span>Début de circuit {circuit.altitude_debut_m} m</span>}
          </div>

          {briefing.consignes && (
            <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--c-text2)' }}>
              📢 {voirPlus || !consignesLongues ? briefing.consignes : `${briefing.consignes.slice(0, 140)}… `}
              {consignesLongues && !voirPlus && (
                <button onClick={() => setVoirPlus(true)} className="underline font-semibold" style={{ color: '#60A5FA' }}>voir plus</button>
              )}
            </p>
          )}

          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs mb-3" style={{ color: 'var(--c-dim)' }}>
            <span>{republie ? '' : `Publié à ${heurePub}`}</span>
            {republie && (
              <span className="inline-flex items-center gap-1" style={{ color: '#FBBF24' }}>
                <RefreshCw className="w-3 h-3" /> Mis à jour à {heurePub}
              </span>
            )}
            {acks !== null && membres !== null && (
              <span className="inline-flex items-center gap-1" style={{ color: '#34D399' }}>
                <CheckCircle className="w-3.5 h-3.5" />
                {acks} / {membres} licenciés ont pris connaissance
              </span>
            )}
          </div>

          <button onClick={onOuvrir}
            className="flex items-center gap-1.5 text-sm font-bold px-4 rounded-lg text-white"
            style={{ background: '#F97316', minHeight: 44 }}>
            Ouvrir le briefing <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
