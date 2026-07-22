import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ─── Vigilance charge alaire — CÔTÉ DT UNIQUEMENT ─────────────────────────────
// Indicateur SOBRE : « X point(s) de vigilance voile aujourd'hui », dépliable.
// L'appli SIGNALE, le DT décide. Ne recommande jamais de voile, ne bloque rien.
// Calcul côté serveur (RPC) : le poids (donnée sensible) n'est jamais exposé.
// N'apparaît QUE sur le dashboard DT, jamais côté parachutiste.

interface Point {
  user_id: string;
  prenom: string | null;
  nom: string | null;
  nb_sauts: number;
  charge_alaire: number;
  seuil: number;
}

function VigilanceVoileInner({ centreId }: { centreId: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    let vivant = true;
    supabase.rpc('vigilance_charge_alaire', { p_centre_id: centreId }).then(({ data, error }) => {
      if (!vivant) return;
      if (error) { console.error('Vigilance charge alaire échouée :', error); setPoints([]); }
      else setPoints((data as Point[] | null) ?? []);
      setLoading(false);
    });
    return () => { vivant = false; };
  }, [centreId]);

  // Discret : rien tant que ça charge, et rien s'il n'y a aucun point de vigilance.
  if (loading || points.length === 0) return null;

  return (
    <div className="rounded-xl mb-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <button
        onClick={() => setOuvert(o => !o)}
        className="w-full flex items-center gap-2 px-4 text-left"
        style={{ minHeight: 44 }}
      >
        <span className="text-sm" style={{ color: '#FCD34D' }}>
          {points.length} point{points.length > 1 ? 's' : ''} de vigilance voile aujourd'hui
        </span>
        {ouvert
          ? <ChevronUp className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: 'var(--c-dim)' }} />
          : <ChevronDown className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: 'var(--c-dim)' }} />}
      </button>

      {ouvert && (
        <div className="px-4 pb-3 space-y-2">
          {points.map(p => (
            <div key={p.user_id} className="rounded-lg px-3 py-2" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-white">{p.prenom} {p.nom}</span>
                <span className="text-xs" style={{ color: 'var(--c-dim)' }}>{p.nb_sauts} saut{p.nb_sauts > 1 ? 's' : ''}</span>
                <span className="text-xs font-mono" style={{ color: '#FCD34D' }}>charge alaire {p.charge_alaire.toFixed(2)} lb/ft²</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--c-text2)' }}>
                Charge alaire élevée au vu de l'expérience — à vérifier.
              </p>
            </div>
          ))}
          <p className="text-[11px] leading-snug pt-1" style={{ color: 'var(--c-dim)' }}>
            Information de vigilance. L'appli signale, vous décidez. Aucune recommandation de voile
            n'est faite ; les repères sont paramétrables (à valider avec la FFP / DT48).
          </p>
        </div>
      )}
    </div>
  );
}

export function VigilanceVoileDZ({ centreId }: { centreId: string }) {
  return <ErrorBoundary><VigilanceVoileInner centreId={centreId} /></ErrorBoundary>;
}
