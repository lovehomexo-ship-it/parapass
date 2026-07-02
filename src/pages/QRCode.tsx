import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useJumpCounts } from '../lib/useJumpCount';
import { Layout } from '../components/Layout';
import { ParachuteIcon } from '../components/ParachuteIcon';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import type { Licence, Brevet, CertificatMedical } from '../lib/types';
import { TYPE_BREVET_LABELS } from '../lib/types';

const QR_CACHE_KEY = 'parapass_signed_qr';
const QR_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function getCachedJws(userId: string): string | null {
  try {
    const raw = localStorage.getItem(`${QR_CACHE_KEY}_${userId}`);
    if (!raw) return null;
    const { jws, ts } = JSON.parse(raw);
    if (Date.now() - ts > QR_CACHE_TTL_MS) return null;
    return jws;
  } catch { return null; }
}

function setCachedJws(userId: string, jws: string) {
  localStorage.setItem(`${QR_CACHE_KEY}_${userId}`, JSON.stringify({ jws, ts: Date.now() }));
}

// Nettoie les caractères parasites du numéro de licence
function cleanLicence(num: string | null | undefined): string {
  if (!num) return '—';
  return num.replace(/[°\s]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

export function QRCodePage() {
  const { user, profile } = useAuth();
  const [jws, setJws] = useState<string | null>(null);
  const [jwsLoading, setJwsLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [licence, setLicence] = useState<Licence | null>(null);
  const [brevet, setBrevet] = useState<Brevet | null>(null);
  const [certif, setCertif] = useState<CertificatMedical | null>(null);
  const { total: totalSauts, valid: validSauts } = useJumpCounts(user?.id);

  const loadSignedQr = useCallback(async (force = false) => {
    if (!user) return;
    if (!force) {
      const cached = getCachedJws(user.id);
      if (cached) { setJws(cached); return; }
    }
    setJwsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-qr`,
        { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' } },
      );
      const json = await res.json();
      if (json.jws) {
        setCachedJws(user.id, json.jws);
        setJws(json.jws);
      }
    } catch (e) {
      console.error('sign-qr error:', e);
    } finally {
      setJwsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadSignedQr();
    supabase.from('licences').select('*').eq('parachutiste_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setLicence(data as Licence | null));
    supabase.from('brevets').select('*').eq('parachutiste_id', user.id).order('date_obtention', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setBrevet(data as Brevet | null));
    supabase.from('certificats_medicaux').select('*').eq('parachutiste_id', user.id).order('date_expiration', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setCertif(data as CertificatMedical | null));
  }, [user, loadSignedQr]);

  const regenerateQr = () => {
    if (!user) return;
    localStorage.removeItem(`${QR_CACHE_KEY}_${user.id}`);
    loadSignedQr(true);
  };

  const qrUrl = jws ? `https://parapass.fr/v/#${jws}` : '';

  if (!profile) return null;

  const now = new Date();
  const certifExpired = certif?.date_expiration ? new Date(certif.date_expiration) < now : null;
  const licenceExpired = licence?.date_expiration ? new Date(licence.date_expiration) < now : null;
  const licenceActif = licence?.statut === 'actif' && licenceExpired === false;

  if (fullscreen && jws) {
    return (
      <div className="fixed inset-0 z-50 bg-[#001A4D] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]">
          <ParachuteIcon className="absolute top-8 left-[5%] w-60 h-60 text-white" />
          <ParachuteIcon className="absolute bottom-12 right-[8%] w-48 h-48 text-white" />
          <ParachuteIcon className="absolute top-1/3 right-[15%] w-36 h-36 text-white" />
        </div>
        <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10">
          <Minimize2 className="w-6 h-6" />
        </button>
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full relative">
          <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-12 w-auto mx-auto mb-3" />
          <div className="text-center mb-4">
            <p className="text-lg font-bold text-[#001A4D]">{profile.prenom} {profile.nom}</p>
            <p className="text-sm text-gray-500">Licence FFP : {cleanLicence(profile.numero_licence)}</p>
          </div>
          <div className="flex justify-center">
            <QRCodeSVG value={qrUrl} size={220} level="H" />
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">Scannez pour vérifier le carnet ParaPass</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center relative overflow-hidden">
          <div className="absolute -top-6 -right-6 opacity-[0.04] pointer-events-none">
            <ParachuteIcon className="w-96 h-96 text-[#001A4D]" />
          </div>

          <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-12 w-auto mx-auto mb-3" />
          <h1 className="text-xl font-bold text-[#001A4D] mb-2">Mon QR Code</h1>
          <p className="text-sm text-gray-500 mb-6">Présentez ce QR code lors des contrôles DGAC ou gendarmerie</p>

          {jws ? (
            <div className="inline-block bg-white p-4 rounded-xl border-2 border-gray-100">
              <QRCodeSVG value={qrUrl} size={200} level="M" />
            </div>
          ) : (
            <div className="w-[200px] h-[200px] bg-gray-100 rounded-xl mx-auto flex items-center justify-center">
              <p className="text-gray-400 text-sm">{jwsLoading ? 'Génération…' : 'Chargement...'}</p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button onClick={() => setFullscreen(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#001A4D] hover:bg-[#1E3A5F] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
              <Maximize2 className="w-4 h-4" /> Plein écran
            </button>
            <button onClick={regenerateQr} disabled={jwsLoading}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${jwsLoading ? 'animate-spin' : ''}`} /> Régénérer le QR code
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-left space-y-2.5">
            <InfoRow label="Nom" value={`${profile.nom} ${profile.prenom}`} />
            <InfoRow label="Licence FFP" value={cleanLicence(profile.numero_licence)} />
            <InfoRow label="Brevet" value={brevet ? (TYPE_BREVET_LABELS[brevet.type_brevet] || brevet.type_brevet) : 'Non renseigné'} />
            <InfoRow
              label="Certificat médical"
              value={
                certif?.date_expiration
                  ? `${certifExpired ? 'Expiré' : 'Valide'} — ${new Date(certif.date_expiration).toLocaleDateString('fr-FR')}`
                  : 'Non renseigné'
              }
              highlight={certifExpired === true ? 'red' : certifExpired === false ? 'green' : undefined}
            />
            <InfoRow label="Sauts totaux" value={String(totalSauts)} />
            {validSauts < totalSauts && (
              <InfoRow label="dont validés" value={String(validSauts)} />
            )}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-sm text-gray-500 font-medium">Statut</span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                licenceActif ? 'bg-green-100 text-green-700' :
                licenceExpired ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {licenceActif ? 'ACTIF' : licenceExpired ? 'EXPIRÉ' : 'NON RENSEIGNÉ'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'red' }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className={`text-sm font-semibold ${
        highlight === 'green' ? 'text-green-600' :
        highlight === 'red' ? 'text-red-600' : 'text-[#001A4D]'
      }`}>{value}</span>
    </div>
  );
}
