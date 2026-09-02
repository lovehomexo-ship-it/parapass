import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ParachuteGlyph } from '../design/BadgeIcon';
import { Megaphone, Plane, Radio, MapPin, ArrowDownUp, ShieldAlert, ScanLine } from 'lucide-react';
import { useBriefingDuJour } from '../lib/briefing';
import { formatHeureParis } from '../lib/datetime';
import { BriefingScene } from '../components/BriefingScene';

/** Mode TV plein écran pour l'écran de la DZ (rechargement manuel suffisant). */
export function BriefingTVPage() {
  const { dzId } = useParams<{ dzId: string }>();
  const { settings, briefing, circuit, backgroundUrl, loading } = useBriefingDuJour(dzId);

  // Écran de hangar : personne ne va le recharger à la main. On rafraîchit
  // toutes les 2 minutes pour que les révisions y arrivent seules (P8).
  useEffect(() => {
    const t = setInterval(() => window.location.reload(), 120_000);
    return () => clearInterval(t);
  }, []);

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
        <div className="flex justify-center mb-6"><ParachuteGlyph className="w-16 h-16" style={{ color: '#F97316' }} aria-hidden /></div>
        <h1 className="text-4xl font-extrabold text-white mb-3">Briefing du jour</h1>
        <p className="text-2xl capitalize mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>{today}</p>
        <p className="text-xl" style={{ color: 'rgba(255,255,255,0.35)' }}>Aucun briefing publié pour aujourd'hui.</p>
      </div>
    );
  }

  const heurePub = formatHeureParis(briefing.published_at);

  return (
    // h-screen + overflow-hidden : sur un écran de hangar, TOUT doit tenir sans
    // défilement — personne ne va scroller. La carte se comprime, le QR reste
    // visible.
    <div className="h-screen overflow-hidden flex flex-col px-8 py-6" style={{ background: '#020617' }}>
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
            <Megaphone className="w-5 h-5 inline-block mr-2 align-[-3px]" aria-hidden /> {briefing.consignes}
          </p>
        </div>
      )}

      {/* ── P8 — Contenu opérationnel + QR d'acquittement ──────────────────
          Lisible à bout de bras depuis le hangar, et le QR assez grand pour
          être scanné à deux mètres. */}
      <div className="flex-shrink-0 mt-4 flex gap-4 items-stretch">
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {([
            [Plane, 'Aéronef', briefing.aeronef],
            [Plane, 'Pilote', briefing.pilote],
            [ArrowDownUp, 'Largage', briefing.altitude_largage_m ? `${briefing.altitude_largage_m} m` : null],
            [Radio, 'Radio', briefing.frequence_radio],
            [MapPin, 'Rassemblement', briefing.point_rassemblement],
            [ShieldAlert, 'DT de service', briefing.dt_service],
          ] as const).filter(([, , v]) => !!v).map(([Icone, label, valeur]) => (
            <div key={label} className="rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <p className="flex items-center gap-1.5 text-sm uppercase tracking-wide"
                style={{ color: 'rgba(255,255,255,0.45)' }}>
                <Icone className="w-4 h-4" aria-hidden /> {label}
              </p>
              <p className="text-xl xl:text-2xl font-bold text-white mt-0.5 leading-tight">{valeur}</p>
            </div>
          ))}
          {(briefing.ordre_sortie || briefing.separation) && (
            <div className="col-span-2 lg:col-span-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <p className="text-sm uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Ordre de sortie et séparation
              </p>
              <p className="text-xl font-semibold text-white mt-0.5">
                {[briefing.ordre_sortie, briefing.separation].filter(Boolean).join(' — ')}
              </p>
            </div>
          )}
        </div>

        {/* Acquittement : on scanne, on arrive sur son tableau de bord où la
            carte du briefing porte le bouton, et on tape. */}
        <div className="flex-shrink-0 rounded-2xl px-6 py-4 flex flex-col items-center justify-center"
          style={{ background: '#fff' }}>
          <QRCodeSVG value={`${window.location.origin}/dashboard`} size={190} level="M" />
          <p className="flex items-center gap-1.5 text-sm font-bold mt-2" style={{ color: '#0F172A' }}>
            <ScanLine className="w-4 h-4" aria-hidden /> Scannez pour acquitter
          </p>
          {(briefing.revision ?? 1) > 1 && (
            <p className="text-xs font-bold mt-0.5" style={{ color: '#C2410C' }}>
              Révision {briefing.revision} — à relire
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
