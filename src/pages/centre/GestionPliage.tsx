import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { X, Plus, Printer } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SacParachute {
  id: string;
  qr_code_token: string;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  est_plieur_qualifie: boolean;
  actif: boolean;
  user_id: string;
  profil: { nom: string; prenom: string; photo_profil_url: string | null } | null;
}

interface PliageDuJour {
  id: string;
  type_pliage: string;
  plieur_nom_libre: string | null;
  date_pliage: string | null;
  created_at: string;
  sac: { id: string; marque: string | null; modele: string | null } | null;
  profil: { nom: string; prenom: string } | null;
}

type Onglet = 'jour' | 'sacs' | 'stats';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genToken(): string {
  return 'SAC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9).toUpperCase();
}

function pliageLabel(type: string) {
  if (type === 'plieur_paye') return { label: 'Plieur payé', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
  if (type === 'auto') return { label: 'Auto-plié', color: '#A78BFA', bg: 'rgba(139,92,246,0.12)' };
  return { label: 'Non renseigné', color: '#F97316', bg: 'rgba(249,115,22,0.12)' };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
      <p className="text-2xl font-bold mb-1" style={{ color }}>{val}</p>
      <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{label}</p>
    </div>
  );
}

// ─── Onglet Pliage du Jour ────────────────────────────────────────────────────

