import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ymdLocal } from '../lib/datetime';
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Users, Clock,
  Send, Plane, BarChart2, Download, ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Creneau {
  id: string;
  centre_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  statut: 'ouvert' | 'ferme' | 'sous_reserve' | 'annule';
  titre: string | null;
  message: string | null;
  offre_promo: string | null;
  nb_places_total: number;
  nb_places_restantes: number;
  avion: string | null;
  altitude_prevue: number | null;
  type_saut: string[] | null;
  notifier_licencies: boolean;
}

interface InscriptionWithProfile {
  id: string;
  parachutiste_id: string;
  statut: 'present' | 'peut_etre' | 'absent';
  commentaire: string | null;
  profiles: { nom: string; prenom: string; numero_brevet_moniteur?: string | null };
}

const STATUT_CONFIG = {
  ouvert: { bgLight: '#DCFCE7', bg: '#10B981', text: '#065F46', label: 'Ouvert', emoji: '🟢' },
  ferme: { bgLight: '#FEE2E2', bg: '#EF4444', text: '#991B1B', label: 'Fermé', emoji: '🔴' },
  sous_reserve: { bgLight: '#FEF3C7', bg: '#F59E0B', text: '#92400E', label: 'Sous réserve', emoji: '🟡' },
  annule: { bgLight: '#F1F5F9', bg: '#64748B', text: '#334155', label: 'Annulé', emoji: '⛔' },
};

const TYPES_SAUTS = ['OA', 'OC', 'OR', 'PAC', 'Tandem', 'Compétition', 'Stage'];

// ─── Modal création / édition créneau ────────────────────────────────────────

