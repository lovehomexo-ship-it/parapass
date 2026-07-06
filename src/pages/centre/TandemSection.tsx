import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, X, Check, Cloud, Users, ChevronLeft, ChevronRight, Download, Settings } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TandemConfig {
  id?: string;
  centre_id: string;
  actif: boolean;
  prix_base: number;
  prix_video: number;
  prix_photos: number;
  pct_acompte: number;
  poids_min: number;
  poids_max: number;
  validite_bon_mois: number;
  politique_meteo: string;
  url_avis_google: string | null;
  description: string | null;
  email_post_saut_actif: boolean;
  email_j7_actif: boolean;
}

interface Slot {
  id: string;
  date: string;
  heure: string;
  capacite: number;
  statut: string;
  bookings: Booking[];
}

interface Booking {
  id: string;
  passager_nom: string | null;
  offreur_nom: string;
  avec_video: boolean;
  avec_photos: boolean;
  statut: string;
  statut_paiement_acompte: string;
  statut_paiement_solde: string;
  montant_solde: number;
  prix_total: number;
  dossier_complete: boolean;
  arrive: boolean;
  moniteur_id: string | null;
  moniteur?: { nom: string; prenom: string } | null;
  dossier_token: string | null;
}

interface Licencie {
  id: string;
  nom: string;
  prenom: string;
}

interface GiftCard {
  id: string;
  code: string;
  formule: string;
  montant: number;
  acheteur_nom: string;
  beneficiaire_nom: string | null;
  validite_jusqu_au: string;
  statut: string;
  created_at: string;
}