function OngletPliageDuJour({ centreId }: { centreId: string }) {
  const [pliages, setPliages] = useState<PliageDuJour[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<'tous' | 'plieur_paye' | 'auto' | 'non_renseigne'>('tous');

  const fetchPliages = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('validations_pliage')
      .select('id, type_pliage, plieur_nom_libre, date_pliage, created_at, sac:sacs_parachute(id, marque, modele), profil:profiles!validations_pliage_user_id_fkey(nom, prenom)')
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59')
      .order('created_at', { ascending: false });

    // Filter to only this centre's sacs
    if (data) {
      const sacIds = await supabase
        .from('sacs_parachute')
        .select('id')
        .eq('centre_id', centreId)
        .then(({ data: s }) => new Set(s?.map(x => x.id) ?? []));
      setPliages((data as PliageDuJour[]).filter(p => p.sac && sacIds.has(p.sac.id)));
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { fetchPliages(); }, [fetchPliages]);

  const filtered = filtre === 'tous' ? pliages : pliages.filter(p => p.type_pliage === filtre);
  const plieursPayes = pliages.filter(p => p.type_pliage === 'plieur_paye').length;
  const autoPlies = pliages.filter(p => p.type_pliage === 'auto').length;
  const nonRenseignes = pliages.filter(p => p.type_pliage === 'non_renseigne').length;

  const FILTRES = [
    { id: 'tous' as const, label: 'Tous' },
    { id: 'plieur_paye' as const, label: '💰 Plieur payé' },
    { id: 'auto' as const, label: '🙋 Auto-plié' },
    { id: 'non_renseigne' as const, label: '⚠️ Non renseigné' },
  ];

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Validations aujourd'hui" val={pliages.length} color="#3B82F6" />
        <KpiCard label="Plieurs payés" val={plieursPayes} color="#10B981" />
        <KpiCard label="Auto-pliés" val={autoPlies} color="#A78BFA" />
        <KpiCard label="Non renseignés" val={nonRenseignes} color="#F97316" />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTRES.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltre(f.id)}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              border: `1px solid ${filtre === f.id ? '#F97316' : 'var(--c-border)'}`,
              background: filtre === f.id ? 'rgba(249,115,22,0.1)' : 'transparent',
              color: filtre === f.id ? '#F97316' : 'var(--c-muted)',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--c-muted)' }}>
          <div className="text-5xl mb-3">🪂</div>
          <p className="font-medium">Aucune validation de pliage aujourd'hui</p>
          <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>Les validations scannées par QR code apparaîtront ici</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
          {filtered.map((p, i) => {
            const badge = pliageLabel(p.type_pliage);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid var(--c-border-s)' : 'none', background: 'var(--c-dropdown)' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: '#003082', color: '#fff' }}>
                  {(p.profil?.prenom?.[0] ?? '?').toUpperCase()}{(p.profil?.nom?.[0] ?? '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>
                    {p.profil?.prenom} {p.profil?.nom}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                    {p.sac?.marque} {p.sac?.modele}
                    {p.type_pliage === 'plieur_paye' && p.plieur_nom_libre ? ` · Plié par ${p.plieur_nom_libre}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--c-dim)' }}>
                    {p.date_pliage ? new Date(p.date_pliage).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal QR Code ─────────────────────────────────────────────────────────────

function ModalQRCode({ sac, onClose }: { sac: SacParachute; onClose: () => void }) {
  const qrUrl = `${window.location.origin}/pliage/scan/${sac.qr_code_token}`;

  const imprimer = () => {
    const html = `<!DOCTYPE html><html><head><title>QR Pliage</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { text-align: center; padding: 32px; border: 2px solid #001A4D; border-radius: 16px; max-width: 300px; }
  .logo { font-size: 24px; font-weight: 900; color: #001A4D; letter-spacing: -1px; margin-bottom: 8px; }
  .name { font-size: 18px; font-weight: 700; color: #0F172A; margin: 12px 0 4px; }
  .sub { font-size: 12px; color: #64748B; margin-bottom: 16px; }
  .token { font-size: 9px; font-family: monospace; color: #94A3B8; margin-top: 12px; word-break: break-all; }
  .footer { font-size: 10px; color: #94A3B8; margin-top: 8px; }
  img { display: block; margin: 0 auto; }
</style></head><body>
<div class="card">
  <div class="logo">ParaPass</div>
  <div class="name">${sac.profil?.prenom ?? ''} ${sac.profil?.nom ?? ''}</div>
  <div class="sub">${[sac.marque, sac.modele, sac.numero_serie ? 'N°' + sac.numero_serie : null].filter(Boolean).join(' · ')}</div>
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}" width="200" height="200" />
  <div class="token">${sac.qr_code_token}</div>
  <div class="footer">Scanner pour valider le pliage · ParaPass</div>
</div>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.addEventListener('load', () => win.print());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>QR Code · Pliage</p>
            <h3 className="font-bold text-white">{sac.profil?.prenom} {sac.profil?.nom}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {[sac.marque, sac.modele].filter(Boolean).join(' ')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center py-6 px-5">
          <div className="p-4 rounded-2xl bg-white mb-4">
            <QRCodeSVG value={qrUrl} size={180} />
          </div>
          <p className="text-xs font-mono text-center mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{sac.qr_code_token}</p>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>QR permanent · Scanner pour valider le pliage</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', background: 'transparent' }}
          >
            Fermer
          </button>
          <button
            onClick={imprimer}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: '#F97316' }}
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Gestion des Sacs ───────────────────────────────────────────────────

function OngletGestionSacs({ centreId }: { centreId: string }) {
  const [sacs, setSacs] = useState<SacParachute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sacQR, setSacQR] = useState<SacParachute | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userId: '', marque: '', modele: '', numeroSerie: '', estPlieurQualifie: false });
  const [licencies, setLicencies] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [searchLicencie, setSearchLicencie] = useState('');

  const fetchSacs = useCallback(async () => {
    const { data } = await supabase
      .from('sacs_parachute')
      .select('id, qr_code_token, marque, modele, numero_serie, est_plieur_qualifie, actif, user_id, profil:profiles!sacs_parachute_user_id_fkey(nom, prenom, photo_profil_url)')
      .eq('centre_id', centreId)
      .eq('actif', true)
      .order('created_at', { ascending: false });
    setSacs((data as SacParachute[]) ?? []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { fetchSacs(); }, [fetchSacs]);

  useEffect(() => {
    supabase
      .from('licencies_centres')
      .select('parachutiste_id, profil:profiles!licencies_centres_parachutiste_id_fkey(id, nom, prenom)')
      .eq('centre_id', centreId)
      .eq('statut', 'actif')
      .then(({ data }) => {
        if (data) {
          setLicencies(data.map((l: { profil: { id: string; nom: string; prenom: string } | null }) => l.profil).filter((p): p is { id: string; nom: string; prenom: string } => !!p));
        }
      });
  }, [centreId]);

  const creerSac = async () => {
    if (!form.userId) return;
    setSaving(true);
    const token = genToken();
    const { data, error } = await supabase
      .from('sacs_parachute')
      .insert({
        user_id: form.userId,
        centre_id: centreId,
        qr_code_token: token,
        marque: form.marque || null,
        modele: form.modele || null,
        numero_serie: form.numeroSerie || null,
        est_plieur_qualifie: form.estPlieurQualifie,
      })
      .select('id, qr_code_token, marque, modele, numero_serie, est_plieur_qualifie, actif, user_id, profil:profiles!sacs_parachute_user_id_fkey(nom, prenom, photo_profil_url)')
      .single();
    setSaving(false);
    if (!error && data) {
      setSacs(prev => [data as SacParachute, ...prev]);
      setShowForm(false);
      setForm({ userId: '', marque: '', modele: '', numeroSerie: '', estPlieurQualifie: false });
    }
  };

  const filteredLicencies = licencies.filter(l =>
    `${l.prenom} ${l.nom}`.toLowerCase().includes(searchLicencie.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: 'var(--c-text)',
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>{sacs.length} sac{sacs.length !== 1 ? 's' : ''} enregistré{sacs.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: '#F97316', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}
        >
          <Plus className="w-4 h-4" /> Enregistrer un sac
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div
            className="rounded-2xl w-full max-w-md shadow-2xl"
            style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="font-bold text-white">Enregistrer un sac</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Licencié search */}
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Parachutiste *</label>
                <input
                  type="text"
                  value={searchLicencie}
                  onChange={e => setSearchLicencie(e.target.value)}
                  placeholder="Rechercher un licencié..."
                  style={inputStyle}
                />
                {searchLicencie && (
                  <div className="mt-1 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', maxHeight: 160, overflowY: 'auto' }}>
                    {filteredLicencies.slice(0, 6).map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, userId: l.id })); setSearchLicencie(`${l.prenom} ${l.nom}`); }}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                        style={{ background: form.userId === l.id ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)', color: 'var(--c-text)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        {l.prenom} {l.nom}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Marque</label>
                  <input type="text" value={form.marque} onChange={e => setForm(f => ({ ...f, marque: e.target.value }))} placeholder="Performance Designs" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Modèle</label>
                  <input type="text" value={form.modele} onChange={e => setForm(f => ({ ...f, modele: e.target.value }))} placeholder="Pilot 168" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>N° de série</label>
                <input type="text" value={form.numeroSerie} onChange={e => setForm(f => ({ ...f, numeroSerie: e.target.value }))} placeholder="Optionnel" style={inputStyle} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.estPlieurQualifie} onChange={e => setForm(f => ({ ...f, estPlieurQualifie: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Propriétaire qualifié plieur</span>
              </label>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
                Annuler
              </button>
              <button
                onClick={creerSac}
                disabled={!form.userId || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: '#F97316' }}
              >
                {saving ? 'Création...' : 'Créer le sac + QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sac list */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
      ) : sacs.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--c-muted)' }}>
          <div className="text-5xl mb-3">🎒</div>
          <p className="font-medium">Aucun sac enregistré</p>
          <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>Cliquez sur "Enregistrer un sac" pour générer le premier QR code</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {sacs.map(sac => (
            <div key={sac.id} className="rounded-xl p-4" style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)' }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  🎒
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--c-text)' }}>
                    {sac.profil?.prenom} {sac.profil?.nom}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>
                    {[sac.marque, sac.modele, sac.numero_serie ? `N°${sac.numero_serie}` : null].filter(Boolean).join(' · ') || 'Sac sans détails'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {sac.est_plieur_qualifie && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>✓ Plieur qualifié</span>
                )}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.12)', color: '#60A5FA' }}>● QR actif</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSacQR(sac)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ border: '1px solid var(--c-border)', color: 'var(--c-text)', background: 'transparent' }}
                >
                  📱 Voir QR
                </button>
                <button
                  onClick={() => setSacQR(sac)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ background: '#F97316' }}
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sacQR && <ModalQRCode sac={sacQR} onClose={() => setSacQR(null)} />}
    </div>
  );
}

// ─── Onglet Stats ──────────────────────────────────────────────────────────────

function OngletStats({ centreId }: { centreId: string }) {
  const [stats, setStats] = useState({ totalSacs: 0, totalPliages: 0, plieursPayes: 0, autoPlies: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { count: totalSacs } = await supabase.from('sacs_parachute').select('*', { count: 'exact', head: true }).eq('centre_id', centreId).eq('actif', true);
      const sacIds = await supabase.from('sacs_parachute').select('id').eq('centre_id', centreId).then(({ data }) => data?.map(s => s.id) ?? []);
      if (sacIds.length === 0) { setStats({ totalSacs: totalSacs ?? 0, totalPliages: 0, plieursPayes: 0, autoPlies: 0 }); setLoading(false); return; }
      const { data: pliages } = await supabase.from('validations_pliage').select('type_pliage').in('sac_id', sacIds);
      setStats({
        totalSacs: totalSacs ?? 0,
        totalPliages: pliages?.length ?? 0,
        plieursPayes: pliages?.filter(p => p.type_pliage === 'plieur_paye').length ?? 0,
        autoPlies: pliages?.filter(p => p.type_pliage === 'auto').length ?? 0,
      });
      setLoading(false);
    })();
  }, [centreId]);

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <KpiCard label="Sacs enregistrés" val={stats.totalSacs} color="#3B82F6" />
        <KpiCard label="Validations totales" val={stats.totalPliages} color="#F97316" />
        <KpiCard label="Plieurs payés (total)" val={stats.plieursPayes} color="#10B981" />
        <KpiCard label="Auto-pliés (total)" val={stats.autoPlies} color="#A78BFA" />
      </div>
      {stats.totalPliages > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Répartition</p>
          <div className="space-y-2">
            {[
              { label: 'Plieur payé', val: stats.plieursPayes, color: '#10B981' },
              { label: 'Auto-plié', val: stats.autoPlies, color: '#A78BFA' },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: row.color }}>{Math.round(row.val / stats.totalPliages * 100)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-hover)' }}>
                  <div style={{ height: '100%', width: `${row.val / stats.totalPliages * 100}%`, background: row.color, borderRadius: 9999, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GestionPliage({ centreId }: { centreId: string }) {
  const [onglet, setOnglet] = useState<Onglet>('jour');

  const ONGLETS: { id: Onglet; label: string }[] = [
    { id: 'jour', label: '📋 Pliage du jour' },
    { id: 'sacs', label: '🎒 Gestion des sacs' },
    { id: 'stats', label: '📊 Statistiques' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>🪂 Gestion du pliage</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--c-muted)' }}>Remplacez vos tickets papier par des QR codes numériques</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>
          ✨ Option Pro
        </span>
      </div>

      {/* Sub-tabs */}
      <div className="flex mb-6" style={{ borderBottom: '1px solid var(--c-border)' }}>
        {ONGLETS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setOnglet(tab.id)}
            className="px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              color: onglet === tab.id ? 'var(--c-text)' : 'var(--c-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${onglet === tab.id ? '#F97316' : 'transparent'}`,
              cursor: 'pointer',
              fontWeight: onglet === tab.id ? 600 : 400,
            } as React.CSSProperties}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {onglet === 'jour' && <OngletPliageDuJour centreId={centreId} />}
      {onglet === 'sacs' && <OngletGestionSacs centreId={centreId} />}
      {onglet === 'stats' && <OngletStats centreId={centreId} />}
    </div>
  );
}
