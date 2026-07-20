import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { Check, AlertTriangle, PenTool } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  slot_id: string;
  offreur_nom: string;
  offreur_email: string;
  passager_nom: string | null;
  passager_email: string | null;
  avec_video: boolean;
  avec_photos: boolean;
  prix_total: number;
  montant_solde: number;
  statut: string;
  dossier_complete: boolean;
  centre: { nom: string; ville: string } | null;
  slot: { date: string; heure: string } | null;
}

interface Passenger {
  id: string;
  nom: string;
  prenom: string;
  date_naissance: string | null;
  poids: number | null;
  contact_urgence_nom: string | null;
  contact_urgence_tel: string | null;
  nationalite: string | null;
  adresse: string | null;
  decharge_signee: boolean;
}

interface TandemConfig {
  poids_min: number;
  poids_max: number;
}

// ─── Signature Canvas ─────────────────────────────────────────────────────────

function SignatureCanvas({ onSigned }: { onSigned: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#001A4D';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasSignature(true);
    };
    const end = () => {
      drawing.current = false;
      if (hasSignature) onSigned(canvas.toDataURL());
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [hasSignature, onSigned]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-slate-300" style={{ background: '#F8FAFC' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full touch-none"
          style={{ cursor: 'crosshair' }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-slate-400">
              <PenTool className="w-5 h-5" />
              <span className="text-sm">Signez ici avec le doigt ou la souris</span>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition"
      >
        ✕ Effacer et recommencer
      </button>
    </div>
  );
}

// ─── Décharge texte ───────────────────────────────────────────────────────────

const TEXTE_DECHARGE = `Je soussigné(e), passager(ère) tandem, déclare :

1. Avoir été informé(e) des risques inhérents à la pratique du parachutisme en tandem, notamment les risques de blessure grave ou mortelle.

2. Être en bonne condition physique et ne pas souffrir de contre-indication médicale connue (problèmes cardiaques, épilepsie, fractures récentes, grossesse, etc.).

3. Ne pas être sous l'influence de l'alcool ou de stupéfiants.

4. Avoir communiqué mon poids exact, sachant que tout dépassement de la limite maximale autorisée par le centre pourrait entraîner l'annulation du saut sans remboursement.

5. Avoir pris connaissance et accepté les Conditions Générales de Vente du centre.

6. Reconnaître que la pratique du parachutisme se déroule sous ma responsabilité personnelle et que le moniteur tandem ne saurait être tenu responsable d'un accident résultant d'un manquement aux consignes.

En signant ce document électronique, je confirme avoir lu et compris l'intégralité de la présente décharge.`;

// ─── Étapes ───────────────────────────────────────────────────────────────────

type Step = 'infos' | 'poids' | 'decharge' | 'done';

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TandemPreparerPage() {
  const { token } = useParams<{ token: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [config, setConfig] = useState<TandemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('infos');
  const [saving, setSaving] = useState(false);

  const [infos, setInfos] = useState({
    prenom: '', nom: '', dateNaissance: '',
    contactUrgenceNom: '', contactUrgenceTel: '',
    nationalite: '', adresse: '',
  });
  const [poids, setPoids] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [signatureSaved, setSignatureSaved] = useState(false);

  useEffect(() => {
    if (!token) { setErreur('Lien invalide.'); setLoading(false); return; }
    (async () => {
      // RPC bornée au jeton : ne renvoie QUE cette réservation (jamais de lecture large)
      const { data: dossier, error } = await supabase.rpc('tandem_dossier_get', { p_token: token });
      if (error) console.error('Chargement dossier tandem échoué :', error);
      const b = (dossier as { booking?: Booking } | null)?.booking ?? null;

      if (!b) { setErreur('Lien introuvable ou expiré.'); setLoading(false); return; }
      setBooking(b as unknown as Booking);

      const cfg = (dossier as { config?: TandemConfig } | null)?.config;
      if (cfg) setConfig(cfg as TandemConfig);

      const p = (dossier as { passenger?: Passenger } | null)?.passenger ?? null;

      if (p) {
        setPassenger(p as Passenger);
        setInfos({
          prenom: p.prenom || '',
          nom: p.nom || '',
          dateNaissance: p.date_naissance || '',
          contactUrgenceNom: p.contact_urgence_nom || '',
          contactUrgenceTel: p.contact_urgence_tel || '',
          nationalite: p.nationalite || '',
          adresse: p.adresse || '',
        });
        if (p.poids) setPoids(String(p.poids));
        if (p.decharge_signee) {
          setSignatureSaved(true);
          setStep('done');
        }
      }
      setLoading(false);
    })();
  }, [token]);

  /** Toutes les écritures passent par la RPC bornée au jeton — erreurs affichées. */
  async function enregistrerPassager(champs: Record<string, unknown>): Promise<boolean> {
    const { data, error } = await supabase.rpc('tandem_passager_enregistrer', { p_token: token, p: champs });
    if (error || !data) {
      console.error('Enregistrement passager échoué :', error);
      setErreur('L\'enregistrement a échoué. Réessayez.');
      return false;
    }
    setPassenger(data as Passenger);
    return true;
  }

  async function saveInfos() {
    if (!booking || !infos.prenom || !infos.nom) return;
    setSaving(true);
    const ok = await enregistrerPassager({
      prenom: infos.prenom.trim(),
      nom: infos.nom.trim(),
      date_naissance: infos.dateNaissance || null,
      contact_urgence_nom: infos.contactUrgenceNom.trim() || null,
      contact_urgence_tel: infos.contactUrgenceTel.trim() || null,
      nationalite: infos.nationalite.trim() || null,
      adresse: infos.adresse.trim() || null,
    });
    setSaving(false);
    if (ok) setStep('poids');
  }

  async function savePoids() {
    if (!passenger && !booking) return;
    const poidsNum = parseInt(poids);
    if (!poidsNum || poidsNum < 1) return;
    setSaving(true);
    const ok = await enregistrerPassager({ poids: poidsNum });
    setSaving(false);
    if (ok) setStep('decharge');
  }

  async function signer() {
    if (!signatureDataUrl || !passenger) return;
    setSaving(true);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signatureDataUrl + new Date().toISOString()))
      .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''));

    // La RPC signe la décharge ET complète le dossier de la réservation
    await enregistrerPassager({ decharge_signee: true, decharge_signature_hash: hash });

    setSaving(false);
    setSignatureSaved(true);
    setStep('done');
  }

  // ── Loading / Error ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#001A4D]" />
    </div>
  );

  if (erreur) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center"><div className="text-5xl mb-4">⚠️</div><h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1><p className="text-sm text-gray-500">{erreur}</p></div>
    </div>
  );

  const poidsNum = parseInt(poids);
  const poidsAlerte = config && poidsNum && (poidsNum < config.poids_min || poidsNum > config.poids_max);

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 15,
    border: '1.5px solid #E2E8F0', background: 'white', outline: 'none',
  };

  const STEPS: { key: Step; label: string }[] = [
    { key: 'infos', label: 'Informations' },
    { key: 'poids', label: 'Poids & urgence' },
    { key: 'decharge', label: 'Décharge' },
    { key: 'done', label: 'Terminé' },
  ];

  const stepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#001A4D] px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <ParaPassLogo className="h-6 opacity-70" />
            <span className="text-white/50 text-xs">Dossier passager</span>
          </div>
          <h1 className="text-white font-black text-xl mb-1">Préparez votre saut 🪂</h1>
          {booking && (
            <p className="text-white/60 text-sm">
              {booking.centre?.nom} · {booking.slot ? new Date(booking.slot.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''} à {booking.slot?.heure.slice(0, 5)}
            </p>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-1">
          {STEPS.filter(s => s.key !== 'done').map((s, i) => (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: stepIdx > i ? '#10B981' : stepIdx === i ? '#001A4D' : '#E2E8F0',
                    color: stepIdx >= i ? 'white' : '#94A3B8',
                  }}
                >
                  {stepIdx > i ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{s.label}</span>
              </div>
              {i < 2 && <div className="flex-1 h-0.5 mb-3" style={{ background: stepIdx > i ? '#10B981' : '#E2E8F0' }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* ── Étape 1 : Infos ── */}
        {step === 'infos' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <h2 className="font-black text-gray-900 text-lg">Vos informations</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Prénom *</label>
                <input style={inp} value={infos.prenom} onChange={e => setInfos(f => ({ ...f, prenom: e.target.value }))} placeholder="Jean" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nom *</label>
                <input style={inp} value={infos.nom} onChange={e => setInfos(f => ({ ...f, nom: e.target.value }))} placeholder="Dupont" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date de naissance</label>
              <input style={inp} type="date" value={infos.dateNaissance} onChange={e => setInfos(f => ({ ...f, dateNaissance: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nationalité</label>
              <input style={inp} value={infos.nationalite} onChange={e => setInfos(f => ({ ...f, nationalite: e.target.value }))} placeholder="Française" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse</label>
              <input style={inp} value={infos.adresse} onChange={e => setInfos(f => ({ ...f, adresse: e.target.value }))} placeholder="12 rue de la Liberté, 75001 Paris" />
            </div>
            <button
              onClick={saveInfos}
              disabled={!infos.prenom || !infos.nom || saving}
              className="w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-50"
              style={{ background: '#001A4D' }}
            >
              {saving ? 'Enregistrement...' : 'Continuer →'}
            </button>
          </div>
        )}

        {/* ── Étape 2 : Poids & urgence ── */}
        {step === 'poids' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <h2 className="font-black text-gray-900 text-lg">Poids & contact d'urgence</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Votre poids (kg) * {config && <span className="text-gray-400 font-normal">· min {config.poids_min} kg, max {config.poids_max} kg</span>}
              </label>
              <input
                style={{ ...inp, borderColor: poidsAlerte ? '#FCA5A5' : '#E2E8F0', background: poidsAlerte ? '#FFF5F5' : 'white' }}
                type="number"
                value={poids}
                onChange={e => setPoids(e.target.value)}
                placeholder="75"
              />
              {poidsAlerte && (
                <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Votre poids est hors des limites autorisées ({config?.poids_min}–{config?.poids_max} kg).
                    Le centre sera notifié. Votre saut pourrait être refusé le jour J.
                  </span>
                </div>
              )}
              {config && poidsNum && !poidsAlerte && (
                <p className="mt-1 text-xs text-green-600">✓ Poids dans les limites autorisées</p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Contact d'urgence</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nom et prénom</label>
                  <input style={inp} value={infos.contactUrgenceNom} onChange={e => setInfos(f => ({ ...f, contactUrgenceNom: e.target.value }))} placeholder="Marie Dupont" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label>
                  <input style={inp} type="tel" value={infos.contactUrgenceTel} onChange={e => setInfos(f => ({ ...f, contactUrgenceTel: e.target.value }))} placeholder="06 00 00 00 00" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('infos')} className="py-3 px-4 rounded-xl text-sm" style={{ border: '1.5px solid #E2E8F0', color: '#64748B', background: 'transparent' }}>
                ← Retour
              </button>
              <button
                onClick={savePoids}
                disabled={!poids || saving || (config && (poidsNum < 1))}
                className="flex-1 py-3.5 rounded-xl font-bold text-white disabled:opacity-50"
                style={{ background: '#001A4D' }}
              >
                {saving ? 'Enregistrement...' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Décharge ── */}
        {step === 'decharge' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 text-sm">Décharge de responsabilité</p>
                <p className="text-xs text-amber-700 mt-0.5">Lisez attentivement avant de signer</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div
                className="rounded-xl p-4 text-xs text-gray-600 leading-relaxed"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', whiteSpace: 'pre-line', maxHeight: 280, overflowY: 'auto' }}
              >
                {TEXTE_DECHARGE}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Votre signature *</label>
                <SignatureCanvas onSigned={setSignatureDataUrl} />
              </div>

              <div className="text-xs text-gray-400 space-y-1">
                <p>• Horodatage : {new Date().toLocaleString('fr-FR')}</p>
                <p>• Identité déclarée : {infos.prenom} {infos.nom}</p>
                <p>• Cette signature électronique a valeur légale (loi n°2000-230)</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('poids')} className="py-3 px-4 rounded-xl text-sm" style={{ border: '1.5px solid #E2E8F0', color: '#64748B', background: 'transparent' }}>
                  ← Retour
                </button>
                <button
                  onClick={signer}
                  disabled={!signatureDataUrl || saving}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #001A4D, #003082)' }}
                >
                  {saving ? 'Signature en cours...' : '✓ Signer et valider le dossier'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Étape 4 : Terminé ── */}
        {step === 'done' && (
          <div className="text-center">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 mb-2">Dossier complet !</h1>
              <p className="text-gray-500 text-sm mb-6">
                Tout est prêt pour votre saut. Présentez-vous à l'accueil le jour J.
              </p>
              <div className="rounded-xl bg-slate-50 p-4 text-left space-y-2 text-sm mb-6">
                <div className="flex items-center gap-2 text-green-700"><Check className="w-4 h-4" /><span>Informations personnelles</span></div>
                <div className="flex items-center gap-2 text-green-700"><Check className="w-4 h-4" /><span>Poids déclaré</span></div>
                <div className="flex items-center gap-2 text-green-700"><Check className="w-4 h-4" /><span>Décharge signée électroniquement</span></div>
              </div>
              {booking?.montant_solde && booking.montant_solde > 0 && (
                <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 text-left">
                  <p className="font-semibold text-orange-800 text-sm mb-1">💳 Solde à régler</p>
                  <p className="text-orange-700 text-xs">{booking.montant_solde} € à régler sur place le jour du saut.</p>
                </div>
              )}
              <div className="mt-4 text-xs text-gray-400 flex items-center justify-center gap-1">
                <ParaPassLogo className="h-4 opacity-40" />
                <span>Géré via ParaPass</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
