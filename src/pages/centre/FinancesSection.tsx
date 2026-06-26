import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp, Clock, CheckCircle, Plus, Pencil, Trash2, Download, X, Save,
  Users, Bell, History, Tag,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tarif {
  id: string;
  dz_id: string;
  type: 'saut' | 'pliage' | 'location_parachute' | 'autre';
  nom: string;
  prix_cents: number;
  actif: boolean;
}

interface Promo {
  id: string;
  dz_id: string;
  nom: string;
  type: 'pourcentage' | 'fixe';
  valeur: number;
  date_debut: string | null;
  date_fin: string | null;
  actif: boolean;
}

interface Transaction {
  id: string;
  parachutiste_id: string;
  type: string;
  description: string | null;
  montant_cents: number;
  statut: 'du' | 'paye' | 'annule';
  created_at: string;
  parachutiste: { nom: string; prenom: string; email: string } | null;
}

interface ParaSolde {
  parachutiste_id: string;
  nom: string;
  prenom: string;
  email: string;
  solde_du: number;
  nb_transactions: number;
}

interface Kpis {
  ca_mois: number;
  nb_transactions: number;
  montant_du: number;
  taux_paiement: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  saut: '🪂 Saut',
  pliage: '🎿 Pliage',
  location_parachute: '📦 Location',
  autre: '📋 Autre',
};

const STATUT_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  du:      { label: 'Dû',        bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
  paye:    { label: 'Payé',      bg: 'rgba(16,185,129,0.15)',  color: '#10B981' },
  annule:  { label: 'Annulé',    bg: 'rgba(100,116,139,0.15)', color: '#94A3B8' },
};

