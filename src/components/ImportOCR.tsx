import { useState, useRef, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '../lib/supabase';
import {
  Camera, X, Upload, CheckCircle, ChevronLeft,
  AlertTriangle, BookOpen, CreditCard, Lock, Plus, Trash2,
  FileImage, Zap, Shield, Search,
} from 'lucide-react';

// ─── Stripe setup ─────────────────────────────────────────────────────────────

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoItem {
  id: string;
  file: File;
  url: string;
}

interface SautExtrait {
  id: string;
  numero: string;
  date: string;
  lieu: string;
  aeronef: string;
  hauteur: string;
  hauteur_ouverture: string;
  voilure: string;
  programme: string;
  nature: string;
  nom_moniteur: string;
  observations: string;
  confiance: number;
  selectionne: boolean;
}

// upload → scan (loading) → apercu (count + pay) → paiement → validation → succes
type Etape = 'upload' | 'scan' | 'apercu' | 'paiement' | 'validation' | 'succes';

interface Props {
  userId: string;
  onClose: () => void;
  onImported: (count: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confianceColor(score: number): string {
  if (score >= 85) return '#10B981';
  if (score >= 65) return '#F97316';
  return '#EF4444';
}

function parseDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  if (!dateStr) return today;
  const s = dateStr.trim();

  // JJ/MM/AA → 2026-06-11
  const ddmmyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (ddmmyy) {
    const [, dd, mm, yy] = ddmmyy;
    return `${2000 + parseInt(yy)}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // JJ/MM/AAAA → 2026-06-11
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // JJ-MM-AA → 2026-06-11
  const ddmmyy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (ddmmyy2) {
    const [, dd, mm, yy] = ddmmyy2;
    return `${2000 + parseInt(yy)}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // JJ-MM-AAAA → 2026-06-11
  const ddmmyyyy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy2) {
    const [, dd, mm, yyyy] = ddmmyyyy2;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  console.warn('Format de date non reconnu:', dateStr);
  return today;
}

function EditableCell({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-xs px-2 py-1 rounded-md outline-none transition-all"
      style={{
        border: '1px solid var(--c-border-f)',
        background: 'var(--c-surface)',
        color: 'var(--c-text)',
        minWidth: 0,
        ...style,
      }}
      onFocus={e => (e.currentTarget.style.borderColor = '#F97316')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--c-border-f)')}
    />
  );
}

// ─── OCR — single Claude Vision call with ALL images ─────────────────────────

// Resize + JPEG-compress to keep each image under ~1.2 MB base64 payload.
// Smartphone photos are 3-8 MB; two uncompressed sends a 15+ MB JSON body
// which makes fetch() throw a "Load failed" TypeError before even hitting the API.
async function compressToBase64(file: File, maxPx = 2048, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas non disponible')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Impossible de lire l\'image'));
    };

    img.src = objectUrl;
  });
}

function classifyFetchError(err: unknown): string {
  if (!(err instanceof Error)) return 'Erreur inconnue. Réessayez.';
  const msg = err.message.toLowerCase();
  if (err.name === 'AbortError') return "L'analyse a pris trop de temps (> 60 s). Réessayez avec moins de pages.";
  if (msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('network'))
    return 'Erreur réseau ou image trop volumineuse. Vérifiez votre connexion et réessayez.';
  if (msg.includes('401') || msg.includes('authentication'))
    return 'Clé API invalide ou expirée. Contactez le support.';
  if (msg.includes('429')) return 'Trop de requêtes. Patientez quelques secondes et réessayez.';
  if (msg.includes('413') || msg.includes('request entity too large'))
    return 'Images trop volumineuses pour l\'API. Essayez avec des photos de résolution inférieure.';
  if (msg.includes('500') || msg.includes('502') || msg.includes('503'))
    return 'Erreur serveur temporaire. Réessayez dans quelques instants.';
  return err.message || 'Analyse impossible. Réessayez.';
}