function ModalCreneau({
  centreId, date, creneau, onClose, onSaved,
}: {
  centreId: string;
  date: string;
  creneau: Creneau | null;
  onClose: () => void;
  onSaved: (saved: Creneau) => void;
}) {
  const [statut, setStatut] = useState<Creneau['statut']>(creneau?.statut ?? 'ouvert');
  const [heureDebut, setHeureDebut] = useState(creneau?.heure_debut?.slice(0, 5) ?? '09:00');
  const [heureFin, setHeureFin] = useState(creneau?.heure_fin?.slice(0, 5) ?? '18:00');
  const [places, setPlaces] = useState(creneau?.nb_places_total ?? 20);
  const [avion, setAvion] = useState(creneau?.avion ?? '');
  const [altitude, setAltitude] = useState(creneau?.altitude_prevue ?? 4000);
  const [typesSauts, setTypesSauts] = useState<string[]>(creneau?.type_saut ?? ['OA', 'OC']);
  const [titre, setTitre] = useState(creneau?.titre ?? '');
  const [message, setMessage] = useState(creneau?.message ?? '');
  const [offrePromo, setOffrePromo] = useState(creneau?.offre_promo ?? '');
  const [notifier, setNotifier] = useState(creneau?.notifier_licencies ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleType = (t: string) =>
    setTypesSauts(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      centre_id: centreId,
      date,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      statut,
      titre: titre || null,
      message: message || null,
      offre_promo: offrePromo || null,
      nb_places_total: places,
      nb_places_restantes: creneau
        ? creneau.nb_places_restantes + (places - creneau.nb_places_total)
        : places,
      avion: avion || null,
      altitude_prevue: altitude,
      type_saut: typesSauts,
      notifier_licencies: notifier,
    };

    const { data: saved, error: saveError } = creneau
      ? await supabase.from('creneaux_dz').update(payload).eq('id', creneau.id).select().single()
      : await supabase.from('creneaux_dz').insert(payload).select().single();

    if (saveError || !saved) {
      // Gestion d'erreur explicite : jamais de fermeture silencieuse.
      console.error('Enregistrement du créneau échoué :', saveError);
      setError(saveError?.message ?? "L'enregistrement a échoué. Réessayez.");
      setSaving(false);
      return;
    }

    if (notifier && statut === 'ouvert' && !creneau) {
      // Envoyer notif aux licenciés actifs
      const { data: licencies } = await supabase
        .from('licencies_centres')
        .select('parachutiste_id')
        .eq('centre_id', centreId)
        .eq('statut', 'actif');

      if (licencies?.length) {
        const dateLabel = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const notifs = licencies.map(l => ({
          user_id: l.parachutiste_id,
          type: 'creneau_ouvert',
          titre: '📅 Créneau ouvert',
          message: `${dateLabel}${titre ? ` — ${titre}` : ''} · ${heureDebut}-${heureFin}${message ? `\n"${message}"` : ''}`,
          data: { centre_id: centreId, date },
          lue: false,
        }));
        const { error: notifError } = await supabase.from('notifications').insert(notifs);
        // Non bloquant : le créneau est déjà persisté ; on trace sans masquer.
        if (notifError) console.error('Envoi des notifications échoué :', notifError);
      }
    }

    setSaving(false);
    onSaved(saved as Creneau);
    onClose();
  };

  const dateFormatted = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{creneau ? 'Modifier le créneau' : 'Nouveau créneau'}</h2>
            <p className="text-sm text-gray-500 capitalize">{dateFormatted}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Statut */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Statut</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(STATUT_CONFIG) as [Creneau['statut'], typeof STATUT_CONFIG[keyof typeof STATUT_CONFIG]][]).map(([key, sc]) => (
                <button
                  key={key}
                  onClick={() => setStatut(key)}
                  className="py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
                  style={{
                    background: statut === key ? sc.bgLight : '#F8FAFC',
                    border: `2px solid ${statut === key ? sc.bg : 'transparent'}`,
                    color: statut === key ? sc.text : '#64748B',
                  }}
                >
                  <span>{sc.emoji}</span> {sc.label}
                </button>
              ))}
            </div>
          </div>

          {statut === 'ouvert' || statut === 'sous_reserve' ? (
            <>
              {/* Horaires */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Heure début</label>
                  <input type="time" value={heureDebut} onChange={e => setHeureDebut(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Heure fin</label>
                  <input type="time" value={heureFin} onChange={e => setHeureFin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20" />
                </div>
              </div>

              {/* Places */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Places disponibles</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPlaces(p => Math.max(1, p - 1))}
                    className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600 transition-colors">−</button>
                  <span className="text-lg font-bold text-gray-900 w-12 text-center">{places}</span>
                  <button onClick={() => setPlaces(p => p + 1)}
                    className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600 transition-colors">+</button>
                </div>
              </div>

              {/* Avion + altitude */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Avion(s)</label>
                  <input value={avion} onChange={e => setAvion(e.target.value)} placeholder="Cessna 182…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Altitude (m)</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAltitude(a => Math.max(1000, a - 200))}
                      className="w-7 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition-colors">−</button>
                    <span className="text-sm font-bold text-gray-900 flex-1 text-center">{altitude}m</span>
                    <button onClick={() => setAltitude(a => Math.min(5500, a + 200))}
                      className="w-7 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition-colors">+</button>
                  </div>
                </div>
              </div>

              {/* Types de sauts */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Types de sauts</label>
                <div className="flex flex-wrap gap-2">
                  {TYPES_SAUTS.map(t => (
                    <button key={t} onClick={() => toggleType(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: typesSauts.includes(t) ? '#EFF6FF' : '#F8FAFC',
                        border: `1.5px solid ${typesSauts.includes(t) ? '#2563EB' : '#E2E8F0'}`,
                        color: typesSauts.includes(t) ? '#1D4ED8' : '#64748B',
                      }}>
                      {typesSauts.includes(t) ? '☑' : '☐'} {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Titre */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Titre (optionnel)</label>
                <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Journée VR4, Stage PAC…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20" />
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</label>
                  <span className="text-xs text-gray-400">{message.length}/280</span>
                </div>
                <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 280))}
                  rows={3} placeholder="Conditions météo parfaites prévues ! Venez nombreux 🪂"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 resize-none" />
              </div>

              {/* Offre promo */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Offre promo (optionnel)</label>
                <input value={offrePromo} onChange={e => setOffrePromo(e.target.value)} placeholder="10% de réduction pour les nouveaux membres"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20" />
              </div>

              {/* Notification */}
              {!creneau && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setNotifier(n => !n)}
                    className="w-10 h-6 rounded-full relative transition-all flex-shrink-0"
                    style={{ background: notifier ? '#2563EB' : '#E2E8F0' }}>
                    <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
                      style={{ left: notifier ? '22px' : '2px' }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Notifier mes licenciés</div>
                    <div className="text-xs text-gray-500">Envoie une notification à tous vos licenciés actifs</div>
                  </div>
                </label>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 text-center">
              Le créneau sera marqué comme {STATUT_CONFIG[statut].label.toLowerCase()}. Vos licenciés seront notifiés si applicable.
            </div>
          )}
        </div>

        {/* Erreur explicite */}
        {error && (
          <div role="alert" className="mx-6 mb-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-2 flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            style={{ background: saving ? '#CBD5E1' : 'linear-gradient(135deg, #001A4D, #1E3A5F)' }}>
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement…</>
            ) : (
              <><Check className="w-4 h-4" /> {notifier && !creneau ? 'Enregistrer et notifier' : 'Enregistrer'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Détail des inscrits ──────────────────────────────────────────────────────

function InscritsList({ creneau, onClose }: { creneau: Creneau; onClose: () => void }) {
  const [inscrits, setInscrits] = useState<InscriptionWithProfile[]>([]);
  const [filter, setFilter] = useState<'all' | 'present' | 'peut_etre' | 'absent'>('all');
  const [loading, setLoading] = useState(true);

  const loadInscrits = useCallback(async () => {
    const { data } = await supabase
      .from('inscriptions_creneaux')
      .select('*, profiles!parachutiste_id(nom, prenom)')
      .eq('creneau_id', creneau.id);
    setInscrits((data as InscriptionWithProfile[]) ?? []);
    setLoading(false);
  }, [creneau.id]);

  useEffect(() => { loadInscrits(); }, [loadInscrits]);

  // Realtime: update list when any inscription changes for this créneau
  useEffect(() => {
    const channel = supabase
      .channel(`inscrits-${creneau.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inscriptions_creneaux',
        filter: `creneau_id=eq.${creneau.id}`,
      }, () => { loadInscrits(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [creneau.id, loadInscrits]);

  const filtered = filter === 'all' ? inscrits : inscrits.filter(i => i.statut === filter);
  const counts = {
    present: inscrits.filter(i => i.statut === 'present').length,
    peut_etre: inscrits.filter(i => i.statut === 'peut_etre').length,
    absent: inscrits.filter(i => i.statut === 'absent').length,
  };

  const exportCSV = () => {
    const rows = [['Prénom', 'Nom', 'Statut', 'Commentaire']];
    inscrits.forEach(i => rows.push([
      i.profiles.prenom, i.profiles.nom,
      i.statut === 'present' ? 'Je viens' : i.statut === 'peut_etre' ? 'Peut-être' : 'Absent',
      i.commentaire ?? '',
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `inscrits-${creneau.date}.csv`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Inscrits — {new Date(creneau.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{inscrits.length} réponses · {counts.present}/{creneau.nb_places_total} confirmés</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Exporter CSV">
              <Download className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Fill bar */}
        {creneau.nb_places_total > 0 && (
          <div className="px-5 pt-3 pb-1">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (counts.present / creneau.nb_places_total) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{counts.present} confirmés · {counts.peut_etre} peut-être · {counts.absent} absents</span>
              <span>{creneau.nb_places_restantes} places restantes</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1 px-5 pt-3">
          {([['all', 'Tous', inscrits.length], ['present', '✓ Viennent', counts.present], ['peut_etre', '? Peut-être', counts.peut_etre], ['absent', '✗ Absents', counts.absent]] as const).map(([key, label, count]) => (
            <button key={key} onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === key ? '#001A4D' : '#F8FAFC',
                color: filter === key ? 'white' : '#64748B',
              }}>
              {label} {count > 0 && `(${count})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="overflow-y-auto px-5 py-3 space-y-2" style={{ maxHeight: '55vh' }}>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#001A4D] border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Aucun inscrit dans cette catégorie</p>
          ) : (
            filtered.map(i => (
              <div key={i.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-[#001A4D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {i.profiles.prenom[0]}{i.profiles.nom[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{i.profiles.prenom} {i.profiles.nom}</div>
                  {i.commentaire && <div className="text-xs text-gray-400 truncate">{i.commentaire}</div>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                  style={{
                    background: i.statut === 'present' ? '#DCFCE7' : i.statut === 'peut_etre' ? '#FEF3C7' : '#FEE2E2',
                    color: i.statut === 'present' ? '#065F46' : i.statut === 'peut_etre' ? '#92400E' : '#991B1B',
                  }}>
                  {i.statut === 'present' ? '✓ Vient' : i.statut === 'peut_etre' ? '? Peut-être' : '✗ Absent'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main PlanningCentre ──────────────────────────────────────────────────────

export function PlanningCentre({ centreId }: { centreId: string }) {
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [editCreneau, setEditCreneau] = useState<Creneau | null>(null);
  const [listeCreneau, setListeCreneau] = useState<Creneau | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const loadCreneaux = useCallback(async () => {
    const from = ymdLocal(new Date(year, month, 1));
    const to = ymdLocal(new Date(year, month + 1, 0));
    const { data } = await supabase
      .from('creneaux_dz')
      .select('*')
      .eq('centre_id', centreId)
      .gte('date', from)
      .lte('date', to)
      .order('date');
    setCreneaux((data as Creneau[]) ?? []);
    setLoading(false);
  }, [centreId, year, month]);

  useEffect(() => { loadCreneaux(); }, [loadCreneaux]);

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = 0; i < startOffset; i++) days.push(new Date(year, month, -startOffset + i + 1));
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(new Date(year, month + 1, days.length - lastDay.getDate() - startOffset + 1));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const getForDate = (d: Date) => creneaux.find(c => c.date === ymdLocal(d)) ?? null;

  // Stats
  const joursOuverts = creneaux.filter(c => c.statut === 'ouvert').length;
  const totalInscrits = creneaux.reduce((s, c) => s + (c.nb_places_total - c.nb_places_restantes), 0);
  const tauxRemplissage = joursOuverts > 0
    ? Math.round((totalInscrits / creneaux.filter(c => c.statut === 'ouvert').reduce((s, c) => s + c.nb_places_total, 0)) * 100)
    : 0;

  // Today's créneau
  const todayKey = ymdLocal(today);
  const creneauAuj = creneaux.find(c => c.date === todayKey && c.statut === 'ouvert');
  const inscritsAuj = creneauAuj ? creneauAuj.nb_places_total - creneauAuj.nb_places_restantes : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Planning DZ</h1>
        <button
          onClick={() => setStatsOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
          Stats
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {statsOpen && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Jours ouverts', value: `${joursOuverts}`, sub: `sur ${days.filter(d => d.getMonth() === month).length} ce mois` },
            { label: 'Total inscrits', value: String(totalInscrits), sub: 'ce mois' },
            { label: 'Taux de remplissage', value: `${tauxRemplissage}%`, sub: 'des places' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs font-semibold text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Today summary */}
      {creneauAuj && (
        <div className="bg-white rounded-2xl border border-green-200 p-5" style={{ boxShadow: '0 4px 16px rgba(16,185,129,0.1)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: '#DCFCE7' }}>📅</div>
            <div>
              <div className="font-bold text-gray-900">Aujourd'hui — Ouvert</div>
              <div className="text-sm text-gray-500">{creneauAuj.heure_debut.slice(0,5)}-{creneauAuj.heure_fin.slice(0,5)} {creneauAuj.avion ? `· ${creneauAuj.avion}` : ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-700 font-semibold">
              <Users className="w-4 h-4" /> {inscritsAuj}/{creneauAuj.nb_places_total} inscrits
            </span>
          </div>
          <button onClick={() => setListeCreneau(creneauAuj)}
            className="mt-3 text-xs font-semibold text-blue-600 hover:underline">
            Voir la liste complète →
          </button>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="font-semibold text-gray-900 capitalize">
            {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-7 px-3 pt-3 pb-1">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 pb-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 px-3 pb-3">
          {days.map((d, i) => {
            const c = getForDate(d);
            const sc = c ? STATUT_CONFIG[c.statut] : null;
            const isCurrentMonth = d.getMonth() === month;
            const dToday = new Date(); dToday.setHours(0, 0, 0, 0);
            const isToday = d.getTime() === dToday.getTime();
            const nbInscrits = c ? c.nb_places_total - c.nb_places_restantes : 0;
            return (
              <button
                key={i}
                onClick={() => {
                  if (!isCurrentMonth) return;
                  if (c) setEditCreneau(c);
                  else setModalDate(ymdLocal(d));
                }}
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden group"
                style={{
                  background: sc ? sc.bgLight : isToday ? '#EFF6FF' : '#F8FAFC',
                  border: isToday ? '2px solid #2563EB' : `1px solid ${sc ? sc.bg + '30' : '#E2E8F0'}`,
                  opacity: isCurrentMonth ? 1 : 0.3,
                  cursor: isCurrentMonth ? 'pointer' : 'default',
                }}
              >
                <span className="text-xs font-semibold" style={{ color: isToday ? '#2563EB' : sc ? sc.text : '#64748B' }}>
                  {d.getDate()}
                </span>
                {sc ? (
                  <span className="text-[8px] font-bold" style={{ color: sc.bg }}>{sc.emoji}</span>
                ) : isCurrentMonth ? (
                  <span className="text-[10px] text-gray-300 group-hover:text-blue-300 transition-colors">+</span>
                ) : null}
                {c && nbInscrits > 0 && (
                  <span className="text-[7px] font-bold leading-none" style={{ color: sc?.text }}>
                    ✓{nbInscrits}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 px-5 pb-4 flex-wrap">
          {Object.values(STATUT_CONFIG).map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: s.bgLight, border: `1px solid ${s.bg + '50'}` }} />
              <span className="text-[10px] text-gray-500">{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Plus className="w-3 h-3 text-gray-300" />
            <span className="text-[10px] text-gray-400">Cliquer pour créer</span>
          </div>
        </div>
      </div>

      {/* Liste des prochains créneaux */}
      {creneaux.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Créneaux de ce mois</h2>
          {creneaux.map(c => {
            const sc = STATUT_CONFIG[c.statut];
            const inscrits = c.nb_places_total - c.nb_places_restantes;
            const dateLabel = new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: sc.bgLight }}>
                  {sc.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 capitalize">{dateLabel}</div>
                  <div className="text-xs text-gray-500">
                    <Clock className="w-3 h-3 inline mr-0.5" />{c.heure_debut.slice(0,5)}-{c.heure_fin.slice(0,5)}
                    {c.avion && <><Plane className="w-3 h-3 inline mx-1" />{c.avion}</>}
                  </div>
                </div>
                {c.statut === 'ouvert' && (
                  <button onClick={() => setListeCreneau(c)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50">
                    <Users className="w-3.5 h-3.5" /> {inscrits}/{c.nb_places_total}
                  </button>
                )}
                <button onClick={() => setEditCreneau(c)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                  <span className="text-xs text-gray-400">Modifier</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {loading && creneaux.length === 0 && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Modals */}
      {(modalDate || editCreneau) && (
        <ModalCreneau
          centreId={centreId}
          date={editCreneau?.date ?? modalDate!}
          creneau={editCreneau}
          onClose={() => { setModalDate(null); setEditCreneau(null); }}
          onSaved={(saved) => {
            // MAJ immédiate de l'état local, sans rechargement réseau : les
            // compteurs (jours ouverts…) en dérivent et se rafraîchissent seuls.
            setCreneaux(prev => {
              const next = prev.some(c => c.id === saved.id)
                ? prev.map(c => (c.id === saved.id ? saved : c))
                : [...prev, saved];
              return next.sort((a, b) => a.date.localeCompare(b.date));
            });
            setModalDate(null);
            setEditCreneau(null);
          }}
        />
      )}
      {listeCreneau && (
        <InscritsList creneau={listeCreneau} onClose={() => setListeCreneau(null)} />
      )}
    </div>
  );
}

// Suppress unused imports
void Send;
