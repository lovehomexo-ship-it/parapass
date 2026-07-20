import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { ChevronLeft, ChevronRight, Video, Camera, Gift, Check, X, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Centre {
  id: string;
  nom: string;
  ville: string;
  logo_url: string | null;
  slug: string | null;
  telephone: string | null;
  email: string | null;
}

interface TandemConfig {
  prix_base: number;
  prix_video: number;
  prix_photos: number;
  pct_acompte: number;
  poids_min: number;
  poids_max: number;
  politique_meteo: string;
  description: string | null;
}

interface Slot {
  id: string;
  date: string;
  heure: string;
  capacite: number;
  statut: string;
  booked: number;
}

type Step = 'landing' | 'creneaux' | 'form' | 'options' | 'recap' | 'confirme';
type Mode = 'reservation' | 'bon_cadeau';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

function politiqueLabel(p: string) {
  if (p === 'report_gratuit') return 'Report gratuit illimité si annulation météo';
  if (p === 'remboursement') return 'Remboursement possible sur demande si météo défavorable';
  return 'Report gratuit ou remboursement au choix si météo défavorable';
}

// ─── Calendrier ───────────────────────────────────────────────────────────────

function Calendrier({
  slots,
  selectedDate,
  onSelect,
}: {
  slots: Slot[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = getDaysInMonth(year, month);
  const firstDay = (getFirstDayOfMonth(year, month) + 6) % 7; // Mon=0

  const slotsByDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const arr = slotsByDate.get(s.date) ?? [];
    arr.push(s);
    slotsByDate.set(s.date, arr);
  }

  const today = isoDate(new Date());

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #E2E8F0' }}>
      {/* Header mois */}
      <div className="flex items-center justify-between px-5 py-4 bg-[#001A4D]">
        <button
          onClick={() => setCursor(c => { const n = new Date(c); n.setMonth(n.getMonth() - 1); return n; })}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-white font-bold capitalize">
          {cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => setCursor(c => { const n = new Date(c); n.setMonth(n.getMonth() + 1); return n; })}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 px-3 pt-3">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => (
          <div key={i} className="text-center text-xs font-semibold text-gray-400 pb-2">{j}</div>
        ))}
      </div>
      {/* Grille */}
      <div className="grid grid-cols-7 px-3 pb-4 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const daySlots = slotsByDate.get(dateStr) ?? [];
          const hasSlot = daySlots.some(s => s.statut === 'ouvert' && s.booked < s.capacite);
          const fullSlot = daySlots.length > 0 && !hasSlot;
          const isPast = dateStr < today;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={day}
              onClick={() => hasSlot ? onSelect(dateStr) : undefined}
              disabled={!hasSlot || isPast}
              className="aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all relative"
              style={{
                background: isSelected ? '#001A4D' : hasSlot ? 'rgba(249,115,22,0.08)' : 'transparent',
                color: isSelected ? 'white' : isPast ? '#CBD5E1' : hasSlot ? '#001A4D' : fullSlot ? '#94A3B8' : '#CBD5E1',
                border: isSelected ? '2px solid #001A4D' : hasSlot ? '2px solid rgba(249,115,22,0.3)' : '2px solid transparent',
                cursor: hasSlot ? 'pointer' : 'default',
              }}
            >
              {day}
              {hasSlot && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-400" />
              )}
              {fullSlot && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-gray-300" />
              )}
            </button>
          );
        })}
      </div>
      <div className="px-4 pb-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block" />Disponible</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" />Complet / passé</span>
      </div>
    </div>
  );
}

// ─── Formulaire réservation ───────────────────────────────────────────────────