function euros(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

// ─── Tarif Modal ──────────────────────────────────────────────────────────────

function TarifModal({
  dzId, tarif, onClose, onSaved,
}: {
  dzId: string;
  tarif: Tarif | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nom, setNom] = useState(tarif?.nom ?? '');
  const [type, setType] = useState<Tarif['type']>(tarif?.type ?? 'saut');
  const [prix, setPrix] = useState(tarif ? String(tarif.prix_cents / 100) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!nom.trim() || !prix) { setErr('Remplissez tous les champs.'); return; }
    const prix_cents = Math.round(parseFloat(prix.replace(',', '.')) * 100);
    if (isNaN(prix_cents) || prix_cents < 0) { setErr('Prix invalide.'); return; }
    setSaving(true);
    const payload = { dz_id: dzId, nom: nom.trim(), type, prix_cents, actif: true };
    const { error } = tarif
      ? await supabase.from('dz_tarifs').update(payload).eq('id', tarif.id)
      : await supabase.from('dz_tarifs').insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold" style={{ color: 'var(--c-text)' }}>{tarif ? 'Modifier le tarif' : 'Nouveau tarif'}</h3>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--c-muted)' }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Nom</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Saut solo"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as Tarif['type'])}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
              <option value="saut">🪂 Saut</option>
              <option value="pliage">🎿 Pliage</option>
              <option value="location_parachute">📦 Location parachute</option>
              <option value="autre">📋 Autre</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Prix (€)</label>
            <input value={prix} onChange={e => setPrix(e.target.value)} placeholder="20.00" type="number" min="0" step="0.01"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
          </div>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm" style={{ background: 'var(--c-card)', color: 'var(--c-muted)' }}>Annuler</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
            <Save className="w-3.5 h-3.5" />{saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Promo Modal ──────────────────────────────────────────────────────────────

function PromoModal({
  dzId, promo, onClose, onSaved,
}: {
  dzId: string;
  promo: Promo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nom, setNom] = useState(promo?.nom ?? '');
  const [type, setType] = useState<'pourcentage' | 'fixe'>(promo?.type ?? 'pourcentage');
  const [valeur, setValeur] = useState(promo ? String(promo.valeur) : '');
  const [dateDebut, setDateDebut] = useState(promo?.date_debut ?? '');
  const [dateFin, setDateFin] = useState(promo?.date_fin ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!nom.trim() || !valeur) { setErr('Remplissez tous les champs.'); return; }
    const v = parseFloat(valeur.replace(',', '.'));
    if (isNaN(v) || v < 0) { setErr('Valeur invalide.'); return; }
    setSaving(true);
    const payload = {
      dz_id: dzId, nom: nom.trim(), type, valeur: v,
      date_debut: dateDebut || null, date_fin: dateFin || null, actif: true,
    };
    const { error } = promo
      ? await supabase.from('dz_promotions').update(payload).eq('id', promo.id)
      : await supabase.from('dz_promotions').insert(payload);
    if (error) { setErr(error.message); setSaving(false); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold" style={{ color: 'var(--c-text)' }}>{promo ? 'Modifier la promo' : 'Nouvelle promotion'}</h3>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--c-muted)' }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Nom</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Promo été"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as 'pourcentage' | 'fixe')}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                <option value="pourcentage">% Pourcentage</option>
                <option value="fixe">€ Fixe</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Valeur</label>
              <input value={valeur} onChange={e => setValeur(e.target.value)} placeholder={type === 'pourcentage' ? '10' : '5.00'}
                type="number" min="0" step="0.01"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Du</label>
              <input value={dateDebut} onChange={e => setDateDebut(e.target.value)} type="date"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--c-dim)' }}>Au</label>
              <input value={dateFin} onChange={e => setDateFin(e.target.value)} type="date"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
            </div>
          </div>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm" style={{ background: 'var(--c-card)', color: 'var(--c-muted)' }}>Annuler</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
            <Save className="w-3.5 h-3.5" />{saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type View = 'soldes' | 'historique' | 'tarifs' | 'promos';

export function FinancesSection({ dzId }: { dzId: string }) {
  const [view, setView] = useState<View>('soldes');
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parasSoldes, setParasSoldes] = useState<ParaSolde[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ ca_mois: 0, nb_transactions: 0, montant_du: 0, taux_paiement: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [showTarifModal, setShowTarifModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [selectedTarif, setSelectedTarif] = useState<Tarif | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [notifSending, setNotifSending] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: tarifData }, { data: promoData }, { data: txData }] = await Promise.all([
      supabase.from('dz_tarifs').select('*').eq('dz_id', dzId).order('created_at', { ascending: false }),
      supabase.from('dz_promotions').select('*').eq('dz_id', dzId).order('created_at', { ascending: false }),
      supabase
        .from('parachutiste_transactions')
        .select('*, parachutiste:profiles!parachutiste_transactions_parachutiste_id_fkey(nom, prenom, email)')
        .eq('dz_id', dzId)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const txs = (txData ?? []) as Transaction[];
    setTarifs((tarifData ?? []) as Tarif[]);
    setPromos((promoData ?? []) as Promo[]);
    setTransactions(txs);

    // Compute soldes per parachutiste
    const map = new Map<string, ParaSolde>();
    for (const t of txs) {
      if (!t.parachutiste) continue;
      const key = t.parachutiste_id;
      if (!map.has(key)) {
        map.set(key, { parachutiste_id: key, nom: t.parachutiste.nom, prenom: t.parachutiste.prenom, email: t.parachutiste.email, solde_du: 0, nb_transactions: 0 });
      }
      const entry = map.get(key)!;
      entry.nb_transactions++;
      if (t.statut === 'du') entry.solde_du += t.montant_cents;
    }
    setParasSoldes([...map.values()].sort((a, b) => b.solde_du - a.solde_du));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const moisPayees = txs.filter(t => t.statut === 'paye' && t.created_at >= startOfMonth);
    const payees = txs.filter(t => t.statut === 'paye');
    const dues = txs.filter(t => t.statut === 'du');

    setKpis({
      ca_mois: moisPayees.reduce((s, t) => s + t.montant_cents, 0),
      nb_transactions: txs.length,
      montant_du: dues.reduce((s, t) => s + t.montant_cents, 0),
      taux_paiement: txs.length > 0 ? Math.round((payees.length / txs.length) * 100) : 0,
    });

    setLoading(false);
  }, [dzId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const demanderPaiement = async (para: ParaSolde) => {
    if (notifSending) return;
    setNotifSending(para.parachutiste_id);
    await supabase.from('notifications').insert({
      profile_id: para.parachutiste_id,
      titre: 'Règlement en attente',
      message: `Vous avez ${euros(para.solde_du)} à régler à votre DZ. Rendez-vous dans l'onglet "Mon compte" pour payer en ligne.`,
      type: 'info',
      lue: false,
    });
    setNotifSending(null);
  };

  const deleteTarif = async (id: string) => {
    if (!confirm('Supprimer ce tarif ?')) return;
    await supabase.from('dz_tarifs').delete().eq('id', id);
    fetchAll();
  };

  const deletePromo = async (id: string) => {
    if (!confirm('Supprimer cette promotion ?')) return;
    await supabase.from('dz_promotions').delete().eq('id', id);
    fetchAll();
  };

  const exportCSV = () => {
    const rows = [
      ['Date', 'Parachutiste', 'Type', 'Description', 'Montant (€)', 'Statut'],
      ...transactions.map(t => [
        new Date(t.created_at).toLocaleDateString('fr-FR'),
        t.parachutiste ? `${t.parachutiste.prenom} ${t.parachutiste.nom}` : t.parachutiste_id,
        TYPE_LABELS[t.type] ?? t.type,
        t.description ?? '',
        (t.montant_cents / 100).toFixed(2),
        STATUT_STYLES[t.statut]?.label ?? t.statut,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `finances_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const filtered = filterStatut === 'all' ? transactions : transactions.filter(t => t.statut === filterStatut);

  const VIEWS: { key: View; label: string; icon: typeof Users }[] = [
    { key: 'soldes', label: 'Soldes parachutistes', icon: Users },
    { key: 'historique', label: 'Historique', icon: History },
    { key: 'tarifs', label: 'Tarifs', icon: TrendingUp },
    { key: 'promos', label: 'Promotions', icon: Tag },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-t-orange-500 border-white/10 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Finances</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--c-dim)' }}>Gestion des transactions et tarifs de votre DZ</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text2)' }}>
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'CA ce mois', value: euros(kpis.ca_mois), color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Transactions', value: kpis.nb_transactions, color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Montant dû', value: euros(kpis.montant_du), color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Taux de paiement', value: `${kpis.taux_paiement}%`, color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--c-dim)' }}>{k.label}</p>
            <p className="text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--c-card)' }}>
        {VIEWS.map(v => {
          const Icon = v.icon;
          return (
            <button key={v.key} onClick={() => setView(v.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition"
              style={{
                background: view === v.key ? 'var(--c-surface)' : 'transparent',
                color: view === v.key ? 'var(--c-text)' : 'var(--c-muted)',
                boxShadow: view === v.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* Soldes par parachutiste */}
      {view === 'soldes' && (
        <div className="rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Soldes parachutistes</h3>
          </div>
          {parasSoldes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Users className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--c-border)' }} />
              <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucune transaction enregistrée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
                    {['Parachutiste', 'Email', 'Solde dû', 'Transactions', 'Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--c-dim)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
                  {parasSoldes.map(p => (
                    <tr key={p.parachutiste_id} style={{ color: 'var(--c-text2)' }}>
                      <td className="px-4 py-3 font-medium">{p.prenom} {p.nom}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--c-dim)' }}>{p.email}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: p.solde_du > 0 ? '#F59E0B' : '#10B981' }}>
                        {euros(p.solde_du)}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--c-dim)' }}>{p.nb_transactions}</td>
                      <td className="px-4 py-3">
                        {p.solde_du > 0 && (
                          <button
                            onClick={() => demanderPaiement(p)}
                            disabled={notifSending === p.parachutiste_id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-60"
                            style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                            <Bell className="w-3 h-3" />
                            {notifSending === p.parachutiste_id ? 'Envoi...' : 'Demander paiement'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Historique transactions */}
      {view === 'historique' && (
        <div className="rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
          <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Historique des paiements</h3>
            <div className="flex gap-1.5">
              {(['all', 'du', 'paye', 'annule'] as const).map(s => (
                <button key={s} onClick={() => setFilterStatut(s)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition"
                  style={{
                    background: filterStatut === s ? 'rgba(249,115,22,0.15)' : 'var(--c-card)',
                    color: filterStatut === s ? '#F97316' : 'var(--c-muted)',
                    border: filterStatut === s ? '1px solid rgba(249,115,22,0.3)' : '1px solid var(--c-border)',
                  }}>
                  {s === 'all' ? 'Toutes' : STATUT_STYLES[s]?.label}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucune transaction trouvée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
                    {['Date', 'Parachutiste', 'Type', 'Description', 'Montant', 'Statut'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--c-dim)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
                  {filtered.map(t => {
                    const st = STATUT_STYLES[t.statut];
                    return (
                      <tr key={t.id} style={{ color: 'var(--c-text2)' }}>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--c-dim)' }}>
                          {new Date(t.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {t.parachutiste ? `${t.parachutiste.prenom} ${t.parachutiste.nom}` : '—'}
                        </td>
                        <td className="px-4 py-3">{TYPE_LABELS[t.type] ?? t.type}</td>
                        <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--c-dim)' }}>{t.description ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--c-text)' }}>{euros(t.montant_cents)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st?.bg, color: st?.color }}>
                            {st?.label ?? t.statut}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tarifs */}
      {view === 'tarifs' && (
        <div className="rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Tarifs</h3>
            <button onClick={() => { setSelectedTarif(null); setShowTarifModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
          {tarifs.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--c-dim)' }}>
                Aucun tarif. Ajoutez-en un pour activer la facturation automatique.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
              {tarifs.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{TYPE_LABELS[t.type]}</span>
                    <span className="font-medium text-sm" style={{ color: 'var(--c-text)' }}>{t.nom}</span>
                    {!t.actif && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(100,116,139,0.15)', color: '#94A3B8' }}>Inactif</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm" style={{ color: 'var(--c-text)' }}>{euros(t.prix_cents)}</span>
                    <button onClick={() => { setSelectedTarif(t); setShowTarifModal(true); }} className="p-1.5 rounded-lg" style={{ color: 'var(--c-muted)' }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteTarif(t.id)} className="p-1.5 rounded-lg" style={{ color: '#F87171' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Promotions */}
      {view === 'promos' && (
        <div className="rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Promotions</h3>
            <button onClick={() => { setSelectedPromo(null); setShowPromoModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
          {promos.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucune promotion configurée.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
              {promos.map(p => {
                const isExpired = p.date_fin ? new Date(p.date_fin) < new Date() : false;
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" style={{ color: 'var(--c-text)' }}>{p.nom}</span>
                        {!p.actif && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(100,116,139,0.15)', color: '#94A3B8' }}>Inactif</span>}
                        {isExpired && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>Expiré</span>}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
                        {p.type === 'pourcentage' ? `${p.valeur}%` : `${euros(Number(p.valeur) * 100)}`} de réduction
                        {p.date_debut ? ` · du ${new Date(p.date_debut).toLocaleDateString('fr-FR')}` : ''}
                        {p.date_fin ? ` au ${new Date(p.date_fin).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedPromo(p); setShowPromoModal(true); }} className="p-1.5 rounded-lg" style={{ color: 'var(--c-muted)' }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deletePromo(p.id)} className="p-1.5 rounded-lg" style={{ color: '#F87171' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showTarifModal && (
        <TarifModal
          dzId={dzId}
          tarif={selectedTarif}
          onClose={() => { setShowTarifModal(false); setSelectedTarif(null); }}
          onSaved={fetchAll}
        />
      )}
      {showPromoModal && (
        <PromoModal
          dzId={dzId}
          promo={selectedPromo}
          onClose={() => { setShowPromoModal(false); setSelectedPromo(null); }}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