type Onglet = 'planning' | 'bons' | 'stats' | 'config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function statutBadge(s: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    confirme: { label: 'Confirmé', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    en_attente: { label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    effectue: { label: 'Effectué', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
    annule: { label: 'Annulé', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    reporte: { label: 'Reporté', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  };
  return map[s] ?? { label: s, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
}

function KpiCard({ label, val, color }: { label: string; val: string | number; color: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderLeft: `3px solid ${color}`, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
      <p className="text-2xl font-bold mb-1" style={{ color }}>{val}</p>
      <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{label}</p>
    </div>
  );
}

// ─── Onglet Planning ──────────────────────────────────────────────────────────

function OngletPlanning({ centreId, centreSlug, config, licencies }: { centreId: string; centreSlug: string; config: TandemConfig; licencies: Licencie[] }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [showNewSlot, setShowNewSlot] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('09:00');
  const [newSlotCap, setNewSlotCap] = useState(4);
  const [saving, setSaving] = useState(false);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const from = isoDate(new Date());
    const to = isoDate(new Date(Date.now() + 30 * 86400000));
    const { data: slotData } = await supabase
      .from('tandem_slots')
      .select('id, date, heure, capacite, statut')
      .eq('centre_id', centreId)
      .gte('date', from)
      .lte('date', to)
      .order('date').order('heure');

    if (slotData?.length) {
      const ids = slotData.map(s => s.id);
      const { data: bookings } = await supabase
        .from('tandem_bookings')
        .select('id, slot_id, passager_nom, offreur_nom, avec_video, avec_photos, statut, statut_paiement_acompte, statut_paiement_solde, montant_solde, prix_total, dossier_complete, arrive, moniteur_id, dossier_token, moniteur:profiles!tandem_bookings_moniteur_id_fkey(nom, prenom)')
        .in('slot_id', ids)
        .in('statut', ['en_attente', 'confirme', 'effectue']);

      const bookingsBySlot = new Map<string, Booking[]>();
      for (const b of bookings ?? []) {
        const arr = bookingsBySlot.get(b.slot_id) ?? [];
        arr.push(b as unknown as Booking);
        bookingsBySlot.set(b.slot_id, arr);
      }
      setSlots(slotData.map(s => ({ ...s, bookings: bookingsBySlot.get(s.id) ?? [] })) as Slot[]);
    } else {
      setSlots([]);
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const creerSlot = async () => {
    setSaving(true);
    await supabase.from('tandem_slots').insert({
      centre_id: centreId,
      date: selectedDate,
      heure: newSlotTime,
      capacite: newSlotCap,
      statut: 'ouvert',
    });
    setSaving(false);
    setShowNewSlot(false);
    fetchSlots();
  };

  const annulerMeteo = async (slotId: string) => {
    if (!confirm('Annuler météo ce créneau ? Tous les passagers seront notifiés.')) return;
    await supabase.from('tandem_slots').update({ statut: 'annule_meteo' }).eq('id', slotId);
    fetchSlots();
  };

  const marquerEffectue = async (bookingId: string) => {
    await supabase.from('tandem_bookings').update({ statut: 'effectue' }).eq('id', bookingId);
    fetchSlots();
  };

  const marquerArrive = async (bookingId: string, arrive: boolean) => {
    await supabase.from('tandem_bookings').update({ arrive: !arrive }).eq('id', bookingId);
    fetchSlots();
  };

  const marquerSoldeComptoir = async (bookingId: string) => {
    await supabase.from('tandem_bookings').update({ statut_paiement_solde: 'paye_comptoir' }).eq('id', bookingId);
    fetchSlots();
  };

  const affecterMoniteur = async (bookingId: string, moniteurId: string) => {
    await supabase.from('tandem_bookings').update({ moniteur_id: moniteurId || null }).eq('id', bookingId);
    fetchSlots();
  };

  // Navigation dates
  const datesDispos = [...new Set(slots.map(s => s.date))].sort();
  const goDate = (dir: -1 | 1) => {
    const idx = datesDispos.indexOf(selectedDate);
    const next = datesDispos[idx + dir];
    if (next) setSelectedDate(next);
  };

  const slotsJour = slots.filter(s => s.date === selectedDate);
  const inp: React.CSSProperties = { padding: '7px 11px', borderRadius: 8, fontSize: 13, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'var(--c-text)', outline: 'none' };

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => goDate(-1)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-muted)', cursor: 'pointer' }}><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...inp, width: 145 }} />
          <button onClick={() => goDate(1)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-muted)', cursor: 'pointer' }}><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button
          onClick={() => setShowNewSlot(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: '#F97316' }}
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau créneau
        </button>
        <a
          href={`${window.location.origin}/dz/${centreSlug}/tandem`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-2 rounded-xl"
          style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)', textDecoration: 'none' }}
        >
          🌐 Page publique
        </a>
      </div>

      {/* Form nouveau créneau */}
      {showNewSlot && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>Nouveau créneau — {new Date(selectedDate).toLocaleDateString('fr-FR')}</p>
            <button onClick={() => setShowNewSlot(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)' }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--c-muted)' }}>Heure</label>
              <input type="time" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} style={inp} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--c-muted)' }}>Capacité</label>
              <input type="number" min={1} max={20} value={newSlotCap} onChange={e => setNewSlotCap(Number(e.target.value))} style={{ ...inp, width: 80 }} />
            </div>
          </div>
          <button onClick={creerSlot} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: '#F97316' }}>
            {saving ? 'Création...' : 'Créer le créneau'}
          </button>
        </div>
      )}

      {/* Créneaux du jour */}
      {loading ? (
        <div className="text-center py-8" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
      ) : slotsJour.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>
          <div className="text-4xl mb-3">📅</div>
          <p className="font-medium">Aucun créneau ce jour</p>
          <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>Créez un créneau pour cette date</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slotsJour.map(slot => {
            const dispo = slot.capacite - slot.bookings.length;
            const isAnnule = slot.statut === 'annule_meteo';
            return (
              <div key={slot.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${isAnnule ? 'rgba(239,68,68,0.3)' : 'var(--c-border)'}`, background: 'var(--c-dropdown)' }}>
                {/* Header créneau */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: isAnnule ? 'rgba(239,68,68,0.08)' : 'var(--c-card)', borderBottom: '1px solid var(--c-border-s)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black" style={{ color: isAnnule ? '#EF4444' : 'var(--c-text)' }}>
                      {slot.heure.slice(0, 5)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: isAnnule ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: isAnnule ? '#EF4444' : '#10B981' }}>
                        {isAnnule ? '⛈️ Annulé météo' : `${dispo}/${slot.capacite} places`}
                      </span>
                    </div>
                  </div>
                  {!isAnnule && (
                    <button
                      onClick={() => annulerMeteo(slot.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                      style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', background: 'transparent', cursor: 'pointer' }}
                    >
                      <Cloud className="w-3 h-3" /> Annuler météo
                    </button>
                  )}
                </div>

                {/* Liste passagers */}
                {slot.bookings.length === 0 ? (
                  <div className="px-4 py-4 text-sm" style={{ color: 'var(--c-dim)' }}>Aucune réservation</div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--c-border-s)' }}>
                    {slot.bookings.map(b => {
                      const badge = statutBadge(b.statut);
                      return (
                        <div key={b.id} className="px-4 py-3 space-y-2">
                          {/* Ligne principale */}
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => marquerArrive(b.id, b.arrive)}
                              title="Marquer arrivé"
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                              style={{ background: b.arrive ? 'rgba(16,185,129,0.15)' : 'var(--c-hover)', border: `2px solid ${b.arrive ? '#10B981' : 'var(--c-border)'}` }}
                            >
                              {b.arrive && <Check className="w-4 h-4 text-green-500" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                                  {b.passager_nom || b.offreur_nom}
                                </p>
                                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                {b.avec_video && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>📹 Vidéo</span>}
                                {b.avec_photos && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>📷 Photos</span>}
                                {b.dossier_complete ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>✓ Dossier OK</span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>⚠️ Dossier incomplet</span>
                                )}
                              </div>
                              {/* Solde + paiement */}
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {b.statut_paiement_solde === 'non_paye' && b.montant_solde > 0 && (
                                  <button
                                    onClick={() => marquerSoldeComptoir(b.id)}
                                    className="text-[11px] px-2.5 py-1 rounded-lg font-semibold"
                                    style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)', cursor: 'pointer' }}
                                  >
                                    Encaisser {b.montant_solde} € comptoir
                                  </button>
                                )}
                                {b.statut_paiement_solde !== 'non_paye' && (
                                  <span className="text-[11px]" style={{ color: '#10B981' }}>✓ Solde réglé</span>
                                )}
                                {b.statut !== 'effectue' && b.arrive && (
                                  <button
                                    onClick={() => marquerEffectue(b.id)}
                                    className="text-[11px] px-2.5 py-1 rounded-lg font-semibold"
                                    style={{ background: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.25)', cursor: 'pointer' }}
                                  >
                                    ✓ Marquer effectué
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Affectation moniteur */}
                          <div className="flex items-center gap-2 pl-11">
                            <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} />
                            <select
                              value={b.moniteur_id ?? ''}
                              onChange={e => affecterMoniteur(b.id, e.target.value)}
                              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-hover)', color: 'var(--c-text)', outline: 'none', cursor: 'pointer' }}
                            >
                              <option value="">— Moniteur tandem —</option>
                              {licencies.map(l => (
                                <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>
                              ))}
                            </select>
                            {b.dossier_token && (
                              <a
                                href={`/tandem/preparer/${b.dossier_token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] px-2 py-1 rounded-lg"
                                style={{ background: 'var(--c-hover)', color: 'var(--c-muted)', textDecoration: 'none' }}
                              >
                                📋 Dossier
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Onglet Bons cadeaux ──────────────────────────────────────────────────────

function OngletBons({ centreId }: { centreId: string }) {
  const [bons, setBons] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<'tous' | 'actif' | 'utilise' | 'expire'>('tous');

  useEffect(() => {
    supabase
      .from('tandem_giftcards')
      .select('*')
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setBons((data as GiftCard[]) ?? []); setLoading(false); });
  }, [centreId]);

  const filtered = filtre === 'tous' ? bons : bons.filter(b => b.statut === filtre);
  const totalVendu = bons.filter(b => b.statut !== 'expire').reduce((s, b) => s + b.montant, 0);
  const totalUtilise = bons.filter(b => b.statut === 'utilise').reduce((s, b) => s + b.montant, 0);

  const statutBon = (s: string) => {
    if (s === 'actif') return { label: 'Actif', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
    if (s === 'utilise') return { label: 'Utilisé', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' };
    return { label: 'Expiré', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Bons vendus" val={bons.filter(b => b.statut !== 'expire').length} color="#F97316" />
        <KpiCard label="Montant vendu" val={`${totalVendu} €`} color="#3B82F6" />
        <KpiCard label="Montant encaissé" val={`${totalUtilise} €`} color="#10B981" />
      </div>

      <div className="flex gap-2">
        {(['tous', 'actif', 'utilise', 'expire'] as const).map(f => (
          <button key={f} onClick={() => setFiltre(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ border: `1px solid ${filtre === f ? '#F97316' : 'var(--c-border)'}`, background: filtre === f ? 'rgba(249,115,22,0.1)' : 'transparent', color: filtre === f ? '#F97316' : 'var(--c-muted)', cursor: 'pointer' }}>
            {f === 'tous' ? 'Tous' : f === 'actif' ? 'Actifs' : f === 'utilise' ? 'Utilisés' : 'Expirés'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
        : filtered.length === 0 ? <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}><div className="text-4xl mb-2">🎁</div><p>Aucun bon cadeau</p></div>
        : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
            {filtered.map((b, i) => {
              const st = statutBon(b.statut);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--c-dropdown)', borderTop: i > 0 ? '1px solid var(--c-border-s)' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--c-text)' }}>{b.code}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                      {b.acheteur_nom}{b.beneficiaire_nom ? ` → ${b.beneficiaire_nom}` : ''} · {b.formule.replace('_', '+').replace('montant_libre', 'libre')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>{b.montant} €</p>
                    <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>Exp. {new Date(b.validite_jusqu_au).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ─── Onglet Stats ─────────────────────────────────────────────────────────────

function OngletStats({ centreId }: { centreId: string }) {
  const [stats, setStats] = useState({
    totalReservations: 0, effectues: 0, annules: 0, noShow: 0,
    caAcomptes: 0, caSoldes: 0, caBons: 0, caVideo: 0,
    dossiersTaux: 0, videoTaux: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: bookings } = await supabase
        .from('tandem_bookings')
        .select('statut, statut_paiement_acompte, statut_paiement_solde, montant_acompte, montant_solde, avec_video, dossier_complete')
        .eq('centre_id', centreId);

      const { data: bons } = await supabase
        .from('tandem_giftcards')
        .select('montant, statut')
        .eq('centre_id', centreId);

      if (bookings) {
        const total = bookings.length;
        const effectues = bookings.filter(b => b.statut === 'effectue').length;
        const annules = bookings.filter(b => b.statut === 'annule').length;
        const avecVideo = bookings.filter(b => b.avec_video).length;
        const dossierOk = bookings.filter(b => b.dossier_complete).length;
        const caAcomptes = bookings.filter(b => b.statut_paiement_acompte === 'paye').reduce((s, b) => s + (b.montant_acompte ?? 0), 0);
        const caSoldes = bookings.filter(b => b.statut_paiement_solde !== 'non_paye').reduce((s, b) => s + (b.montant_solde ?? 0), 0);
        const caBons = bons?.filter(b => b.statut === 'utilise').reduce((s, b) => s + b.montant, 0) ?? 0;

        setStats({
          totalReservations: total, effectues, annules, noShow: total - effectues - annules,
          caAcomptes, caSoldes, caBons, caVideo: avecVideo * 60,
          dossiersTaux: total > 0 ? Math.round(dossierOk / total * 100) : 0,
          videoTaux: total > 0 ? Math.round(avecVideo / total * 100) : 0,
        });
      }
      setLoading(false);
    })();
  }, [centreId]);

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--c-muted)' }}>Chargement...</div>;

  const caTotal = stats.caAcomptes + stats.caSoldes + stats.caBons;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Réservations" val={stats.totalReservations} color="#3B82F6" />
        <KpiCard label="Sauts effectués" val={stats.effectues} color="#10B981" />
        <KpiCard label="CA total" val={`${caTotal.toFixed(0)} €`} color="#F97316" />
        <KpiCard label="CA acomptes" val={`${stats.caAcomptes.toFixed(0)} €`} color="#60A5FA" />
        <KpiCard label="CA soldes" val={`${stats.caSoldes.toFixed(0)} €`} color="#A78BFA" />
        <KpiCard label="CA bons utilisés" val={`${stats.caBons.toFixed(0)} €`} color="#34D399" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-muted)' }}>Dossiers complétés</p>
          <p className="text-3xl font-black" style={{ color: '#10B981' }}>{stats.dossiersTaux}%</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-muted)' }}>Taux vidéo</p>
          <p className="text-3xl font-black" style={{ color: '#A78BFA' }}>{stats.videoTaux}%</p>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Config ─────────────────────────────────────────────────────────────

function OngletConfig({ centreId, config: initialConfig, onSaved }: { centreId: string; config: TandemConfig; onSaved: (c: TandemConfig) => void }) {
  const [form, setForm] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    if (form.id) {
      await supabase.from('tandem_config').update({ ...form, updated_at: new Date().toISOString() }).eq('id', form.id);
    } else {
      const { data } = await supabase.from('tandem_config').insert({ ...form, centre_id: centreId }).select('id').single();
      if (data) setForm(f => ({ ...f, id: data.id }));
    }
    setSaving(false);
    setSaved(true);
    onSaved(form);
    setTimeout(() => setSaved(false), 2000);
  };

  const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 9, fontSize: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'var(--c-text)', outline: 'none', width: '100%' };
  const row = (label: string, children: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--c-border-s)' }}>
      <label className="text-sm flex-shrink-0" style={{ color: 'var(--c-muted)', paddingTop: 6 }}>{label}</label>
      <div className="flex-1 max-w-xs">{children}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)', background: 'var(--c-card)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="w-11 h-6 rounded-full transition-colors relative" style={{ background: form.actif ? '#10B981' : '#94A3B8' }} onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}>
              <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all" style={{ left: form.actif ? 24 : 4 }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>Module Tandem actif (visible sur la page publique)</span>
          </label>
        </div>
        <div className="px-4">
          {row('Prix tandem (€)', <input type="number" style={inp} value={form.prix_base} onChange={e => setForm(f => ({ ...f, prix_base: Number(e.target.value) }))} />)}
          {row('Prix vidéo (€)', <input type="number" style={inp} value={form.prix_video} onChange={e => setForm(f => ({ ...f, prix_video: Number(e.target.value) }))} />)}
          {row('Prix photos (€)', <input type="number" style={inp} value={form.prix_photos} onChange={e => setForm(f => ({ ...f, prix_photos: Number(e.target.value) }))} />)}
          {row('Acompte (%)', <input type="number" min={0} max={100} style={inp} value={form.pct_acompte} onChange={e => setForm(f => ({ ...f, pct_acompte: Number(e.target.value) }))} />)}
          {row('Poids min (kg)', <input type="number" style={inp} value={form.poids_min} onChange={e => setForm(f => ({ ...f, poids_min: Number(e.target.value) }))} />)}
          {row('Poids max (kg)', <input type="number" style={inp} value={form.poids_max} onChange={e => setForm(f => ({ ...f, poids_max: Number(e.target.value) }))} />)}
          {row('Validité bons (mois)', <input type="number" style={inp} value={form.validite_bon_mois} onChange={e => setForm(f => ({ ...f, validite_bon_mois: Number(e.target.value) }))} />)}
          {row('Politique météo', (
            <select style={{ ...inp, cursor: 'pointer' }} value={form.politique_meteo} onChange={e => setForm(f => ({ ...f, politique_meteo: e.target.value }))}>
              <option value="report_gratuit">Report gratuit illimité</option>
              <option value="remboursement">Remboursement possible</option>
              <option value="au_choix">Report ou remboursement au choix</option>
            </select>
          ))}
          {row('URL avis Google', <input type="url" style={inp} value={form.url_avis_google ?? ''} onChange={e => setForm(f => ({ ...f, url_avis_google: e.target.value || null }))} placeholder="https://g.page/..." />)}
          {row('Description publique', (
            <textarea
              style={{ ...inp, resize: 'none', height: 80 }}
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))}
              placeholder="Présentez votre offre tandem..."
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--c-border)', background: 'var(--c-card)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>Emails automatiques</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-5 rounded-full relative" style={{ background: form.email_post_saut_actif ? '#10B981' : '#94A3B8' }} onClick={() => setForm(f => ({ ...f, email_post_saut_actif: !f.email_post_saut_actif }))}>
            <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: form.email_post_saut_actif ? 20 : 3 }} />
          </div>
          <span className="text-sm" style={{ color: 'var(--c-muted)' }}>Email post-saut (certificat + avis)</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-5 rounded-full relative" style={{ background: form.email_j7_actif ? '#10B981' : '#94A3B8' }} onClick={() => setForm(f => ({ ...f, email_j7_actif: !f.email_j7_actif }))}>
            <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: form.email_j7_actif ? 20 : 3 }} />
          </div>
          <span className="text-sm" style={{ color: 'var(--c-muted)' }}>Email J+7 (offre PAC)</span>
        </label>
      </div>

      <button onClick={save} disabled={saving} className="w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-50" style={{ background: saved ? '#10B981' : '#F97316' }}>
        {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer la configuration'}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TandemSection({ centreId }: { centreId: string }) {
  const [onglet, setOnglet] = useState<Onglet>('planning');
  const [config, setConfig] = useState<TandemConfig | null>(null);
  const [licencies, setLicencies] = useState<Licencie[]>([]);
  const [centreSlug, setCentreSlug] = useState(centreId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: centreInfo } = await supabase.from('centres').select('slug').eq('id', centreId).maybeSingle();
      if (centreInfo?.slug) setCentreSlug(centreInfo.slug);

      const { data: cfg } = await supabase.from('tandem_config').select('*').eq('centre_id', centreId).maybeSingle();
      setConfig(cfg as TandemConfig ?? {
        centre_id: centreId, actif: false, prix_base: 220, prix_video: 60, prix_photos: 30,
        pct_acompte: 30, poids_min: 40, poids_max: 100, validite_bon_mois: 18,
        politique_meteo: 'report_gratuit', url_avis_google: null, description: null,
        email_post_saut_actif: true, email_j7_actif: true,
      });

      const { data: lic } = await supabase
        .from('licencies_centres')
        .select('parachutiste_id, profil:profiles!licencies_centres_parachutiste_id_fkey(id, nom, prenom)')
        .eq('centre_id', centreId)
        .eq('statut', 'actif');
      if (lic) {
        setLicencies(lic.map((l: { profil: { id: string; nom: string; prenom: string } | null }) => l.profil).filter((p): p is Licencie => !!p));
      }
      setLoading(false);
    })();
  }, [centreId]);

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--c-muted)' }}>Chargement...</div>;

  const ONGLETS: { id: Onglet; label: string }[] = [
    { id: 'planning', label: '📅 Planning' },
    { id: 'bons', label: '🎁 Bons cadeaux' },
    { id: 'stats', label: '📊 Stats' },
    { id: 'config', label: '⚙️ Config' },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>🪂 Module Tandem</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--c-muted)' }}>Réservations, bons cadeaux, dossiers passagers</p>
        </div>
        <div className="flex items-center gap-2">
          {config?.actif ? (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>● Actif</span>
          ) : (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(148,163,184,0.12)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.3)' }}>○ Inactif</span>
          )}
        </div>
      </div>

      <div className="flex mb-6 overflow-x-auto" style={{ borderBottom: '1px solid var(--c-border)' }}>
        {ONGLETS.map(tab => (
          <button key={tab.id} onClick={() => setOnglet(tab.id)}
            className="px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
            style={{ color: onglet === tab.id ? 'var(--c-text)' : 'var(--c-muted)', background: 'transparent', border: 'none', borderBottom: `2px solid ${onglet === tab.id ? '#F97316' : 'transparent'}`, cursor: 'pointer', fontWeight: onglet === tab.id ? 600 : 400 } as React.CSSProperties}>
            {tab.label}
          </button>
        ))}
      </div>

      {onglet === 'planning' && config && <OngletPlanning centreId={centreId} centreSlug={centreSlug} config={config} licencies={licencies} />}
      {onglet === 'bons' && <OngletBons centreId={centreId} />}
      {onglet === 'stats' && <OngletStats centreId={centreId} />}
      {onglet === 'config' && config && <OngletConfig centreId={centreId} config={config} onSaved={setConfig} />}
    </div>
  );
}