const OCR_PROMPT = `Tu es un expert en lecture de carnets de sauts parachutisme français (format FFP).
Analyse TOUTES les pages fournies et extrais ABSOLUMENT TOUS les sauts visibles dans les tableaux.

Pour chaque ligne de saut retourne un objet JSON avec ces champs exacts :
- numero : numéro du saut (string, ex: "142")
- date : DD/MM/YYYY (ex: "15/06/2024"), "" si illisible
- lieu : DZ ou centre (ex: "BigAir Rochefort"), "" si illisible
- aeronef : immatriculation ou type avion (ex: "F-HABC"), "" si illisible
- hauteur : altitude de largage en mètres, NOMBRE SEUL (ex: "4000"), "4000" si illisible
- hauteur_ouverture : altitude ouverture (ex: "1500"), "1500" si illisible
- voilure : voilure principale (ex: "PD-270"), "" si illisible
- programme : programme du saut (ex: "PAC 3", "Solo", "VRW"), "" si absent
- nature : un seul parmi "entrainement" | "competition" | "manifestation" | "travail_aerien"
- nom_moniteur : nom du moniteur signataire, "" si absent
- observations : observations si lisibles, "" sinon
- confiance : entier 0-100 représentant la qualité de lecture de cette ligne

Règles importantes :
1. Inclus TOUTES les lignes visibles, même partiellement lisibles (confiance peut être faible)
2. Ne saute AUCUNE ligne du tableau, même si certains champs sont vides
3. Si une ligne est presque illisible, inclus-la avec confiance ≤ 30 et les champs lisibles

Retourne UNIQUEMENT un tableau JSON valide, sans aucun texte avant ou après, sans markdown.
Format : [{"numero":"1","date":"20/05/2024","lieu":"BigAir","aeronef":"Pilatus","hauteur":"4000","hauteur_ouverture":"1500","voilure":"PD-270","programme":"PAC 1","nature":"entrainement","nom_moniteur":"MARTIN Paul","observations":"","confiance":90}, ...]`;

