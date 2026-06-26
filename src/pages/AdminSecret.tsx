import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SECRET = 'FP@ParaPass2026';

type Status = 'idle' | 'loading' | 'toggling' | 'error';

export function AdminSecretPage() {
  const [input, setInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle();
    setMaintenanceOn(data?.value === 'true');
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [authed, fetchStatus]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === SECRET) {
      setAuthed(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setInput('');
    }
  };

  const toggle = async () => {
    if (maintenanceOn === null) return;
    setStatus('toggling');
    const newValue = maintenanceOn ? 'false' : 'true';
    const { error } = await supabase.rpc('set_maintenance_mode', {
      p_secret: SECRET,
      p_value: newValue,
    });
    if (error) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    await fetchStatus();
    setStatus('idle');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'linear-gradient(160deg, #0B1D3A 0%, #1a3a6e 60%, #0e2850 100%)' }}
    >
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }} />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }} />
      </div>

      {/* Logo */}
      <div className="mb-8 relative z-10">
        <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-14 sm:h-16 w-auto object-contain mx-auto" />
      </div>

      {!authed ? (
        /* ── Login form ──────────────────────────────────────────────────────── */
        <div className="relative z-10 w-full max-w-sm">
          <div
            className="rounded-2xl p-8 space-y-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
          >
            <div className="text-center">
              <div className="text-3xl mb-3">🔐</div>
              <h1 className="text-lg font-bold text-white">Accès administrateur</h1>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Panneau de contrôle ParaPass
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Code secret
                </label>
                <input
                  type="password"
                  value={input}
                  onChange={e => { setInput(e.target.value); setAuthError(false); }}
                  placeholder="••••••••••••••"
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-white outline-none text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: `1px solid ${authError ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.15)'}`,
                    transition: 'border-color 0.2s',
                  }}
                />
                {authError && (
                  <p className="text-xs mt-1.5" style={{ color: '#F87171' }}>
                    Code incorrect. Réessayez.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}
              >
                Accéder
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── Control panel ───────────────────────────────────────────────────── */
        <div className="relative z-10 w-full max-w-md space-y-5">
          {/* Header card */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-lg font-bold text-white">Panneau Admin — ParaPass</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>
                🔓 Connecté
              </span>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Contrôle du mode maintenance en temps réel
            </p>
          </div>

          {/* Status + Toggle */}
          <div
            className="rounded-2xl p-6 space-y-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Current status indicator */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Statut actuel
                </p>
                <div className="flex items-center gap-2">
                  {maintenanceOn === null ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  ) : (
                    <>
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          background: maintenanceOn ? '#EF4444' : '#10B981',
                          boxShadow: maintenanceOn ? '0 0 8px rgba(239,68,68,0.6)' : '0 0 8px rgba(16,185,129,0.6)',
                        }}
                      />
                      <span className="font-bold text-base" style={{ color: maintenanceOn ? '#F87171' : '#34D399' }}>
                        {maintenanceOn ? 'MAINTENANCE ACTIVE' : 'Site EN LIGNE'}
                      </span>
                    </>
                  )}
                </div>
                {lastUpdated && (
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Mis à jour {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                )}
              </div>

              <button
                onClick={() => fetchStatus()}
                className="p-2 rounded-lg text-xs transition"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                title="Rafraîchir"
              >
                ↻
              </button>
            </div>

            {/* Big toggle button */}
            <button
              onClick={toggle}
              disabled={status === 'toggling' || maintenanceOn === null}
              className="w-full py-5 rounded-2xl font-bold text-white text-base transition-all disabled:opacity-60 active:scale-95"
              style={{
                background: maintenanceOn
                  ? 'linear-gradient(135deg, #10B981, #059669)'
                  : 'linear-gradient(135deg, #EF4444, #DC2626)',
                boxShadow: maintenanceOn
                  ? '0 6px 20px rgba(16,185,129,0.35)'
                  : '0 6px 20px rgba(239,68,68,0.35)',
                transform: status === 'toggling' ? 'scale(0.98)' : 'scale(1)',
                transition: 'all 0.2s',
              }}
            >
              {status === 'toggling' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  Application…
                </span>
              ) : maintenanceOn ? (
                '🟢 Remettre le site EN LIGNE'
              ) : (
                '🔴 Activer la MAINTENANCE'
              )}
            </button>

            {status === 'error' && (
              <p className="text-xs text-center text-red-400">
                Erreur lors de la mise à jour. Vérifiez la connexion Supabase.
              </p>
            )}

            {/* Warning box */}
            <div
              className="rounded-xl px-4 py-3 text-xs leading-relaxed"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'rgba(245,158,11,0.8)' }}
            >
              ⚠️ {maintenanceOn
                ? 'Le site est actuellement inaccessible pour les utilisateurs. Cliquez pour le remettre en ligne.'
                : 'Activer la maintenance rend le site inaccessible pour tous les utilisateurs sauf cette page admin.'}
            </div>
          </div>

          {/* Info */}
          <div
            className="rounded-xl px-4 py-3 text-xs"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
          >
            Le changement est effectif sous ~60 secondes pour les utilisateurs en cours de session.
            Rafraîchissement automatique toutes les 10 secondes.
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs mt-10 relative z-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
        © 2026 ParaPass · Carnet de sauts numérique FFP
      </p>
    </div>
  );
}