interface BookingForm {
  offreurNom: string;
  offreurEmail: string;
  offreurTel: string;
  pourAutrui: boolean;
  passagerNom: string;
  passagerEmail: string;
  passagerTel: string;
  avecVideo: boolean;
  avecPhotos: boolean;
  giftCode: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TandemPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [centre, setCentre] = useState<Centre | null>(null);
  const [config, setConfig] = useState<TandemConfig | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('reservation');
  const [step, setStep] = useState<Step>('landing');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState<BookingForm>({
    offreurNom: '', offreurEmail: '', offreurTel: '',
    pourAutrui: false,
    passagerNom: '', passagerEmail: '', passagerTel: '',
    avecVideo: false, avecPhotos: false,
    giftCode: '',
  });
  const [giftCardForm, setGiftCardForm] = useState({
    formule: 'tandem' as 'tandem' | 'tandem_video' | 'tandem_photos' | 'montant_libre',
    montantLibre: '',
    acheteurNom: '', acheteurEmail: '',
    beneficiaireNom: '', beneficiaireEmail: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [giftCode, setGiftCode] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load centre + config + slots
  // Tolerant: if slug param is a UUID, resolve by id then redirect to slug URL
  useEffect(() => {
    (async () => {
      const param = slug ?? '';
      let centreData: Centre | null = null;

      if (UUID_RE.test(param)) {
        // Legacy URL with centre ID — resolve slug and redirect
        const { data } = await supabase
          .from('centres_public')
          .select('id, nom, slug, ville, logo_url, telephone, email')
          .eq('id', param)
          .maybeSingle();
        if (data?.slug) {
          navigate(`/dz/${data.slug}/tandem`, { replace: true });
          return;
        }
        centreData = data as Centre | null;
      } else {
        const { data } = await supabase
          .from('centres_public')
          .select('id, nom, slug, ville, logo_url, telephone, email')
          .eq('slug', param)
          .maybeSingle();
        centreData = data as Centre | null;
      }

      if (!centreData) { setErreur('not_found'); setLoading(false); return; }
      setCentre(centreData);

      const { data: cfg } = await supabase
        .from('tandem_config')
        .select('*')
        .eq('centre_id', centreData.id)
        .maybeSingle();
      if (!cfg || !cfg.actif) { setErreur('not_active'); setLoading(false); return; }
      setConfig(cfg as TandemConfig);

      // Load slots via aggregated view (anon-safe: no passenger data)
      const from = isoDate(new Date());
      const to = isoDate(addMonths(new Date(), 3));
      const { data: availData } = await supabase
        .from('tandem_slot_availability')
        .select('slot_id, date, heure, capacite, statut, booked')
        .eq('centre_id', centreData.id)
        .gte('date', from)
        .lte('date', to)
        .order('date').order('heure');

      setSlots((availData ?? []).map(s => ({
        id: s.slot_id,
        date: s.date,
        heure: s.heure,
        capacite: s.capacite,
        statut: s.statut,
        booked: Number(s.booked),
      })) as Slot[]);
      setLoading(false);
    })();
  }, [slug, navigate]);

  // Derived pricing
  const prixBase = config?.prix_base ?? 220;
  const prixVideo = config?.prix_video ?? 60;
  const prixPhotos = config?.prix_photos ?? 30;
  const prixTotal = prixBase + (form.avecVideo ? prixVideo : 0) + (form.avecPhotos ? prixPhotos : 0);
  const acompte = Math.round(prixTotal * (config?.pct_acompte ?? 30) / 100);
  const solde = prixTotal - acompte;

  const slotsForDate = (slots.filter(s => s.date === selectedDate && s.statut === 'ouvert' && s.booked < s.capacite));

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.offreurNom.trim()) errors.offreurNom = 'Obligatoire';
    if (!form.offreurEmail.trim() || !form.offreurEmail.includes('@')) errors.offreurEmail = 'Email invalide';
    if (form.pourAutrui && !form.passagerNom.trim()) errors.passagerNom = 'Obligatoire si pour autrui';
    if (form.pourAutrui && !form.passagerEmail.trim()) errors.passagerEmail = 'Obligatoire si pour autrui';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function confirmerReservation() {
    if (!validateForm()) return;
    if (!selectedSlot || !centre || !config) return;
    setSubmitting(true);

    // RPC bornée : crée la réservation + le passager, ne renvoie QUE le jeton dossier
    const nomComplet = form.pourAutrui ? form.passagerNom : form.offreurNom;
    const { data, error } = await supabase.rpc('tandem_reserver', {
      p: {
        slot_id: selectedSlot.id,
        centre_id: centre.id,
        offreur_nom: form.offreurNom.trim(),
        offreur_email: form.offreurEmail.trim(),
        offreur_tel: form.offreurTel.trim() || null,
        pour_autrui: form.pourAutrui,
        passager_nom: nomComplet.trim(),
        passager_email: (form.pourAutrui ? form.passagerEmail : form.offreurEmail).trim(),
        passager_tel: (form.pourAutrui ? form.passagerTel : form.offreurTel).trim() || null,
        avec_video: form.avecVideo,
        avec_photos: form.avecPhotos,
        prix_total: prixTotal,
        montant_acompte: acompte,
        montant_solde: solde,
        passager_prenom: nomComplet.split(' ')[0] || '',
        passager_nom_famille: nomComplet.split(' ').slice(1).join(' ') || '',
      },
    });

    setSubmitting(false);
    if (error || !data) {
      console.error('Réservation tandem échouée :', error);
      setFormErrors({ _global: 'Une erreur est survenue. Réessayez.' });
      return;
    }

    setBookingId((data as { booking_id: string }).booking_id);
    setStep('confirme');
  }

  async function acheterBonCadeau() {
    if (!centre || !config) return;
    const montant = giftCardForm.formule === 'tandem' ? prixBase
      : giftCardForm.formule === 'tandem_video' ? prixBase + prixVideo
      : giftCardForm.formule === 'tandem_photos' ? prixBase + prixPhotos
      : Number(giftCardForm.montantLibre);

    if (!giftCardForm.acheteurNom.trim() || !giftCardForm.acheteurEmail.includes('@')) {
      setFormErrors({ bon: 'Nom et email requis.' });
      return;
    }
    if (giftCardForm.formule === 'montant_libre' && (!montant || montant < 10)) {
      setFormErrors({ bon: 'Montant minimum : 10€' });
      return;
    }
    setSubmitting(true);
    const validite = new Date();
    validite.setMonth(validite.getMonth() + (config.validite_bon_mois ?? 18));

    // RPC bornée : crée le bon et ne renvoie QUE son code (aucune lecture des autres bons)
    const { data, error } = await supabase.rpc('tandem_giftcard_creer', {
      p: {
        centre_id: centre.id,
        formule: giftCardForm.formule,
        montant,
        acheteur_nom: giftCardForm.acheteurNom.trim(),
        acheteur_email: giftCardForm.acheteurEmail.trim(),
        beneficiaire_nom: giftCardForm.beneficiaireNom.trim() || null,
        beneficiaire_email: giftCardForm.beneficiaireEmail.trim() || null,
        message: giftCardForm.message.trim() || null,
        validite_jusqu_au: isoDate(validite),
      },
    });

    setSubmitting(false);
    if (error || !data) { console.error('Bon cadeau échoué :', error); setFormErrors({ bon: 'Erreur. Réessayez.' }); return; }
    setGiftCode((data as { code: string }).code);
    setStep('confirme');
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#001A4D]" />
    </div>
  );

  if (erreur) {
    const isNotFound = erreur === 'not_found';
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#001A4D] to-[#003082]">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-5">{isNotFound ? '🔍' : '🪂'}</div>
          <h1 className="text-2xl font-black text-white mb-3">
            {isNotFound ? 'Centre introuvable' : 'Réservations non disponibles'}
          </h1>
          <p className="text-white/60 text-sm mb-6">
            {isNotFound
              ? 'Ce centre n\'existe pas ou n\'est pas encore référencé sur ParaPass.'
              : 'La réservation en ligne n\'est pas encore activée pour ce centre. Contactez-les directement pour réserver.'}
          </p>
          <a
            href="https://parapass.fr"
            className="inline-block px-6 py-3 rounded-xl font-bold text-[#001A4D] text-sm"
            style={{ background: 'white' }}
          >
            ← Retour sur ParaPass
          </a>
        </div>
      </div>
    );
  }

