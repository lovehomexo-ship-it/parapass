import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';

// ═══════════════════════════════════════════════════════════════════════════
// LecteurQr — VARIANTE de QrScanner, pas une modification en place.
//
// QrScanner (partagé, utilisé dans le Layout et le passeport) NAVIGUE vers la
// route lue puis se ferme : c'est son métier, on n'y touche pas. Ici, le
// chef de largage scanne trente cartes d'affilée sans quitter l'écran : le
// lecteur RESTE ouvert, rend chaque lecture à `onDecode`, se ré-arme après un
// délai, et ignore la même carte présentée deux fois de suite.
//
// Même technique que l'original (BarcodeDetector natif, repli jsQR) pour ne
// pas diverger sur ce qui marche déjà en plein soleil.
// ═══════════════════════════════════════════════════════════════════════════

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
    };
  }
}

export function LecteurQr({ onDecode, actif = true, delaiReArmementMs = 1200 }: {
  onDecode: (brut: string) => void;
  /** Faux pendant qu'un verdict est affiché : la caméra tourne, on n'écoute pas. */
  actif?: boolean;
  delaiReArmementMs?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const dernierRef = useRef<{ valeur: string; a: number }>({ valeur: '', a: 0 });
  const actifRef = useRef(actif);
  actifRef.current = actif;

  const [etat, setEtat] = useState<'demarrage' | 'lecture' | 'refuse' | 'erreur'>('demarrage');
  const [torche, setTorche] = useState(false);
  const [torcheDispo, setTorcheDispo] = useState(false);

  const detecte = useCallback((brut: string) => {
    if (!actifRef.current) return;
    const t = Date.now();
    // La même carte tenue devant l'objectif ne doit pas produire dix lectures.
    if (brut === dernierRef.current.valeur && t - dernierRef.current.a < delaiReArmementMs) return;
    dernierRef.current = { valeur: brut, a: t };
    onDecode(brut);
  }, [onDecode, delaiReArmementMs]);

  useEffect(() => {
    let vivant = true;
    const arreter = () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };

    (async () => {
      try {
        const flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        if (!vivant) { flux.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = flux;
        const video = videoRef.current;
        if (video) { video.srcObject = flux; await video.play(); }
        const piste = flux.getVideoTracks()[0];
        const caps = piste.getCapabilities?.() as Record<string, unknown> | undefined;
        if (caps?.torch) setTorcheDispo(true);
        setEtat('lecture');

        if (window.BarcodeDetector) {
          const det = new window.BarcodeDetector({ formats: ['qr_code'] });
          const tick = async () => {
            const v = videoRef.current;
            if (v && v.readyState >= 2) {
              try { for (const r of await det.detect(v)) detecte(r.rawValue); } catch { /* image pas prête */ }
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        } else {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d', { willReadFrequently: true });
          const tick = () => {
            const v = videoRef.current;
            if (v && canvas && ctx && v.readyState === v.HAVE_ENOUGH_DATA) {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (code?.data) detecte(code.data);
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch (err) {
        if (!vivant) return;
        const e = err as DOMException;
        setEtat(e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' ? 'refuse' : 'erreur');
      }
    })();

    return () => { vivant = false; arreter(); };
  }, [detecte]);

  const basculerTorche = async () => {
    const piste = streamRef.current?.getVideoTracks()[0];
    if (!piste) return;
    try {
      await (piste as unknown as { applyConstraints(c: Record<string, unknown>): Promise<void> })
        .applyConstraints({ advanced: [{ torch: !torche }] });
      setTorche(v => !v);
    } catch { /* pas de torche */ }
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#000' }}>
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {/* Le cadre de visée : un repère, pas une contrainte. */}
      <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{ width: '62%', aspectRatio: '1', borderRadius: 18,
                      border: `3px solid ${actif ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)'}` }} />
      </div>

      {etat === 'demarrage' && (
        <p className="absolute inset-x-0 bottom-3 text-center" style={{ fontSize: 14, color: '#fff' }}>
          Démarrage de la caméra…
        </p>
      )}
      {(etat === 'refuse' || etat === 'erreur') && (
        <p role="alert" className="absolute inset-x-3 bottom-3 text-center rounded-xl px-3 py-2"
          style={{ fontSize: 14, color: '#fff', background: 'rgba(0,0,0,0.65)' }}>
          {etat === 'refuse'
            ? 'Caméra refusée. Autorisez-la dans le navigateur, ou saisissez le numéro de licence ci-dessous.'
            : 'Caméra indisponible. Saisissez le numéro de licence ci-dessous.'}
        </p>
      )}
      {torcheDispo && (
        <button type="button" onClick={basculerTorche} aria-pressed={torche}
          className="absolute top-3 right-3 rounded-full px-3"
          style={{ minHeight: 44, minWidth: 44, fontSize: 14, fontWeight: 700,
                   background: torche ? '#fff' : 'rgba(0,0,0,0.55)', color: torche ? '#000' : '#fff' }}>
          Lampe
        </button>
      )}
    </div>
  );
}