async function scanToutesPhotos(photos: PhotoItem[]): Promise<SautExtrait[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Clé API Anthropic manquante (VITE_ANTHROPIC_API_KEY).');

  // Compress every image before encoding — prevents "Load failed" on large phone photos
  const base64List = await Promise.all(photos.map(p => compressToBase64(p.file)));

  const imageContent = base64List.map((b64, i) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const, // always JPEG after canvas compression
      data: b64,
    },
  }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: OCR_PROMPT },
          ],
        }],
      }),
    });
  } catch (err) {
    throw new Error(classifyFetchError(err));
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = body.error?.message ?? `Erreur API Claude (${res.status})`;
    throw new Error(classifyFetchError(new Error(`${res.status} ${msg}`)));
  }

  const data = await res.json() as { content: Array<{ type: string; text?: string }> };
  const texte = data.content.find(c => c.type === 'text')?.text ?? '[]';

  // Strip any accidental markdown fences
  const clean = texte.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let raw: Record<string, unknown>[];
  try {
    raw = JSON.parse(clean) as Record<string, unknown>[];
  } catch {
    throw new Error("La réponse de Claude n'est pas un JSON valide. Réessayez avec une meilleure photo.");
  }

  if (!Array.isArray(raw)) throw new Error('Format de réponse inattendu (attendu un tableau).');

  return raw
    .filter(s => s.date || s.lieu || s.numero)
    .map((s, i) => ({
      id: `ocr-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      numero: String(s.numero ?? ''),
      date: String(s.date ?? ''),
      lieu: String(s.lieu ?? ''),
      aeronef: String(s.aeronef ?? ''),
      hauteur: String(s.hauteur ?? '4000'),
      hauteur_ouverture: String(s.hauteur_ouverture ?? '1500'),
      voilure: String(s.voilure ?? ''),
      programme: String(s.programme ?? ''),
      nature: String(s.nature ?? 'entrainement'),
      nom_moniteur: String(s.nom_moniteur ?? ''),
      observations: String(s.observations ?? ''),
      confiance: Math.max(0, Math.min(100, Number(s.confiance ?? 75))),
      selectionne: true,
    }))
    .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
}

// ─── Payment screen ───────────────────────────────────────────────────────────

interface EcranPaiementProps {
  photos: PhotoItem[];
  sautCount: number;
  onPaymentSuccess: () => void;
  onBack: () => void;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#e8e8e8',
      fontFamily: '"Inter", system-ui, sans-serif',
      '::placeholder': { color: '#6b7280' },
      iconColor: '#F97316',
    },
    invalid: { color: '#EF4444', iconColor: '#EF4444' },
  },
};

function EcranPaiementStripe({ photos, sautCount, onPaymentSuccess, onBack }: EcranPaiementProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const isTestMode = stripeKey?.startsWith('pk_test_') ?? false;

  const handlePay = async () => {
    setErreur(null);
    setLoading(true);
    try {
      if (!stripe || !elements) throw new Error('Stripe non initialisé. Rechargez la page.');
      const card = elements.getElement(CardElement);
      if (!card) throw new Error('Élément carte introuvable.');
      const { error } = await stripe.createPaymentMethod({ type: 'card', card });
      if (error) throw new Error(error.message ?? 'Paiement refusé.');
      setSuccess(true);
      setTimeout(onPaymentSuccess, 700);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur de paiement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EcranPaiementLayout
      photos={photos} sautCount={sautCount} onBack={onBack}
      loading={loading} success={success} erreur={erreur} onPay={handlePay}
      isDemoMode={false} isTestMode={isTestMode}
      cardSlot={
        <div className="rounded-lg px-3 py-3" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border-f)' }}>
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      }
    />
  );
}

function EcranPaiementDemo({ photos, sautCount, onPaymentSuccess, onBack }: EcranPaiementProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setSuccess(true);
    setTimeout(onPaymentSuccess, 700);
  };

  return (
    <EcranPaiementLayout
      photos={photos} sautCount={sautCount} onBack={onBack}
      loading={loading} success={success} erreur={null} onPay={handlePay}
      isDemoMode isTestMode={false}
      cardSlot={
        <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border-f)', color: 'var(--c-dim)' }}>
          4242 4242 4242 4242 · 12 / 34 · 123 <span className="text-xs opacity-60">(simulé)</span>
        </div>
      }
    />
  );
}

interface EcranPaiementLayoutProps extends EcranPaiementProps {
  loading: boolean;
  success: boolean;
  erreur: string | null;
  onPay: () => void;
  isDemoMode: boolean;
  isTestMode: boolean;
  cardSlot: React.ReactNode;
}

function EcranPaiementLayout({
  photos, sautCount, onBack, loading, success, erreur, onPay, isDemoMode, isTestMode, cardSlot,
}: EcranPaiementLayoutProps) {
  return (
    <div className="p-5 space-y-4">
      {/* Jump count summary */}
      <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
          <CheckCircle className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
            {sautCount} saut{sautCount > 1 ? 's' : ''} détecté{sautCount > 1 ? 's' : ''} sur {photos.length} page{photos.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
            Validez le paiement pour accéder à la révision et à l'import
          </p>
        </div>
      </div>

      {/* Order summary */}
      <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--c-text)' }}>Récapitulatif</p>
        <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid var(--c-border-s)' }}>
          <span style={{ color: 'var(--c-muted)' }}>Analyse OCR — {photos.length} page{photos.length > 1 ? 's' : ''}</span>
          <span style={{ color: 'var(--c-text)' }} className="font-semibold">4,99 €</span>
        </div>
        <div className="flex justify-between pt-2 text-sm">
          <span className="font-bold" style={{ color: 'var(--c-text)' }}>Total</span>
          <span className="font-bold text-base" style={{ color: '#F97316' }}>4,99 €</span>
        </div>
        <div className="mt-3 space-y-1">
          {['Analyse Claude Vision haute précision', 'Validation manuelle incluse', 'Import illimité de sauts', 'Statut Historique · Conforme DGAC'].map(f => (
            <p key={f} className="text-xs flex items-center gap-1.5" style={{ color: 'var(--c-muted)' }}>
              <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {f}
            </p>
          ))}
        </div>
      </div>

      {/* Test mode banner */}
      {(isDemoMode || isTestMode) && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-xs font-semibold text-blue-400 mb-1">
            {isDemoMode ? 'Mode démonstration — aucun paiement réel' : 'Mode test Stripe — aucun débit réel'}
          </p>
          <p className="text-xs text-blue-300">
            Carte acceptée : <code className="font-mono bg-blue-900/30 px-1 rounded">4242 4242 4242 4242</code>
            {' '}· Exp. <code className="font-mono">12/34</code> · CVC <code className="font-mono">123</code>
          </p>
          <p className="text-xs text-blue-300 mt-0.5">
            Carte refusée : <code className="font-mono bg-blue-900/30 px-1 rounded">4000 0000 0000 0002</code>
            {' '}· 3DS : <code className="font-mono bg-blue-900/30 px-1 rounded">4000 0025 0000 3155</code>
          </p>
        </div>
      )}

      {/* Card input */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" style={{ color: '#F97316' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>Informations de paiement</p>
        </div>
        {cardSlot}
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3" style={{ color: 'var(--c-dim)' }} />
          <p className="text-xs" style={{ color: 'var(--c-dim)' }}>Paiement sécurisé par Stripe — TLS 256 bits</p>
        </div>
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Zap, label: 'Analyse IA', sub: 'Claude Vision' },
          { icon: Shield, label: 'Conforme FFP', sub: 'DGAC' },
          { icon: FileImage, label: `${photos.length} page${photos.length > 1 ? 's' : ''}`, sub: `incluse${photos.length > 1 ? 's' : ''}` },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.1)' }}>
            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: '#F97316' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>{label}</p>
            <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {erreur && (
        <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{erreur}</p>
        </div>
      )}

      {success && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-emerald-400">Paiement accepté — Accès à la révision...</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={loading || success}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40"
          style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-muted)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
        <button
          onClick={onPay}
          disabled={loading || success}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
          style={{ background: success ? '#10B981' : '#F97316' }}
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isDemoMode ? 'Simulation...' : 'Traitement...'}</>
          ) : success ? (
            <><CheckCircle className="w-4 h-4" /> Accepté !</>
          ) : (
            <><Lock className="w-4 h-4" /> Payer 4,99 € — Accéder aux {sautCount} sauts</>
          )}
        </button>
      </div>
    </div>
  );
}

function EcranPaiement(props: EcranPaiementProps) {
  if (!stripeKey) return <EcranPaiementDemo {...props} />;
  return (
    <Elements stripe={stripePromise}>
      <EcranPaiementStripe {...props} />
    </Elements>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImportOCR({ userId, onClose, onImported }: Props) {
  const [etape, setEtape] = useState<Etape>('upload');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [sauts, setSauts] = useState<SautExtrait[]>([]);
  const [scanErreur, setScanErreur] = useState<string | null>(null);
  const [uploadErreur, setUploadErreur] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<'compress' | 'analyse'>('compress');
  const [progression, setProgression] = useState(0);
  const [importCount, setImportCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importErreur, setImportErreur] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhotos = useCallback((files: File[]) => {
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length < files.length) setUploadErreur('Certains fichiers ignorés (format non supporté).');
    else setUploadErreur(null);
    setPhotos(prev => [
      ...prev,
      ...valid.map(f => ({
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: f,
        url: URL.createObjectURL(f),
      })),
    ]);
  }, []);

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const p = prev.find(x => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter(x => x.id !== id);
    });
  };

  // Single Claude Vision call with ALL images at once
  const lancerScan = async () => {
    if (photos.length === 0) return;
    setEtape('scan');
    setScanErreur(null);
    setScanPhase('compress');
    try {
      // Brief delay so the "Compression…" phase is visible before the heavy canvas work
      await new Promise(r => setTimeout(r, 100));
      setScanPhase('analyse');
      const detected = await scanToutesPhotos(photos);
      setSauts(detected);
      setEtape('apercu');
    } catch (err) {
      setScanErreur(err instanceof Error ? err.message : 'Erreur lors de l\'analyse');
      setEtape('upload');
    }
  };

  const updateSaut = (id: string, field: keyof SautExtrait, value: string | boolean) => {
    setSauts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const importer = async () => {
    const toImport = sauts.filter(s => s.selectionne);
    if (!toImport.length) return;

    // userId is guaranteed non-empty — ImportOCR is only mounted when `user` is non-null in Dashboard
    if (!userId) {
      setImportErreur('Identifiant utilisateur manquant. Rechargez la page.');
      return;
    }

    setImporting(true);
    setProgression(0);
    setImportErreur(null);

    try {
      const rows = toImport.map(saut => ({
        parachutiste_id: userId,
        date_saut: parseDate(saut.date),
        lieu: saut.lieu || 'Non renseigné',
        aeronef_immat: saut.aeronef || '',
        hauteur_m: parseInt(saut.hauteur) || 4000,
        hauteur_ouverture: parseInt(saut.hauteur_ouverture) || 1500,
        voilure_principale: saut.voilure || null,
        programme: saut.programme || null,
        nature_saut: (['entrainement', 'competition', 'manifestation', 'travail_aerien', 'nuit', 'largage', 'tandem'] as string[]).includes(saut.nature)
          ? saut.nature : 'entrainement',
        categorie: 'OC' as const,
        fonction: 'parachutiste' as const,
        observations: saut.observations || null,
        moniteur_nom_libre: saut.nom_moniteur || null,
        statut: 'historique',
        source: 'ocr_import',
      }));

      let count = 0;
      const batchErrors: string[] = [];

      // Insert in small batches of 10 to get visible progress
      const BATCH = 10;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { data, error } = await supabase.from('sauts').insert(batch).select('id');
        if (error) {
          console.error('Import OCR — erreur batch', i, error);
          batchErrors.push(`${error.message} [${error.code}]`);
        } else {
          count += data?.length ?? 0;
        }
        setProgression(Math.round((Math.min(i + BATCH, rows.length) / rows.length) * 100));
      }

      if (count === 0 && batchErrors.length > 0) {
        throw new Error(batchErrors[0]);
      }

      // If nothing was inserted and no error was reported, RLS silently blocked it
      if (count === 0) {
        throw new Error('Aucun saut inséré. Vérifiez votre connexion ou reconnectez-vous.');
      }

      if (batchErrors.length > 0) {
        setImportErreur(`${count} saut${count > 1 ? 's' : ''} importé${count > 1 ? 's' : ''}, ${batchErrors.length} erreur${batchErrors.length > 1 ? 's' : ''} : ${batchErrors[0]}`);
      }

      setImportCount(count);
      setEtape('succes');
      onImported(count);
    } catch (err) {
      console.error('Import OCR — erreur fatale', err);
      setImportErreur(err instanceof Error ? err.message : 'Erreur inattendue lors de l\'import.');
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = sauts.filter(s => s.selectionne).length;
  const avgConfiance = sauts.length ? Math.round(sauts.reduce((a, s) => a + s.confiance, 0) / sauts.length) : 0;

  // Derive first/last jump dates for the summary
  const sautsAvecDate = sauts.filter(s => s.date);
  const premiereDate = sautsAvecDate[0]?.date ?? '';
  const derniereDate = sautsAvecDate[sautsAvecDate.length - 1]?.date ?? '';

  const stepOrder: Record<Etape, number> = { upload: 0, scan: 1, apercu: 2, paiement: 3, validation: 4, succes: 5 };
  const currentStep = stepOrder[etape];

  const stepDots: Etape[] = ['upload', 'apercu', 'paiement', 'validation'];
  const stepLabels = ['Photos', 'Aperçu', 'Paiement', 'Import'];

  const subtitles: Record<Etape, string> = {
    upload: photos.length > 0 ? `${photos.length} page${photos.length > 1 ? 's' : ''} sélectionnée${photos.length > 1 ? 's' : ''}` : 'Photographiez votre carnet FFP',
    scan: 'Claude Vision analyse vos photos…',
    apercu: `${sauts.length} saut${sauts.length > 1 ? 's' : ''} détecté${sauts.length > 1 ? 's' : ''} — prêt pour le paiement`,
    paiement: 'Paiement sécurisé — 4,99 €',
    validation: `${sauts.length} saut${sauts.length > 1 ? 's' : ''} — vérifiez avant import`,
    succes: `${importCount} saut${importCount > 1 ? 's' : ''} importé${importCount > 1 ? 's' : ''} avec succès`,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.12)' }}>
            <Camera className="w-4 h-4" style={{ color: '#F97316' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>Importer depuis carnet papier</p>
            <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>{subtitles[etape]}</p>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {stepDots.map((step, i) => (
              <div
                key={step}
                className="rounded-full transition-all duration-300"
                style={{
                  width: stepOrder[step] === currentStep ? '20px' : '6px',
                  height: '6px',
                  background: stepOrder[step] <= currentStep ? '#F97316' : 'var(--c-border-f)',
                }}
                title={stepLabels[i]}
              />
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--c-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── UPLOAD ─────────────────────────────────────────────────── */}
          {etape === 'upload' && (
            <div className="p-5 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); addPhotos(Array.from(e.dataTransfer.files)); }}
                className="rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer"
                onClick={() => photos.length === 0 && fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--c-border-f)',
                  minHeight: '130px',
                  padding: '20px',
                  background: 'var(--c-surface)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#F97316')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--c-border-f)')}
              >
                <Upload className="w-8 h-8 mb-2" style={{ color: 'var(--c-dim)' }} />
                <p className="font-medium text-sm" style={{ color: 'var(--c-text)' }}>Glissez vos photos ici</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>JPG, PNG, WEBP — plusieurs pages simultanément</p>
                <button
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.2)' }}
                >
                  Parcourir les fichiers
                </button>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => { addPhotos(Array.from(e.target.files ?? [])); e.target.value = ''; }}
              />

              {/* Thumbnails */}
              {photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>
                      {photos.length} page{photos.length > 1 ? 's' : ''} sélectionnée{photos.length > 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}
                    >
                      <Plus className="w-3 h-3" /> Ajouter
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {photos.map((p, idx) => (
                      <div key={p.id} className="relative rounded-xl overflow-hidden group" style={{ aspectRatio: '3/4' }}>
                        <img src={p.url} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
                          <button onClick={() => removePhoto(p.id)} className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-center text-xs font-bold text-white" style={{ background: 'rgba(0,0,0,0.5)' }}>
                          {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: '#F97316' }}>Conseils pour un meilleur résultat</p>
                {[
                  'Photographiez en lumière naturelle, sans flash',
                  'Cadrez une double-page à la fois',
                  'Évitez reflets et ombres sur le tableau',
                  'Tenez l\'appareil bien à plat face au carnet',
                ].map(c => (
                  <p key={c} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--c-muted)' }}>
                    <span style={{ color: '#F97316', flexShrink: 0 }}>·</span> {c}
                  </p>
                ))}
              </div>

              {(uploadErreur || scanErreur) && (
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-400">{uploadErreur ?? scanErreur}</p>
                    {scanErreur && <p className="text-xs text-red-300 mt-0.5">Essayez avec des photos mieux éclairées et bien cadrées sur les tableaux de sauts.</p>}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-muted)', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Annuler
                </button>
                <button
                  onClick={lancerScan}
                  disabled={photos.length === 0}
                  className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
                  style={{ background: '#F97316' }}
                >
                  <Search className="w-4 h-4" />
                  Analyser {photos.length > 0 ? `${photos.length} page${photos.length > 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </div>
          )}

          {/* ── SCAN (loading) ──────────────────────────────────────────── */}
          {etape === 'scan' && (
            <div className="p-10 flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.1)' }}>
                  <Camera className="w-9 h-9" style={{ color: '#F97316' }} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center bg-orange-500">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: 'var(--c-text)' }}>
                  {scanPhase === 'compress' ? 'Optimisation des images…' : 'Analyse par Claude Vision'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>
                  {scanPhase === 'compress'
                    ? `Compression de ${photos.length} photo${photos.length > 1 ? 's' : ''} avant envoi…`
                    : `Lecture de ${photos.length} page${photos.length > 1 ? 's' : ''} en cours…`}
                </p>
              </div>
              {/* Phase steps */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {scanPhase === 'analyse' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                  )}
                  <span className="text-xs" style={{ color: scanPhase === 'analyse' ? '#10B981' : '#F97316' }}>Compression</span>
                </div>
                <div className="w-6 h-px" style={{ background: 'var(--c-border-f)' }} />
                <div className="flex items-center gap-1.5">
                  {scanPhase === 'analyse' ? (
                    <div className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full" style={{ border: '2px solid var(--c-border-f)' }} />
                  )}
                  <span className="text-xs" style={{ color: scanPhase === 'analyse' ? '#F97316' : 'var(--c-dim)' }}>Analyse IA</span>
                </div>
              </div>
              {/* Photo thumbnails */}
              <div className="flex gap-2 flex-wrap justify-center">
                {photos.map((p, i) => (
                  <div key={p.id} className="relative rounded-lg overflow-hidden" style={{ width: '52px', height: '68px' }}>
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.4)' }}>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" style={{ animationDelay: `${i * 0.2}s` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
                L'analyse prend 10 à 30 secondes selon le nombre de pages
              </p>
            </div>
          )}

          {/* ── APERCU (count + pay gate) ───────────────────────────────── */}
          {etape === 'apercu' && (
            <div className="p-5 space-y-4">
              {/* Big result card */}
              <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <p className="text-4xl font-black mb-1" style={{ color: '#F97316' }}>{sauts.length}</p>
                <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
                  saut{sauts.length > 1 ? 's' : ''} détecté{sauts.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
                  sur {photos.length} page{photos.length > 1 ? 's' : ''} analysée{photos.length > 1 ? 's' : ''}
                </p>
                {premiereDate && derniereDate && premiereDate !== derniereDate && (
                  <p className="text-xs mt-2 font-medium" style={{ color: 'var(--c-muted)' }}>
                    Du {premiereDate} au {derniereDate}
                  </p>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
                  <p className="text-base font-bold" style={{ color: confianceColor(avgConfiance) }}>{avgConfiance}%</p>
                  <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Confiance moy.</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
                  <p className="text-base font-bold" style={{ color: '#10B981' }}>{sauts.filter(s => s.confiance >= 85).length}</p>
                  <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Haute conf.</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
                  <p className="text-base font-bold" style={{ color: '#EF4444' }}>{sauts.filter(s => s.confiance < 65).length}</p>
                  <p className="text-xs" style={{ color: 'var(--c-muted)' }}>À vérifier</p>
                </div>
              </div>

              {/* Jump preview list (first 5) */}
              {sauts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Aperçu des sauts détectés</p>
                  {sauts.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
                      <span className="text-xs font-mono font-bold w-8 flex-shrink-0" style={{ color: '#F97316' }}>#{s.numero || '—'}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--c-muted)' }}>{s.date || '—'}</span>
                      <span className="text-xs flex-1 truncate" style={{ color: 'var(--c-text)' }}>{s.lieu || s.programme || '—'}</span>
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${confianceColor(s.confiance)}18`, color: confianceColor(s.confiance) }}
                      >
                        {s.confiance}%
                      </span>
                    </div>
                  ))}
                  {sauts.length > 5 && (
                    <p className="text-xs text-center" style={{ color: 'var(--c-dim)' }}>
                      + {sauts.length - 5} autre{sauts.length - 5 > 1 ? 's' : ''} saut{sauts.length - 5 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {sauts.length === 0 && (
                <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">Aucun saut détecté</p>
                    <p className="text-xs text-red-300 mt-0.5">
                      Claude Vision n'a pas pu lire de tableau de sauts. Réessayez avec des photos mieux cadrées, sans reflets, en lumière naturelle.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setSauts([]); setEtape('upload'); setScanErreur(null); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-muted)', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <ChevronLeft className="w-4 h-4" /> Nouvelles photos
                </button>
                <button
                  onClick={() => setEtape('paiement')}
                  disabled={sauts.length === 0}
                  className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#F97316' }}
                >
                  <CreditCard className="w-4 h-4" />
                  {sauts.length === 0 ? 'Aucun saut détecté' : `Continuer — 4,99 €`}
                </button>
              </div>
            </div>
          )}

          {/* ── PAIEMENT ─────────────────────────────────────────────────── */}
          {etape === 'paiement' && (
            <EcranPaiement
              photos={photos}
              sautCount={sauts.length}
              onPaymentSuccess={() => setEtape('validation')}
              onBack={() => setEtape('apercu')}
            />
          )}

          {/* ── VALIDATION ───────────────────────────────────────────────── */}
          {etape === 'validation' && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Sauts détectés', value: sauts.length },
                  { label: 'Confiance moy.', value: `${avgConfiance}%` },
                  { label: 'Sélectionnés', value: selectedCount },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-s)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>{value}</p>
                    <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <BookOpen className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-400">
                  Ces sauts seront importés avec le statut <strong>Historique</strong> — déclarés sur l'honneur conformément à la réglementation DGAC.
                </p>
              </div>

              <div className="space-y-2">
                {sauts.map((saut) => (
                  <div
                    key={saut.id}
                    className="rounded-xl p-3 transition-all"
                    style={{
                      background: saut.selectionne ? 'var(--c-surface)' : 'var(--c-bg)',
                      border: `1px solid ${saut.selectionne ? 'var(--c-border-f)' : 'var(--c-border-s)'}`,
                      opacity: saut.selectionne ? 1 : 0.5,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => updateSaut(saut.id, 'selectionne', !saut.selectionne)}
                        className="mt-1 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          background: saut.selectionne ? '#F97316' : 'transparent',
                          border: `2px solid ${saut.selectionne ? '#F97316' : 'var(--c-border-f)'}`,
                        }}
                      >
                        {saut.selectionne && <CheckCircle className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <EditableCell value={saut.numero} onChange={v => updateSaut(saut.id, 'numero', v)} placeholder="N°" style={{ width: '50px' }} />
                          <EditableCell value={saut.date} onChange={v => updateSaut(saut.id, 'date', v)} placeholder="JJ/MM/AAAA" style={{ width: '110px' }} />
                          <EditableCell value={saut.lieu} onChange={v => updateSaut(saut.id, 'lieu', v)} placeholder="Lieu / DZ" style={{ flex: 1, minWidth: '120px' }} />
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${confianceColor(saut.confiance)}18`, color: confianceColor(saut.confiance), border: `1px solid ${confianceColor(saut.confiance)}30` }}
                          >
                            {saut.confiance}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <EditableCell value={saut.hauteur} onChange={v => updateSaut(saut.id, 'hauteur', v)} placeholder="Hauteur m" style={{ width: '90px' }} />
                          <EditableCell value={saut.voilure} onChange={v => updateSaut(saut.id, 'voilure', v)} placeholder="Voilure" style={{ width: '100px' }} />
                          <EditableCell value={saut.programme} onChange={v => updateSaut(saut.id, 'programme', v)} placeholder="Programme" style={{ flex: 1, minWidth: '80px' }} />
                          <EditableCell value={saut.nom_moniteur} onChange={v => updateSaut(saut.id, 'nom_moniteur', v)} placeholder="Moniteur" style={{ width: '120px' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setEtape('apercu'); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-muted)', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => { void importer(); }}
                  disabled={selectedCount === 0 || importing}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{
                    background: selectedCount === 0 ? '#6b7280' : '#F97316',
                    cursor: selectedCount === 0 || importing ? 'not-allowed' : 'pointer',
                    opacity: importing ? 0.7 : 1,
                  }}
                >
                  {importing ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Import… {progression}%</>
                  ) : selectedCount === 0 ? (
                    <>Aucun saut sélectionné</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" />Importer {selectedCount} saut{selectedCount > 1 ? 's' : ''}</>
                  )}
                </button>
              </div>

              {importErreur && (
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{importErreur}</p>
                </div>
              )}
            </div>
          )}

          {/* ── SUCCES ───────────────────────────────────────────────────── */}
          {etape === 'succes' && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: 'var(--c-text)' }}>
                  {importCount} saut{importCount > 1 ? 's' : ''} importé{importCount > 1 ? 's' : ''}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>
                  Ils apparaissent dans votre carnet avec le statut Historique.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#F97316' }}
              >
                Fermer
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