  // ── Confirmation ──
  if (step === 'confirme') {
    if (mode === 'bon_cadeau' && giftCode) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">🎁</div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Bon cadeau créé !</h1>
            <p className="text-gray-500 text-sm mb-6">Le bon cadeau a bien été enregistré. Conservez ce code :</p>
            <div className="bg-[#001A4D] rounded-2xl py-5 px-6 mb-6">
              <p className="text-white/60 text-xs mb-1 uppercase tracking-wider">Code bon cadeau</p>
              <p className="text-white text-3xl font-black tracking-widest">{giftCode}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-left mb-6">
              <p className="text-sm text-amber-800 font-semibold mb-1">📧 Confirmation envoyée</p>
              <p className="text-xs text-amber-700">Un récapitulatif a été transmis à l'adresse fournie. Le bénéficiaire pourra réserver un créneau avec ce code.</p>
            </div>
            <p className="text-xs text-gray-400">Valable jusqu'au {(() => { const d = new Date(); d.setMonth(d.getMonth() + (config?.validite_bon_mois ?? 18)); return d.toLocaleDateString('fr-FR'); })()}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Réservation confirmée !</h1>
          <p className="text-gray-500 text-sm mb-2">
            {formatDate(selectedSlot?.date ?? '')} à {selectedSlot?.heure.slice(0, 5)} · {centre?.nom}
          </p>
          <p className="text-gray-400 text-xs mb-6">Un email de confirmation a été envoyé à {form.offreurEmail}</p>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-left">
            <p className="text-sm font-semibold text-blue-800 mb-1">📋 Prochaine étape</p>
            <p className="text-xs text-blue-700">Vous allez recevoir un lien pour compléter votre dossier passager (poids, contact d'urgence, décharge à signer). À faire avant le jour J !</p>
          </div>
          {solde > 0 && (
            <div className="mt-4 rounded-xl bg-orange-50 border border-orange-200 p-4 text-left">
              <p className="text-sm font-semibold text-orange-800 mb-1">💳 Solde à régler</p>
              <p className="text-xs text-orange-700">{solde} € à régler sur place le jour du saut.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const inp = (err?: string): React.CSSProperties => ({
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 15, outline: 'none',
    border: `1.5px solid ${err ? '#FCA5A5' : '#E2E8F0'}`,
    background: err ? '#FFF5F5' : 'white',
  });

  // ── Main layout ──
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-[#001A4D] text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            {centre?.logo_url ? (
              <img src={centre.logo_url} alt={centre.nom} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-black text-lg">
                {centre?.nom.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-white/60 text-xs">Saut en parachute tandem</p>
              <h1 className="font-black text-xl leading-tight">{centre?.nom} · {centre?.ville}</h1>
            </div>
            <div className="ml-auto">
              <ParaPassLogo className="h-6 opacity-60" />
            </div>
          </div>
          {config?.description && (
            <p className="text-white/70 text-sm leading-relaxed mb-4">{config.description}</p>
          )}
          {/* Prix capsules */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-orange-500 text-white text-sm font-bold px-4 py-1.5 rounded-full">
              Tandem solo {prixBase} €
            </span>
            <span className="bg-white/10 text-white/80 text-sm px-3 py-1.5 rounded-full">
              + Vidéo {prixVideo} €
            </span>
            <span className="bg-white/10 text-white/80 text-sm px-3 py-1.5 rounded-full">
              + Photos {prixPhotos} €
            </span>
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
          {([['reservation', '🪂 Réserver un saut'], ['bon_cadeau', '🎁 Bon cadeau']] as const).map(([m, l]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setStep(m === 'reservation' ? 'landing' : 'landing'); }}
              className="flex-1 py-4 text-sm font-semibold transition-colors"
              style={{
                color: mode === m ? '#001A4D' : '#94A3B8',
                borderBottom: `2px solid ${mode === m ? '#F97316' : 'transparent'}`,
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${mode === m ? '#F97316' : 'transparent'}` as unknown as string,
              } as React.CSSProperties}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="py-6 space-y-6">
          {/* ═══ MODE RÉSERVATION ═══ */}
          {mode === 'reservation' && (
            <>
              {/* Calendrier */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Choisissez une date</h2>
                <Calendrier slots={slots} selectedDate={selectedDate} onSelect={d => { setSelectedDate(d); setSelectedSlot(null); setStep('creneaux'); }} />
              </div>

              {/* Créneaux pour la date sélectionnée */}
              {selectedDate && slotsForDate.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-3 capitalize">{formatDate(selectedDate)}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {slotsForDate.map(s => {
                      const dispo = s.capacite - s.booked;
                      const isSelected = selectedSlot?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedSlot(s); setStep('form'); }}
                          className="rounded-xl p-4 text-left transition-all"
                          style={{
                            border: `2px solid ${isSelected ? '#001A4D' : '#E2E8F0'}`,
                            background: isSelected ? '#001A4D' : 'white',
                          }}
                        >
                          <p className="text-xl font-black" style={{ color: isSelected ? 'white' : '#001A4D' }}>
                            {s.heure.slice(0, 5)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : '#94A3B8' }}>
                            {dispo} place{dispo > 1 ? 's' : ''} disponible{dispo > 1 ? 's' : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Formulaire */}
              {selectedSlot && step !== 'confirme' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="bg-[#001A4D] px-5 py-4">
                    <p className="text-white/60 text-xs">Votre réservation</p>
                    <p className="text-white font-bold capitalize">{formatDate(selectedSlot.date)} · {selectedSlot.heure.slice(0, 5)}</p>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* Personne qui réserve */}
                    <div>
                      <h3 className="font-bold text-gray-900 mb-3">Vos coordonnées</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Nom complet *</label>
                          <input style={inp(formErrors.offreurNom)} value={form.offreurNom} onChange={e => setForm(f => ({ ...f, offreurNom: e.target.value }))} placeholder="Prénom Nom" />
                          {formErrors.offreurNom && <p className="text-xs text-red-500 mt-1">{formErrors.offreurNom}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                            <input style={inp(formErrors.offreurEmail)} value={form.offreurEmail} onChange={e => setForm(f => ({ ...f, offreurEmail: e.target.value }))} placeholder="email@exemple.fr" type="email" />
                            {formErrors.offreurEmail && <p className="text-xs text-red-500 mt-1">{formErrors.offreurEmail}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label>
                            <input style={inp()} value={form.offreurTel} onChange={e => setForm(f => ({ ...f, offreurTel: e.target.value }))} placeholder="06 00 00 00 00" type="tel" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pour autrui */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className="w-10 h-6 rounded-full transition-colors relative flex-shrink-0"
                        style={{ background: form.pourAutrui ? '#001A4D' : '#E2E8F0' }}
                        onClick={() => setForm(f => ({ ...f, pourAutrui: !f.pourAutrui }))}
                      >
                        <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all" style={{ left: form.pourAutrui ? 20 : 4 }} />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Je réserve pour quelqu'un d'autre</span>
                    </label>

                    {form.pourAutrui && (
                      <div>
                        <h3 className="font-bold text-gray-900 mb-3">Coordonnées du passager</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Nom du passager *</label>
                            <input style={inp(formErrors.passagerNom)} value={form.passagerNom} onChange={e => setForm(f => ({ ...f, passagerNom: e.target.value }))} placeholder="Prénom Nom" />
                            {formErrors.passagerNom && <p className="text-xs text-red-500 mt-1">{formErrors.passagerNom}</p>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Email passager *</label>
                              <input style={inp(formErrors.passagerEmail)} value={form.passagerEmail} onChange={e => setForm(f => ({ ...f, passagerEmail: e.target.value }))} placeholder="passager@exemple.fr" type="email" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Tél passager</label>
                              <input style={inp()} value={form.passagerTel} onChange={e => setForm(f => ({ ...f, passagerTel: e.target.value }))} placeholder="06..." type="tel" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Options */}
                    <div>
                      <h3 className="font-bold text-gray-900 mb-3">Options</h3>
                      <div className="space-y-2">
                        {[
                          { key: 'avecVideo', icon: Video, label: 'Vidéo de votre saut', prix: prixVideo },
                          { key: 'avecPhotos', icon: Camera, label: 'Pack photos', prix: prixPhotos },
                        ].map(opt => {
                          const checked = form[opt.key as keyof BookingForm] as boolean;
                          return (
                            <label key={opt.key} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors" style={{ border: `2px solid ${checked ? '#001A4D' : '#E2E8F0'}`, background: checked ? '#F0F4FF' : 'white' }}>
                              <input type="checkbox" checked={checked} onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))} className="hidden" />
                              <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: checked ? '#001A4D' : '#E2E8F0' }}>
                                {checked && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <opt.icon className="w-4 h-4 text-gray-500" />
                              <span className="flex-1 text-sm font-medium text-gray-800">{opt.label}</span>
                              <span className="text-sm font-bold text-gray-900">+{opt.prix} €</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bon cadeau */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Code bon cadeau (optionnel)</label>
                      <input style={inp()} value={form.giftCode} onChange={e => setForm(f => ({ ...f, giftCode: e.target.value.toUpperCase() }))} placeholder="Ex : A1B2C3D4" />
                    </div>

                    {/* Récap prix */}
                    <div className="rounded-xl p-4 space-y-1" style={{ background: '#F8FAFC' }}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tandem</span>
                        <span className="font-medium">{prixBase} €</span>
                      </div>
                      {form.avecVideo && <div className="flex justify-between text-sm"><span className="text-gray-600">Vidéo</span><span>+{prixVideo} €</span></div>}
                      {form.avecPhotos && <div className="flex justify-between text-sm"><span className="text-gray-600">Photos</span><span>+{prixPhotos} €</span></div>}
                      <div className="border-t border-slate-200 pt-2 mt-2">
                        <div className="flex justify-between font-black text-gray-900">
                          <span>Total</span>
                          <span>{prixTotal} €</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 mt-1">
                          <span>Acompte ({config?.pct_acompte}%)</span>
                          <span>{acompte} €</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Solde sur place</span>
                          <span>{solde} €</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{politiqueLabel(config?.politique_meteo ?? 'report_gratuit')}</span>
                    </div>

                    {formErrors._global && (
                      <p className="text-sm text-red-500 text-center">{formErrors._global}</p>
                    )}

                    <button
                      onClick={confirmerReservation}
                      disabled={submitting}
                      className="w-full py-4 rounded-2xl font-black text-white text-base transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #001A4D, #003082)', boxShadow: '0 4px 20px rgba(0,26,77,0.3)' }}
                    >
                      {submitting ? 'Réservation en cours...' : `Réserver · Acompte ${acompte} €`}
                    </button>
                    <p className="text-xs text-gray-400 text-center">Paiement sécurisé · Confirmation immédiate par email</p>
                  </div>
                </div>
              )}

              {/* Politique */}
              <div className="rounded-xl p-4 border border-slate-200 bg-white text-sm text-gray-600 space-y-2">
                <p className="font-semibold text-gray-900">📋 Bon à savoir</p>
                <p>• Poids minimum {config?.poids_min} kg, maximum {config?.poids_max} kg</p>
                <p>• {politiqueLabel(config?.politique_meteo ?? 'report_gratuit')}</p>
                <p>• Dossier passager (poids, décharge) à compléter avant le jour J</p>
                {centre?.telephone && <p>• Contact : {centre.telephone}</p>}
              </div>
            </>
          )}

          {/* ═══ MODE BON CADEAU ═══ */}
          {mode === 'bon_cadeau' && step !== 'confirme' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-[#001A4D] px-5 py-4">
                  <p className="text-white/60 text-xs">Bon cadeau · {centre?.nom}</p>
                  <p className="text-white font-bold">Offrez l'aventure</p>
                </div>
                <div className="p-5 space-y-5">
                  {/* Formule */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Choisissez une formule</h3>
                    <div className="space-y-2">
                      {([
                        { val: 'tandem', label: 'Tandem solo', prix: prixBase },
                        { val: 'tandem_video', label: 'Tandem + Vidéo', prix: prixBase + prixVideo },
                        { val: 'tandem_photos', label: 'Tandem + Photos', prix: prixBase + prixPhotos },
                        { val: 'montant_libre', label: 'Montant libre', prix: null },
                      ] as const).map(f => {
                        const sel = giftCardForm.formule === f.val;
                        return (
                          <label key={f.val} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors" style={{ border: `2px solid ${sel ? '#001A4D' : '#E2E8F0'}`, background: sel ? '#F0F4FF' : 'white' }}>
                            <input type="radio" name="formule" checked={sel} onChange={() => setGiftCardForm(g => ({ ...g, formule: f.val }))} className="hidden" />
                            <div className="w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center" style={{ borderColor: sel ? '#001A4D' : '#E2E8F0' }}>
                              {sel && <div className="w-2.5 h-2.5 rounded-full bg-[#001A4D]" />}
                            </div>
                            <Gift className="w-4 h-4 text-gray-400" />
                            <span className="flex-1 text-sm font-medium text-gray-800">{f.label}</span>
                            {f.prix && <span className="text-sm font-black text-gray-900">{f.prix} €</span>}
                          </label>
                        );
                      })}
                    </div>
                    {giftCardForm.formule === 'montant_libre' && (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Montant (€) *</label>
                        <input style={inp()} value={giftCardForm.montantLibre} onChange={e => setGiftCardForm(g => ({ ...g, montantLibre: e.target.value }))} placeholder="Ex : 150" type="number" min="10" />
                      </div>
                    )}
                  </div>

                  {/* Acheteur */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Vos coordonnées</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Votre nom *</label>
                        <input style={inp()} value={giftCardForm.acheteurNom} onChange={e => setGiftCardForm(g => ({ ...g, acheteurNom: e.target.value }))} placeholder="Prénom Nom" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Votre email *</label>
                        <input style={inp()} value={giftCardForm.acheteurEmail} onChange={e => setGiftCardForm(g => ({ ...g, acheteurEmail: e.target.value }))} placeholder="votre@email.fr" type="email" />
                      </div>
                    </div>
                  </div>

                  {/* Bénéficiaire */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Bénéficiaire (optionnel)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
                        <input style={inp()} value={giftCardForm.beneficiaireNom} onChange={e => setGiftCardForm(g => ({ ...g, beneficiaireNom: e.target.value }))} placeholder="Prénom Nom" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                        <input style={inp()} value={giftCardForm.beneficiaireEmail} onChange={e => setGiftCardForm(g => ({ ...g, beneficiaireEmail: e.target.value }))} placeholder="beneficiaire@email.fr" type="email" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Message personnalisé</label>
                        <textarea style={{ ...inp(), resize: 'none', height: 80 } as React.CSSProperties} value={giftCardForm.message} onChange={e => setGiftCardForm(g => ({ ...g, message: e.target.value }))} placeholder="Un petit mot pour accompagner le bon cadeau..." />
                      </div>
                    </div>
                  </div>

                  {formErrors.bon && <p className="text-sm text-red-500">{formErrors.bon}</p>}

                  <button
                    onClick={acheterBonCadeau}
                    disabled={submitting}
                    className="w-full py-4 rounded-2xl font-black text-white text-base disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #001A4D, #003082)' }}
                  >
                    {submitting ? 'Création...' : 'Créer le bon cadeau'}
                  </button>
                  <p className="text-xs text-gray-400 text-center">Validité {config?.validite_bon_mois} mois · Code unique remis immédiatement</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">Réservation sécurisée via <span className="font-semibold">ParaPass</span> · Partenaire numérique des clubs FFP</p>
      </div>
    </div>
  );
}
