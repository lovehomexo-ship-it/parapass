import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDemo } from '../lib/useDemo';
import { CreditCard, Clock, CheckCircle, Receipt, TrendingDown } from 'lucide-react';


interface Transaction {
  id: string;
  type: string;
  description: string | null;
  montant_cents: number;
  statut: 'du' | 'paye' | 'annule';
  created_at: string;
  dz_id: string;
  centre: { id: string; nom: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  saut: '🪂 Saut',
  pliage: '🎿 Pliage',
  location_parachute: '📦 Location',
  autre: '📋 Autre',
};

const STATUT_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  du:     { label: 'Dû',       bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
  paye:   { label: 'Payé',     bg: 'rgba(16,185,129,0.15)',  color: '#10B981' },
  annule: { label: 'Annulé',   bg: 'rgba(100,116,139,0.15)', color: '#94A3B8' },
};

function euros(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function MonComptePara({ userId, dzId }: { userId: string; dzId?: string }) {
  const { blockIfDemo } = useDemo();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  const stripeEnabled = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('parachutiste_transactions')
      .select('*, centre:centres!parachutiste_transactions_dz_id_fkey(id, nom)')
      .eq('parachutiste_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (dzId) query = query.eq('dz_id', dzId);
    const { data } = await query;
    setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
  }, [userId, dzId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Check for ?payment=success in URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('payment') === 'success') {
      setPaySuccess(true);
      // Clean URL
      url.searchParams.delete('payment');
      window.history.replaceState({}, '', url.toString());
      fetchTransactions();
    }
  }, [fetchTransactions]);

  const pending = transactions.filter(t => t.statut === 'du');
  const totalDu = pending.reduce((s, t) => s + t.montant_cents, 0);
  const centreNom = pending[0]?.centre?.nom ?? '';
  const activeDzId = dzId ?? pending[0]?.dz_id;

  const handlePay = async () => {
    if (blockIfDemo()) return;
    if (!pending.length || !stripeEnabled) return;
    setPaying(true);
    setPayError(null);

    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_ids: pending.map(t => t.id),
          parachutiste_id: userId,
          dz_id: activeDzId,
          centre_nom: centreNom,
          montant_cents: totalDu,
          success_url: `${window.location.origin}/dashboard?tab=compte&payment=success`,
          cancel_url: `${window.location.origin}/dashboard?tab=compte`,
        }),
      });

      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setPayError(json.error ?? 'Erreur lors de la création du paiement.');
        setPaying(false);
        return;
      }

      window.location.href = json.url;
    } catch {
      setPayError('Impossible de contacter le serveur de paiement.');
      setPaying(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-4 border-t-orange-500 border-white/10 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Success banner */}
      {paySuccess && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#10B981' }} />
          <p className="text-sm font-medium" style={{ color: '#10B981' }}>Paiement reçu — merci ! Votre solde a été mis à jour.</p>
        </div>
      )}

      {/* Solde card */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--c-dim)' }}>Solde dû à la DZ</p>
            <p className="text-3xl font-bold" style={{ color: totalDu > 0 ? '#F59E0B' : '#10B981' }}>
              {euros(totalDu)}
            </p>
            {pending.length > 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
                {pending.length} transaction{pending.length > 1 ? 's' : ''} en attente
                {centreNom ? ` · ${centreNom}` : ''}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {totalDu > 0 && (
              <>
                {stripeEnabled ? (
                  <button onClick={handlePay} disabled={paying}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
                    <CreditCard className="w-4 h-4" />
                    {paying ? 'Redirection Stripe...' : 'Payer maintenant'}
                  </button>
                ) : (
                  <div className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                    Réglez directement à la DZ
                  </div>
                )}
                {payError && <p className="text-xs text-red-400 max-w-xs text-right">{payError}</p>}
              </>
            )}
            {totalDu === 0 && (
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#10B981' }}>
                <CheckCircle className="w-5 h-5" /> Tout est à jour
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats mini */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'À payer', value: pending.length, icon: TrendingDown, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Payé(s)', value: transactions.filter(t => t.statut === 'paye').length, icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Total', value: transactions.length, icon: Receipt, color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl p-3.5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center mb-2" style={{ background: k.bg }}>
                <Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>{k.value}</p>
              <p className="text-xs" style={{ color: 'var(--c-dim)' }}>{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Détail ligne par ligne */}
      <div className="rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Historique</h3>
          <Clock className="w-4 h-4" style={{ color: 'var(--c-muted)' }} />
        </div>

        {transactions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Receipt className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--c-border)' }} />
            <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucune transaction pour le moment.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
            {transactions.map(t => {
              const st = STATUT_STYLES[t.statut];
              return (
                <div key={t.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                      {t.centre?.nom && (
                        <span className="text-xs" style={{ color: 'var(--c-dim)' }}>· {t.centre.nom}</span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--c-dim)' }}>{t.description}</p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
                      {new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                      {euros(t.montant_cents)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: st?.bg, color: st?.color }}>
                      {st?.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
