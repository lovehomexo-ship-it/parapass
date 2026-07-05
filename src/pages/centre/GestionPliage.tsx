import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { X, Plus, Printer, Download, ChevronRight, Clock, Package } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sac {
  id: string;
  nom_court: string | null;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  statut: string;
  etat_journee: string;
  owner_licencie_id: string | null;
  owner: { nom: string; prenom: string } | null;
  created_at: string;
}

interface PliageJour {
  id: string;
  created_at: string;
  statut_paiement: string;
  montant: number | null;
  flag_qualif: boolean;
  note: string | null;
  sac: { id: string; nom_court: string | null; marque: string | null; modele: string | null } | null;
  plieur: { id: string; nom: string; prenom: string } | null;
  parachutiste: { nom: string; prenom: string } | null;
}

// Onglet type defined later near GestionPliage

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statutPaiementBadge(s: string) {
  switch (s) {
    case 'paye_app': return { label: 'Payé app', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
    case 'paye_comptoir': return { label: 'Payé comptoir', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' };
    case 'auto_plie': return { label: 'Auto-plié', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' };
    case 'a_regler': return { label: 'À régler', color: '#F97316', bg: 'rgba(249,115,22,0.12)' };
    default: return { label: 'Non attribué', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  }
}

function KpiCard({ label, val, color }: { label: string; val: number | string; color: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
      <p className="text-2xl font-bold mb-1" style={{ color }}>{val}</p>
      <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{label}</p>
    </div>
  );
}

// ─── PDF QR imprimable ────────────────────────────────────────────────────────

function imprimerQR(sac: Sac) {
  const url = `${window.location.origin}/sac/${sac.id}`;
  const nom = sac.nom_court || [sac.marque, sac.modele].filter(Boolean).join(' ') || 'Sac';
  // QR SVG via qrserver (ECC H)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${encodeURIComponent(url)}`;

  const html = `<!DOCTYPE html>
<html><head><title>QR Pliage – ${nom}</title>
<style>
  @page { size: A4; margin: 1cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
  h1 { font-size: 13px; color: #64748b; text-align: center; margin: 0 0 20px; letter-spacing: 0.5px; text-transform: uppercase; }
  .page { display: flex; flex-direction: column; align-items: center; gap: 40px; padding: 20px; }
  .card { border: 2px solid #001A4D; border-radius: 16px; padding: 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .card.large { width: 8cm; }
  .card.small { width: 5cm; }
  .logo { font-size: 16px; font-weight: 900; color: #001A4D; letter-spacing: -1px; }
  .card.small .logo { font-size: 12px; }
  .nom { font-size: 20px; font-weight: 800; color: #0F172A; line-height: 1.1; }
  .card.small .nom { font-size: 14px; }
  .sub { font-size: 11px; color: #64748b; }
  .card.small .sub { font-size: 9px; }
  img { display: block; }
  .footer { font-size: 9px; color: #94a3b8; margin-top: 4px; }
  .badge { font-size: 8px; background: #FEF3C7; color: #92400E; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
  .sep { border: none; border-top: 1px dashed #CBD5E1; width: 80%; margin: 8px auto; }
</style></head>
<body onload="window.print()">
<div class="page">
  <h1>Étiquettes QR Pliage · ParaPass</h1>

  <!-- Grande étiquette 8×8 cm -->
  <div class="card large">
    <div class="logo">ParaPass</div>
    <div class="nom">${nom}</div>
    ${sac.marque || sac.modele ? `<div class="sub">${[sac.marque, sac.modele, sac.numero_serie ? 'N°' + sac.numero_serie : null].filter(Boolean).join(' · ')}</div>` : ''}
    <img src="${qrSrc}" width="220" height="220" />
    <div class="badge">Scanner pour valider le pliage</div>
    <div class="footer">parapass.fr/sac/${sac.id.slice(0,8)}…</div>
  </div>

  <hr class="sep" />

  <!-- Petite étiquette 5×5 cm -->
  <div class="card small">
    <div class="logo">ParaPass</div>
    <div class="nom">${nom}</div>
    <img src="${qrSrc}" width="140" height="140" />
    <div class="footer">Pliage · parapass.fr</div>
  </div>
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ─── Modal QR ────────────────────────────────────────────────────────────────

function ModalQR({ sac, onClose }: { sac: Sac; onClose: () => void }) {
  const url = `${window.location.origin}/sac/${sac.id}`;
  const nom = sac.nom_court || [sac.marque, sac.modele].filter(Boolean).join(' ') || 'Sac';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>QR permanent · Sac</p>
            <h3 className="font-bold text-white">{nom}</h3>
            {(sac.marque || sac.modele) && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {[sac.marque, sac.modele].filter(Boolean).join(' ')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col items-center py-6 px-5">
          <div className="p-4 rounded-2xl bg-white mb-4">
            <QRCodeSVG value={url} size={180} level="H" />
          </div>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            QR permanent · ECC niveau H · ne change jamais
          </p>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
            Fermer
          </button>
          <button
            onClick={() => imprimerQR(sac)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: '#F97316' }}
          >
            <Printer className="w-4 h-4" /> Imprimer PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal nouveau sac ────────────────────────────────────────────────────────

function ModalNouveauSac({
  centreId,
  onCreated,
  onClose,
}: {
  centreId: string;
  onCreated: (sac: Sac) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nomCourt: '',
    marque: '',
    modele: '',
    numeroSerie: '',
    statut: 'en_service',
    ownerLicencieId: '',
  });
  const [licencies, setLicencies] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [searchLicencie, setSearchLicencie] = useState('');
  const [saving, setSaving] = useState(false);
  const [showOwner, setShowOwner] = useState(false);

  useEffect(() => {
    supabase
      .from('licencies_centres')
      .select('parachutiste_id, profil:profiles!licencies_centres_parachutiste_id_fkey(id, nom, prenom)')
      .eq('centre_id', centreId)
      .eq('statut', 'actif')
      .then(({ data }) => {
        if (data) {
          setLicencies(
            data.map((l: { profil: { id: string; nom: string; prenom: string } | null }) => l.profil)
              .filter((p): p is { id: string; nom: string; prenom: string } => !!p),
          );
        }
      });
  }, [centreId]);

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

  const creerSac = async () => {
    if (!form.nomCourt.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('sacs_parachute')
      .insert({
        centre_id: centreId,
        nom_court: form.nomCourt.trim(),
        marque: form.marque || null,
        modele: form.modele || null,
        numero_serie: form.numeroSerie || null,
        statut: form.statut,
        owner_licencie_id: form.ownerLicencieId || null,
        qr_code_token: 'v2-' + Date.now(), // kept for compat but QR uses UUID now
        actif: true,
      })
      .select('id, nom_court, marque, modele, numero_serie, statut, owner_licencie_id, created_at, owner:profiles!sacs_parachute_owner_licencie_id_fkey(nom, prenom)')
      .single();
    setSaving(false);
    if (!error && data) {
      onCreated(data as Sac);
    }
  };

  const filteredLicencies = licencies.filter(l =>
    `${l.prenom} ${l.nom}`.toLowerCase().includes(searchLicencie.toLowerCase()),
  );
  const selectedOwner = licencies.find(l => l.id === form.ownerLicencieId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: '#0F2549', borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 1 }}>
          <h3 className="font-bold text-white">Enregistrer un sac</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Nom court — obligatoire */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Nom court du sac <span style={{ color: '#F97316' }}>*</span>
            </label>
            <input
              type="text"
              value={form.nomCourt}
              onChange={e => setForm(f => ({ ...f, nomCourt: e.target.value }))}
              placeholder='Ex : "Sac 12", "Bleu Pilot"'
              style={inputStyle}
              autoFocus
            />
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Ce nom s'affiche en gros lors du scan
            </p>
          </div>

          {/* Marque / Modèle */}
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

          {/* N° de série */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>N° de série</label>
            <input type="text" value={form.numeroSerie} onChange={e => setForm(f => ({ ...f, numeroSerie: e.target.value }))} placeholder="Optionnel" style={inputStyle} />
          </div>

          {/* Statut */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Statut</label>
            <select
              value={form.statut}
              onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="en_service">En service</option>
              <option value="au_repliage_secours">Au repliage secours</option>
              <option value="retire">Retiré</option>
            </select>
          </div>

          {/* Propriétaire licencié — optionnel */}
          <div>
            <button
              type="button"
              onClick={() => setShowOwner(s => !s)}
              className="flex items-center gap-2 text-xs font-semibold"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <ChevronRight className="w-3 h-3" style={{ transform: showOwner ? 'rotate(90deg)' : '', transition: 'transform 0.15s' }} />
              Sac personnel d'un licencié (optionnel)
            </button>
            {showOwner && (
              <div className="mt-2">
                <input
                  type="text"
                  value={selectedOwner ? `${selectedOwner.prenom} ${selectedOwner.nom}` : searchLicencie}
                  onChange={e => { setSearchLicencie(e.target.value); setForm(f => ({ ...f, ownerLicencieId: '' })); }}
                  placeholder="Rechercher un licencié..."
                  style={inputStyle}
                />
                {searchLicencie && !form.ownerLicencieId && (
                  <div className="mt-1 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', maxHeight: 160, overflowY: 'auto' }}>
                    {filteredLicencies.slice(0, 6).map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, ownerLicencieId: l.id })); setSearchLicencie(`${l.prenom} ${l.nom}`); }}
                        className="w-full text-left px-4 py-2.5 text-sm"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--c-text)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        {l.prenom} {l.nom}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
            Annuler
          </button>
          <button
            onClick={creerSac}
            disabled={!form.nomCourt.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: '#F97316' }}
          >
            {saving ? 'Création...' : 'Créer + QR'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Pliage du Jour ────────────────────────────────────────────────────

// ─── File de pliage (sacs À_PLIER) ───────────────────────────────────────────

interface SacAPlier {
  id: string;
  nom_court: string | null;
  marque: string | null;
  modele: string | null;
  assignment: { start_at: string; porteur: { prenom: string; nom: string } | null } | null;
}

function FileDePliage({ centreId }: { centreId: string }) {
  const [sacs, setSacs] = useState<SacAPlier[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sacs_parachute')
      .select('id, nom_court, marque, modele')
      .eq('centre_id', centreId)
      .eq('statut', 'en_service')
      .eq('etat_journee', 'a_plier')
      .eq('actif', true)
      .order('updated_at', { ascending: true });

    if (!data) { setSacs([]); return; }

    // Fetch active assignments for these sacs
    const ids = data.map((s: { id: string }) => s.id);
    const { data: assigns } = ids.length > 0
      ? await supabase.from('sac_assignments')
          .select('sac_id, start_at, porteur:profiles!sac_assignments_licencie_id_fkey(prenom, nom)')
          .in('sac_id', ids).is('end_at', null)
      : { data: [] };

    const assignMap = Object.fromEntries((assigns ?? []).map((a: { sac_id: string; start_at: string; porteur: { prenom: string; nom: string } | null }) => [a.sac_id, a]));

    setSacs(data.map((s: { id: string; nom_court: string | null; marque: string | null; modele: string | null }) => ({
      ...s,
      assignment: assignMap[s.id] ?? null,
    })));
  }, [centreId]);

  useEffect(() => {
    load();
    const channel = supabase.channel(`file_pliage_${centreId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sacs_parachute', filter: `centre_id=eq.${centreId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [centreId, load]);

  if (sacs.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.05)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(249,115,22,0.2)' }}>
        <Clock className="w-4 h-4" style={{ color: '#F97316' }} />
        <p className="text-sm font-bold" style={{ color: '#F97316' }}>File de pliage — {sacs.length} sac{sacs.length > 1 ? 's' : ''} en attente</p>
        <span className="ml-auto text-xs" style={{ color: 'rgba(249,115,22,0.6)' }}>Temps réel</span>
      </div>
      {sacs.map((s, i) => {
        const nom = s.nom_court || [s.marque, s.modele].filter(Boolean).join(' ') || 'Sac sans nom';
        const age = s.assignment ? Math.floor((Date.now() - new Date(s.assignment.start_at).getTime()) / 60000) : null;
        return (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? '1px solid rgba(249,115,22,0.12)' : 'none' }}>
            <span className="text-xl">🎒</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{nom}</p>
              {s.assignment?.porteur && (
                <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                  {s.assignment.porteur.prenom} {s.assignment.porteur.nom}
                  {age !== null ? ` · Déposé il y a ${age} min` : ''}
                </p>
              )}
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>
              À plier
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Onglet Du Jour ───────────────────────────────────────────────────────────

function OngletPliageDuJour({ centreId }: { centreId: string }) {
  const [pliages, setPliages] = useState<PliageJour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('pliages')
      .select('id, created_at, statut_paiement, montant, flag_qualif, note, sac:sacs_parachute(id, nom_court, marque, modele), plieur:profiles!pliages_plieur_id_fkey(id, nom, prenom), parachutiste:profiles!pliages_parachutiste_id_fkey(nom, prenom)')
      .eq('centre_id', centreId)
      .gte('created_at', today + 'T00:00:00Z')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPliages((data as PliageJour[]) ?? []);
        setLoading(false);
      });
  }, [centreId]);

  const totalJour = pliages.length;
  const aRegler = pliages.filter(p => p.statut_paiement === 'a_regler').length;
  const nonAttribues = pliages.filter(p => p.statut_paiement === 'non_attribue').length;
  const flagges = pliages.filter(p => p.flag_qualif).length;
  const revenuJour = pliages
    .filter(p => p.statut_paiement === 'paye_app' || p.statut_paiement === 'paye_comptoir')
    .reduce((s, p) => s + (p.montant ?? 0), 0);

  return (
    <div>
      <FileDePliage centreId={centreId} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Pliages aujourd'hui" val={totalJour} color="#3B82F6" />
        <KpiCard label="Payés" val={`${revenuJour.toFixed(0)} €`} color="#10B981" />
        <KpiCard label="À régler" val={aRegler} color="#F97316" />
        <KpiCard label="Non attribués" val={nonAttribues} color="#94A3B8" />
      </div>

      {flagges > 0 && (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <span className="text-lg">⚠️</span>
          <p className="text-sm" style={{ color: '#FCD34D' }}>
            {flagges} pliage{flagges > 1 ? 's' : ''} flagué{flagges > 1 ? 's' : ''} — qualification plieur non renseignée
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
      ) : pliages.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--c-muted)' }}>
          <div className="text-5xl mb-3">🪂</div>
          <p className="font-medium">Aucun pliage enregistré aujourd'hui</p>
          <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>Les scans apparaissent ici en temps réel</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
          {pliages.map((p, i) => {
            const badge = statutPaiementBadge(p.statut_paiement);
            const heure = new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const sacNom = p.sac?.nom_court || [p.sac?.marque, p.sac?.modele].filter(Boolean).join(' ') || '—';
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid var(--c-border-s)' : 'none', background: 'var(--c-dropdown)' }}
              >
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-xs font-mono font-semibold" style={{ color: 'var(--c-muted)' }}>{heure}</p>
                  {p.flag_qualif && <span className="text-[10px]" title="Qualification manquante">⚠️</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{sacNom}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>
                    {p.plieur ? `${p.plieur.prenom} ${p.plieur.nom}` : '—'}
                    {p.parachutiste ? ` → ${p.parachutiste.prenom} ${p.parachutiste.nom}` : ''}
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                  {p.montant != null && <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{p.montant} €</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Onglet Gestion des Sacs ──────────────────────────────────────────────────

function OngletGestionSacs({ centreId }: { centreId: string }) {
  const [sacs, setSacs] = useState<Sac[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sacQR, setSacQR] = useState<Sac | null>(null);

  const fetchSacs = useCallback(async () => {
    const { data } = await supabase
      .from('sacs_parachute')
      .select('id, nom_court, marque, modele, numero_serie, statut, owner_licencie_id, created_at, owner:profiles!sacs_parachute_owner_licencie_id_fkey(nom, prenom)')
      .eq('centre_id', centreId)
      .eq('actif', true)
      .order('created_at', { ascending: false });
    setSacs((data as Sac[]) ?? []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { fetchSacs(); }, [fetchSacs]);

  const statutColors: Record<string, { color: string; bg: string }> = {
    en_service: { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    au_repliage_secours: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    retire: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {sacs.filter(s => s.statut === 'en_service').length} sac{sacs.filter(s => s.statut === 'en_service').length !== 1 ? 's' : ''} en service
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: '#F97316', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}
        >
          <Plus className="w-4 h-4" /> Enregistrer un sac
        </button>
      </div>

      {showForm && (
        <ModalNouveauSac
          centreId={centreId}
          onCreated={sac => { setSacs(prev => [sac, ...prev]); setShowForm(false); setSacQR(sac); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
      ) : sacs.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--c-muted)' }}>
          <div className="text-5xl mb-3">🎒</div>
          <p className="font-medium">Aucun sac enregistré</p>
          <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>Cliquez sur "Enregistrer un sac" pour générer le premier QR</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {sacs.map(sac => {
            const sc = statutColors[sac.statut] ?? statutColors.en_service;
            const nom = sac.nom_court || [sac.marque, sac.modele].filter(Boolean).join(' ') || 'Sac sans nom';
            return (
              <div key={sac.id} className="rounded-xl p-4" style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    🎒
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--c-text)' }}>{nom}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>
                      {[sac.marque, sac.modele, sac.numero_serie ? `N°${sac.numero_serie}` : null].filter(Boolean).join(' · ') || 'Sac DZ'}
                    </p>
                    {sac.owner && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
                        Propriétaire : {sac.owner.prenom} {sac.owner.nom}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                    {sac.statut === 'en_service' ? '● En service' : sac.statut === 'au_repliage_secours' ? '⏳ Repliage secours' : '✕ Retiré'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSacQR(sac)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid var(--c-border)', color: 'var(--c-text)', background: 'transparent' }}
                  >
                    📱 Voir QR
                  </button>
                  <button
                    onClick={() => { imprimerQR(sac); }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                    style={{ background: '#F97316' }}
                  >
                    🖨️ Imprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sacQR && <ModalQR sac={sacQR} onClose={() => setSacQR(null)} />}
    </div>
  );
}

// ─── Onglet Statistiques ──────────────────────────────────────────────────────

function OngletStats({ centreId }: { centreId: string }) {
  const [stats, setStats] = useState({
    totalSacs: 0, totalPliages: 0,
    aRegler: 0, payeApp: 0, payeComptoir: 0, autoPlies: 0, nonAttribues: 0,
    flagues: 0, revenuTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { count: totalSacs } = await supabase
        .from('sacs_parachute').select('*', { count: 'exact', head: true })
        .eq('centre_id', centreId).eq('actif', true).eq('statut', 'en_service');
      const { data: pliages } = await supabase
        .from('pliages').select('statut_paiement, montant, flag_qualif')
        .eq('centre_id', centreId);
      if (pliages) {
        setStats({
          totalSacs: totalSacs ?? 0,
          totalPliages: pliages.length,
          aRegler: pliages.filter(p => p.statut_paiement === 'a_regler').length,
          payeApp: pliages.filter(p => p.statut_paiement === 'paye_app').length,
          payeComptoir: pliages.filter(p => p.statut_paiement === 'paye_comptoir').length,
          autoPlies: pliages.filter(p => p.statut_paiement === 'auto_plie').length,
          nonAttribues: pliages.filter(p => p.statut_paiement === 'non_attribue').length,
          flagues: pliages.filter(p => p.flag_qualif).length,
          revenuTotal: pliages
            .filter(p => p.statut_paiement === 'paye_app' || p.statut_paiement === 'paye_comptoir')
            .reduce((s, p) => s + (p.montant ?? 0), 0),
        });
      }
      setLoading(false);
    })();
  }, [centreId]);

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Sacs en service" val={stats.totalSacs} color="#3B82F6" />
        <KpiCard label="Pliages total" val={stats.totalPliages} color="#F97316" />
        <KpiCard label="Revenus encaissés" val={`${stats.revenuTotal.toFixed(0)} €`} color="#10B981" />
        <KpiCard label="À régler" val={stats.aRegler} color="#F97316" />
        <KpiCard label="Auto-pliés" val={stats.autoPlies} color="#A78BFA" />
        <KpiCard label="Non attribués" val={stats.nonAttribues} color="#94A3B8" />
      </div>

      {stats.totalPliages > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Répartition</p>
          <div className="space-y-2">
            {[
              { label: 'Payé app', val: stats.payeApp, color: '#10B981' },
              { label: 'Payé comptoir', val: stats.payeComptoir, color: '#60A5FA' },
              { label: 'Auto-plié', val: stats.autoPlies, color: '#A78BFA' },
              { label: 'À régler', val: stats.aRegler, color: '#F97316' },
              { label: 'Non attribué', val: stats.nonAttribues, color: '#94A3B8' },
            ].filter(r => r.val > 0).map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: row.color }}>
                    {row.val} ({Math.round(row.val / stats.totalPliages * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-hover)' }}>
                  <div style={{ height: '100%', width: `${row.val / stats.totalPliages * 100}%`, background: row.color, borderRadius: 9999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.flagues > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <span className="text-lg">⚠️</span>
          <p className="text-sm" style={{ color: '#FCD34D' }}>{stats.flagues} pliage{stats.flagues > 1 ? 's' : ''} avec qualification plieur non renseignée</p>
        </div>
      )}
    </div>
  );
}

// ─── Onglet Relevé Plieurs ────────────────────────────────────────────────────

interface PlieurReleve {
  id: string;
  nom: string;
  prenom: string;
  nbPliages: number;
  montantAReverse: number;
}

function OngletRelevePlieurs({ centreId }: { centreId: string }) {
  const [releve, setReleve] = useState<PlieurReleve[]>([]);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState<'mois' | 'semaine' | 'tout'>('mois');
  const csvRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from('pliages')
        .select('plieur_id, montant, statut_paiement, plieur:profiles!pliages_plieur_id_fkey(id, nom, prenom)')
        .eq('centre_id', centreId)
        .neq('statut_paiement', 'auto_plie')
        .not('plieur_id', 'is', null);

      if (periode === 'mois') {
        const debut = new Date();
        debut.setDate(1); debut.setHours(0, 0, 0, 0);
        query = query.gte('created_at', debut.toISOString());
      } else if (periode === 'semaine') {
        const debut = new Date();
        debut.setDate(debut.getDate() - debut.getDay() + 1);
        debut.setHours(0, 0, 0, 0);
        query = query.gte('created_at', debut.toISOString());
      }

      const { data } = await query;
      if (!data) { setLoading(false); return; }

      // Group by plieur
      const map = new Map<string, PlieurReleve>();
      for (const p of data as Array<{ plieur_id: string; montant: number | null; statut_paiement: string; plieur: { id: string; nom: string; prenom: string } | null }>) {
        if (!p.plieur) continue;
        const isPaye = p.statut_paiement === 'paye_app' || p.statut_paiement === 'paye_comptoir';
        const existing = map.get(p.plieur_id);
        if (existing) {
          existing.nbPliages += 1;
          if (isPaye) existing.montantAReverse += p.montant ?? 0;
        } else {
          map.set(p.plieur_id, {
            id: p.plieur_id,
            nom: p.plieur.nom,
            prenom: p.plieur.prenom,
            nbPliages: 1,
            montantAReverse: isPaye ? (p.montant ?? 0) : 0,
          });
        }
      }
      setReleve(Array.from(map.values()).sort((a, b) => b.nbPliages - a.nbPliages));
      setLoading(false);
    })();
  }, [centreId, periode]);

  const exportCSV = () => {
    const rows = [
      ['Prénom', 'Nom', 'Pliages', 'Montant à reverser (€)'],
      ...releve.map(r => [r.prenom, r.nom, r.nbPliages, r.montantAReverse.toFixed(2)]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    if (csvRef.current) {
      csvRef.current.href = url;
      csvRef.current.download = `releve-plieurs-${new Date().toISOString().slice(0, 10)}.csv`;
      csvRef.current.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const totalPliages = releve.reduce((s, r) => s + r.nbPliages, 0);
  const totalAReverse = releve.reduce((s, r) => s + r.montantAReverse, 0);

  return (
    <div>
      {/* Période + export */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1">
          {(['semaine', 'mois', 'tout'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: periode === p ? 'rgba(249,115,22,0.15)' : 'transparent',
                border: `1px solid ${periode === p ? '#F97316' : 'var(--c-border)'}`,
                color: periode === p ? '#F97316' : 'var(--c-muted)',
                cursor: 'pointer',
              }}
            >
              {p === 'semaine' ? 'Cette semaine' : p === 'mois' ? 'Ce mois' : 'Tout'}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: '1px solid var(--c-border)', color: 'var(--c-text)', background: 'transparent', cursor: 'pointer' }}
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
        <a ref={csvRef} style={{ display: 'none' }} />
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <KpiCard label="Pliages (période)" val={totalPliages} color="#3B82F6" />
        <KpiCard label="À reverser total" val={`${totalAReverse.toFixed(0)} €`} color="#10B981" />
      </div>

      {loading ? (
        <div className="text-center py-8" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
      ) : releve.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>
          <p className="font-medium">Aucun pliage sur cette période</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
          <div className="grid grid-cols-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--c-muted)', background: 'var(--c-card)', borderBottom: '1px solid var(--c-border)' }}>
            <span className="col-span-2">Plieur</span>
            <span className="text-center">Pliages</span>
            <span className="text-right">À reverser</span>
          </div>
          {releve.map((r, i) => (
            <div
              key={r.id}
              className="grid grid-cols-4 px-4 py-3 items-center"
              style={{ background: 'var(--c-dropdown)', borderTop: i > 0 ? '1px solid var(--c-border-s)' : 'none' }}
            >
              <div className="col-span-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: '#003082', color: '#fff' }}>
                  {r.prenom[0]}{r.nom[0]}
                </div>
                <span className="text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>
                  {r.prenom} {r.nom}
                </span>
              </div>
              <span className="text-center text-sm font-bold" style={{ color: '#60A5FA' }}>{r.nbPliages}</span>
              <span className="text-right text-sm font-semibold" style={{ color: '#10B981' }}>
                {r.montantAReverse.toFixed(0)} €
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px]" style={{ color: 'var(--c-dim)' }}>
        ℹ️ Le montant à reverser est calculé sur les pliages payés (app ou comptoir). L'app ne verse rien aux plieurs — ce relevé sert à votre gestion interne.
      </p>
    </div>
  );
}

// ─── Onglet Parc de sacs ──────────────────────────────────────────────────────

interface SacParc {
  id: string;
  nom_court: string | null;
  marque: string | null;
  modele: string | null;
  statut: string;
  etat_journee: string;
  assignment: { start_at: string; porteur: { prenom: string; nom: string } | null } | null;
}

function OngletParcSacs({ centreId }: { centreId: string }) {
  const [sacs, setSacs] = useState<SacParc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sacs_parachute')
      .select('id, nom_court, marque, modele, statut, etat_journee')
      .eq('centre_id', centreId)
      .eq('actif', true)
      .order('nom_court', { ascending: true });
    if (!data) { setSacs([]); setLoading(false); return; }

    const ids = data.map((s: { id: string }) => s.id);
    const { data: assigns } = ids.length > 0
      ? await supabase.from('sac_assignments')
          .select('sac_id, start_at, porteur:profiles!sac_assignments_licencie_id_fkey(prenom, nom)')
          .in('sac_id', ids).is('end_at', null)
      : { data: [] };
    const assignMap = Object.fromEntries((assigns ?? []).map((a: { sac_id: string; start_at: string; porteur: { prenom: string; nom: string } | null }) => [a.sac_id, a]));

    setSacs(data.map((s: { id: string; nom_court: string | null; marque: string | null; modele: string | null; statut: string; etat_journee: string }) => ({
      ...s,
      assignment: assignMap[s.id] ?? null,
    })));
    setLoading(false);
  }, [centreId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`parc_sacs_${centreId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sacs_parachute', filter: `centre_id=eq.${centreId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sac_assignments' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [centreId, load]);

  const libres = sacs.filter(s => s.statut === 'en_service' && s.etat_journee === 'libre');
  const pris = sacs.filter(s => s.statut === 'en_service' && s.etat_journee === 'pris');
  const aPlier = sacs.filter(s => s.statut === 'en_service' && s.etat_journee === 'a_plier');
  const horsService = sacs.filter(s => s.statut !== 'en_service');

  const etatConfig = {
    libre: { label: 'Libre', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
    pris: { label: 'Pris', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
    a_plier: { label: 'À plier', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' },
    hors_service: { label: 'Hors service', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
  };

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>;

  return (
    <div>
      {/* KPI compteurs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Libres', val: libres.length, color: '#10B981' },
          { label: 'Sortis', val: pris.length, color: '#60A5FA' },
          { label: 'À plier', val: aPlier.length, color: '#F97316' },
          { label: 'Hors service', val: horsService.length, color: '#94A3B8' },
        ] as { label: string; val: number; color: string }[]).map(k => (
          <KpiCard key={k.label} label={k.label} val={k.val} color={k.color} />
        ))}
      </div>

      {/* Grille sacs */}
      {[
        { titre: '🟠 À plier', items: aPlier, etat: 'a_plier' as const },
        { titre: '🔵 Sortis', items: pris, etat: 'pris' as const },
        { titre: '🟢 Libres', items: libres, etat: 'libre' as const },
        { titre: '⚫ Hors service', items: horsService, etat: 'hors_service' as const },
      ].map(({ titre, items, etat }) => items.length > 0 && (
        <div key={etat} className="mb-6">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--c-muted)' }}>{titre} ({items.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map(s => {
              const cfg = etatConfig[etat];
              const nom = s.nom_court || [s.marque, s.modele].filter(Boolean).join(' ') || '—';
              const age = s.assignment ? Math.floor((Date.now() - new Date(s.assignment.start_at).getTime()) / 60000) : null;
              return (
                <div key={s.id} className="rounded-xl p-3 flex flex-col gap-1.5"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--c-text)' }}>{nom}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>
                  {s.assignment?.porteur && (
                    <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                      {s.assignment.porteur.prenom} {s.assignment.porteur.nom}
                      {age !== null ? ` · ${age} min` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Onglet = 'jour' | 'sacs' | 'parc' | 'stats' | 'releve';

export function GestionPliage({ centreId }: { centreId: string }) {
  const [onglet, setOnglet] = useState<Onglet>('jour');

  const ONGLETS: { id: Onglet; label: string }[] = [
    { id: 'jour', label: '📋 Du jour' },
    { id: 'parc', label: '🅿️ Parc de sacs' },
    { id: 'sacs', label: '🎒 Sacs' },
    { id: 'stats', label: '📊 Stats' },
    { id: 'releve', label: '💶 Relevé plieurs' },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>🪂 Gestion du pliage</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--c-muted)' }}>Sac → QR → 1 tap · Tout est traçé</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>
          ✨ Option Pro
        </span>
      </div>

      <div className="flex mb-6 overflow-x-auto" style={{ borderBottom: '1px solid var(--c-border)' }}>
        {ONGLETS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setOnglet(tab.id)}
            className="px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
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
      {onglet === 'parc' && <OngletParcSacs centreId={centreId} />}
      {onglet === 'sacs' && <OngletGestionSacs centreId={centreId} />}
      {onglet === 'stats' && <OngletStats centreId={centreId} />}
      {onglet === 'releve' && <OngletRelevePlieurs centreId={centreId} />}
    </div>
  );
}
