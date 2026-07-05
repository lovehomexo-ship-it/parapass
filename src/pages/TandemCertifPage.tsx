import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { Download, Share2, CheckCircle } from 'lucide-react';

interface CertifData {
  passenger: {
    prenom: string;
    nom: string;
    certif_token: string;
  };
  booking: {
    avec_video: boolean;
    moniteur: { nom: string; prenom: string } | null;
    slot: { date: string; heure: string } | null;
    centre: { nom: string; ville: string } | null;
  };
}

export function TandemCertifPage() {
  const { certifToken } = useParams<{ certifToken: string }>();
  const [data, setData] = useState<CertifData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!certifToken) { setErreur('Certificat introuvable.'); setLoading(false); return; }
    (async () => {
      const { data: p } = await supabase
        .from('tandem_passengers')
        .select('prenom, nom, certif_token, booking:tandem_bookings(avec_video, moniteur:profiles!tandem_bookings_moniteur_id_fkey(nom, prenom), slot:tandem_slots(date, heure), centre:centres(nom, ville))')
        .eq('certif_token', certifToken)
        .maybeSingle();

      if (!p) { setErreur('Certificat introuvable.'); setLoading(false); return; }
      setData(p as unknown as CertifData);
      setLoading(false);
    })();
  }, [certifToken]);

  const share = async () => {
    if (!data) return;
    const text = `🪂 J'ai fait mon premier saut en parachute tandem avec ${data.booking.centre?.nom} ! Certifié via ParaPass · ${window.location.href}`;
    if (navigator.share) {
      await navigator.share({ title: 'Mon certificat de premier saut', text, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const imprimer = () => window.print();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#001A4D]" />
    </div>
  );

  if (erreur || !data) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center"><div className="text-5xl mb-4">⚠️</div><h1 className="text-xl font-bold text-gray-900 mb-2">Certificat introuvable</h1></div>
    </div>
  );

  const dateStr = data.booking.slot
    ? new Date(data.booking.slot.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001A4D] via-[#003082] to-[#001A4D] flex flex-col items-center justify-center p-4">
      {/* Certificat card */}
      <div
        id="certif-card"
        className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl print:shadow-none"
        style={{ background: 'white' }}
      >
        {/* Header bleu */}
        <div className="bg-[#001A4D] px-6 py-8 text-center">
          <div className="flex justify-center mb-4">
            <ParaPassLogo className="h-8 opacity-80" />
          </div>
          <div className="text-white/60 text-xs uppercase tracking-widest mb-2">Certificat officiel</div>
          <h1 className="text-white font-black text-2xl leading-tight">Premier Saut Tandem</h1>
        </div>

        {/* Contenu */}
        <div className="px-6 py-8 text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto border-4 border-[#001A4D]/10">
            <span className="text-4xl">🪂</span>
          </div>

          <div>
            <p className="text-gray-500 text-sm mb-1">Ce certificat atteste que</p>
            <h2 className="text-3xl font-black text-[#001A4D]">{data.passenger.prenom} {data.passenger.nom}</h2>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed">
            a réalisé son premier saut en parachute tandem avec succès
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Date', value: dateStr },
              { label: 'Centre', value: data.booking.centre?.nom ?? '—' },
              { label: 'Altitude', value: '4 000 m' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3" style={{ background: '#F8FAFC' }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {data.booking.moniteur && (
            <div className="rounded-xl p-3 bg-blue-50">
              <p className="text-xs text-gray-500">Moniteur tandem</p>
              <p className="font-semibold text-[#001A4D]">{data.booking.moniteur.prenom} {data.booking.moniteur.nom}</p>
            </div>
          )}

          {/* QR de vérification */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-400 mb-2">QR de vérification</div>
            <div className="p-2 rounded-xl bg-white border border-slate-200 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&ecc=M&data=${encodeURIComponent(window.location.href)}`}
                width={80}
                height={80}
                alt="QR"
              />
            </div>
            <p className="text-[10px] text-gray-300 mt-1 font-mono">{certifToken?.slice(0, 16)}…</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 text-center flex items-center justify-center gap-2 border-t border-slate-100">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <p className="text-xs text-gray-400">Certifié via ParaPass · Fédération Française de Parachutisme</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 w-full max-w-md print:hidden">
        <button
          onClick={share}
          className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 text-sm transition-all"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <Share2 className="w-4 h-4" />
          {shared ? 'Copié !' : 'Partager'}
        </button>
        <button
          onClick={imprimer}
          className="flex-1 py-3 rounded-xl font-semibold text-[#001A4D] flex items-center justify-center gap-2 text-sm"
          style={{ background: 'white' }}
        >
          <Download className="w-4 h-4" />
          Télécharger PDF
        </button>
      </div>
    </div>
  );
}
