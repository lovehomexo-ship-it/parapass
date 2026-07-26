import { useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';

// ═══════════════════════════════════════════════════════════════════════════
// OUTIL DE DÉMO PROVISOIRE — repeuple la journée de la DZ avec des données
// FICTIVES (parachutistes « DÉMO »), pour montrer une interface vivante.
// Réservé au directeur technique. Isolé et facile à retirer en prod :
// supprimer ce fichier + son import + les RPC generer_demo_journee /
// retirer_demo_journee. Ne touche jamais à un autre centre ni à de vraies données.
// ═══════════════════════════════════════════════════════════════════════════

function DemoJourneeInner({ centreId, onDone }: { centreId: string; onDone?: () => void }) {
  const [busy, setBusy] = useState<'gen' | 'clr' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mode: 'gen' | 'clr') => {
    setBusy(mode); setError(null); setInfo(null);
    const fn = mode === 'gen' ? 'generer_demo_journee' : 'retirer_demo_journee';
    const { data, error: err } = await supabase.rpc(fn, { p_centre_id: centreId });
    setBusy(null);
    if (err) {
      // Erreur explicite, jamais masquée.
      console.error(`${fn} échoué :`, err);
      setError(mode === 'gen' ? 'Génération de la démo impossible.' : 'Retrait de la démo impossible.');
      return;
    }
    const r = (data ?? {}) as { presents?: number; sauts?: number; supprime?: number };
    setInfo(mode === 'gen'
      ? `Journée de démo générée : ${r.presents ?? 0} présents, ${r.sauts ?? 0} sauts.`
      : `Données de démo retirées (${r.supprime ?? 0} parachutistes fictifs).`);
    onDone?.(); // rafraîchit le dashboard sans rechargement complet
  };

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.4)' }}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: '#A78BFA' }} />
        <span className="text-xs font-bold" style={{ color: '#A78BFA' }}>Outil de démo (provisoire)</span>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        Repeuple la journée avec des données fictives (parachutistes « DÉMO ») pour une présentation. N'affecte que ce centre.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => run('gen')} disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: '#8B5CF6' }}>
          <Sparkles className="w-3.5 h-3.5" /> {busy === 'gen' ? 'Génération…' : 'Générer une journée de démo'}
        </button>
        <button onClick={() => run('clr')} disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border-f)' }}>
          <Trash2 className="w-3.5 h-3.5" /> {busy === 'clr' ? 'Retrait…' : 'Retirer la démo'}
        </button>
      </div>
      {info && <p className="text-[11px] font-medium" style={{ color: '#34D399' }}>{info}</p>}
      {error && <p role="alert" className="text-[11px] font-medium" style={{ color: '#F87171' }}>{error}</p>}
    </div>
  );
}

/** Bouton de démo DZ — sous ErrorBoundary, ne s'affiche que si un centre est fourni. */
export function DemoJourneeDZ({ centreId, onDone }: { centreId: string | undefined; onDone?: () => void }) {
  if (!centreId) return null;
  return <ErrorBoundary><DemoJourneeInner centreId={centreId} onDone={onDone} /></ErrorBoundary>;
}
