import { Loader, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { QR_PUBLIC_KEY_JWK } from '../lib/qrPublicKey';
import { verdictControle } from '../lib/verdictControle';

type VerifyStatus = 'loading' | 'valid' | 'valid-offline' | 'expired' | 'invalid';

interface QRPayload {
  sub: string;
  nom: string;
  prenom: string;
  lic: string;
  brevet: string | null;
  lic_exp: string | null;
  lic_statut: string | null;
  med_exp: string | null;
  total_jumps: number;
  valid_jumps: number;
  active: boolean;
  iat: number;
  exp: number;
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  // Comparaison par JOUR calendaire (même règle que statut_echeance côté serveur) :
  // une échéance « aujourd'hui » n'est pas expirée.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const exp = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return exp.getTime() < today.getTime();
}

export function VerifyOfflinePage() {
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [payload, setPayload] = useState<QRPayload | null>(null);
  const [error, setError] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [presentation, setPresentation] = useState(false); // mode plein écran de contrôle

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    verify();
  }, []);

  async function verify() {
    try {
      const jws = window.location.hash.slice(1);
      if (!jws) { setError('QR code vide ou invalide.'); setStatus('invalid'); return; }

      const parts = jws.split('.');
      if (parts.length !== 3) { setError('Format de QR code invalide.'); setStatus('invalid'); return; }

      const [headerB64, payloadB64, sigB64] = parts;

      const pubKey = await crypto.subtle.importKey(
        'jwk',
        QR_PUBLIC_KEY_JWK,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );

      const signingInput = `${headerB64}.${payloadB64}`;
      const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        pubKey,
        base64urlDecode(sigB64),
        new TextEncoder().encode(signingInput),
      );

      if (!valid) { setError('Signature invalide — ce QR code n\'est pas authentique.'); setStatus('invalid'); return; }

      const data: QRPayload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
      setPayload(data);

      const now = Math.floor(Date.now() / 1000);
      if (data.exp < now) { setStatus('expired'); return; }

      setStatus(isOnline ? 'valid' : 'valid-offline');
    } catch {
      setError('Erreur lors de la vérification.');
      setStatus('invalid');
    }
  }

  const statusConfig = {
    loading: { bg: '#F1F5F9', border: '#CBD5E1', icon: Loader, label: 'Vérification en cours…', color: '#64748B' },
    valid: { bg: '#F0FDF4', border: '#86EFAC', icon: CheckCircle, label: 'Vérifié', color: '#16A34A' },
    'valid-offline': { bg: '#FFF7ED', border: '#FED7AA', icon: AlertTriangle, label: 'Vérifié hors ligne', color: '#C2410C' },
    expired: { bg: '#FEF2F2', border: '#FCA5A5', icon: AlertTriangle, label: 'QR code expiré', color: '#DC2626' },
    invalid: { bg: '#FEF2F2', border: '#FCA5A5', icon: XCircle, label: 'Non authentique', color: '#DC2626' },
  };

  const cfg = statusConfig[status];

  // Verdict binaire de contrôle (Prompt S) — signature vérifiée hors-ligne.
  const signatureOk = status === 'valid' || status === 'valid-offline' || status === 'expired';
  const qrExpire = status === 'expired';
  const verdict = verdictControle(payload, signatureOk, qrExpire);
  const enRegle = status !== 'loading' && verdict.enRegle;
  const verdictBg = status === 'loading' ? '#334155' : enRegle ? '#15803D' : '#B91C1C';
  const verdictLabel = status === 'loading' ? 'Vérification…' : enRegle ? 'EN RÈGLE' : 'À VÉRIFIER';

  // Mode plein écran : verdict géant, fort contraste, lisible à un mètre.
  if (presentation && status !== 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: verdictBg }}>
        <p className="uppercase tracking-widest text-white/70 text-sm font-bold mb-4">Contrôle ParaPass</p>
        <p className="font-black text-white leading-none" style={{ fontSize: 'clamp(48px, 18vw, 140px)' }}>{verdictLabel}</p>
        <p className="text-white/90 text-lg font-semibold mt-4">{verdict.motif}</p>
        {payload && <p className="text-white text-2xl font-bold mt-6">{payload.prenom} {payload.nom}</p>}
        {payload?.lic && <p className="text-white/80 text-base mt-1">Licence FFP : {payload.lic}</p>}
        <button onClick={() => setPresentation(false)}
          className="mt-10 px-6 py-3 rounded-xl text-base font-bold bg-white/20 text-white active:bg-white/30">
          Quitter le plein écran
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#001A4D] flex flex-col items-center justify-start pt-8 px-4 pb-8">
      <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-10 w-auto mb-6" />

      {/* Verdict binaire très visible, avant le détail (Prompt S). */}
      {status !== 'loading' && (
        <div className="w-full max-w-sm rounded-2xl mb-4 px-6 py-5 text-center shadow-xl" style={{ background: verdictBg }}>
          <p className="font-black text-white leading-none" style={{ fontSize: 'clamp(34px, 12vw, 56px)' }}>{verdictLabel}</p>
          <p className="text-white/90 text-sm font-semibold mt-2">{verdict.motif}</p>
          <button onClick={() => setPresentation(true)}
            className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/20 text-white active:bg-white/30">
            Plein écran
          </button>
        </div>
      )}

      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl">
        {/* Status banner */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ background: cfg.bg, borderBottom: `2px solid ${cfg.border}` }}>
          <cfg.icon className="w-6 h-6" style={{ color: cfg.color }} aria-hidden />
          <div>
            <p className="font-bold text-base" style={{ color: cfg.color }}>{cfg.label}</p>
            {status === 'valid-offline' && (
              <p className="text-xs text-orange-600 mt-0.5">Signature cryptographique validée — pas de vérification réseau</p>
            )}
            {status === 'valid' && (
              <p className="text-xs text-green-600 mt-0.5">Signature cryptographique validée</p>
            )}
          </div>
        </div>

        {(status === 'invalid' || status === 'expired') && (
          <div className="px-6 py-4">
            <p className="text-sm text-red-700">{error || (status === 'expired' ? 'Ce QR code est périmé, demandez un renouvellement.' : '')}</p>
          </div>
        )}

        {payload && (
          <div className="px-6 py-4 space-y-3">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Identité</p>
              <p className="text-lg font-bold text-[#001A4D]">{payload.prenom} {payload.nom}</p>
              {payload.lic && <p className="text-sm text-gray-500">Licence FFP : {payload.lic}</p>}
            </div>

            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
              <DataCell
                label="Brevet"
                value={payload.brevet ?? '—'}
              />
              <DataCell
                label="Sauts totaux"
                value={String(payload.total_jumps)}
              />
              {payload.valid_jumps < payload.total_jumps && (
                <DataCell
                  label="dont validés"
                  value={String(payload.valid_jumps)}
                />
              )}
              <DataCell
                label="Licence exp."
                value={formatDate(payload.lic_exp)}
                alert={isExpired(payload.lic_exp)}
              />
              <DataCell
                label="Certificat médical"
                value={formatDate(payload.med_exp)}
                alert={isExpired(payload.med_exp)}
              />
            </div>

            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">Statut licence</span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                payload.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {payload.active ? 'ACTIF' : 'INACTIF'}
              </span>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">
                Nombre de sauts arrêté à l'émission du QR, le {new Date(payload.iat * 1000).toLocaleDateString('fr-FR')} (non garanti en temps réel).
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                QR valide jusqu'au {new Date(payload.exp * 1000).toLocaleDateString('fr-FR')}.
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-white/40 text-xs text-center">
        Vérification cryptographique ParaPass · {isOnline ? 'En ligne' : 'Hors ligne'}
      </p>
    </div>
  );
}

function DataCell({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={`text-sm font-semibold ${alert ? 'text-red-600' : 'text-[#001A4D]'}`}>{value}</p>
    </div>
  );
}
