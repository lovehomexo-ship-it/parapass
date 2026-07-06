import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Flashlight, QrCode, Keyboard } from 'lucide-react';
import jsQR from 'jsqr';

// ─── URL parser ───────────────────────────────────────────────────────────────

const SAC_RE = /(?:parapass\.fr|localhost:\d+|127\.0\.0\.1:\d+)\/sac\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const VERIFY_RE = /(?:parapass\.fr|localhost:\d+|127\.0\.0\.1:\d+)\/v\b/i;

function extractRoute(raw: string): string | null {
  const sacMatch = raw.match(SAC_RE);
  if (sacMatch) return `/sac/${sacMatch[1]}`;
  if (VERIFY_RE.test(raw)) {
    try { return new URL(raw).pathname + new URL(raw).search; } catch { return null; }
  }
  return null;
}

// ─── BarcodeDetector wrapper ──────────────────────────────────────────────────

declare global {
  interface Window {
    BarcodeDetector?: {
      new(opts: { formats: string[] }): {
        detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
      };
    };
  }
}

const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

// ─── Main Scanner component ───────────────────────────────────────────────────

interface QrScannerProps {
  onClose: () => void;
}

export function QrScanner({ onClose }: QrScannerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<ReturnType<NonNullable<typeof window.BarcodeDetector>['prototype']['constructor']> | null>(null);

  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied' | 'error'>('starting');
  const [torch, setTorch] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [found, setFound] = useState<string | null>(null);

  const handleDetected = useCallback((raw: string) => {
    const route = extractRoute(raw);
    if (!route) return;
    if (found) return;
    setFound(route);
    // small delay so user sees the flash
    setTimeout(() => {
      stopStream();
      onClose();
      navigate(route);
    }, 300);
  }, [found, navigate, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopStream = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  // jsQR polling loop
  const startJsQrLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) handleDetected(code.data);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDetected]);

  // BarcodeDetector polling loop
  const startBarcodeLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || !detectorRef.current) return;
    const detector = detectorRef.current;

    const tick = async () => {
      if (video.readyState >= 2) {
        try {
          const results = await detector.detect(video);
          for (const r of results) handleDetected(r.rawValue);
        } catch { /* ignore */ }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDetected]);

  useEffect(() => {
    let active = true;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        // Torch detection
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as Record<string, unknown> | undefined;
        if (caps?.torch) setTorchAvail(true);

        setStatus('scanning');

        // Prefer BarcodeDetector (faster, no canvas overhead)
        if (hasBarcodeDetector && window.BarcodeDetector) {
          detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          startBarcodeLoop();
        } else {
          startJsQrLoop();
        }
      } catch (err) {
        if (!active) return;
        const e = err as DOMException;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setStatus('denied');
        } else {
          setStatus('error');
        }
      }
    };

    start();
    return () => {
      active = false;
      stopStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const newVal = !torch;
    try {
      await (track as unknown as { applyConstraints(c: Record<string, unknown>): Promise<void> }).applyConstraints({ advanced: [{ torch: newVal }] });
      setTorch(newVal);
    } catch { /* ignore */ }
  };

  const handleManualSubmit = () => {
    const trimmed = manual.trim();
    // Accept raw UUID or full URL
    const uuid = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    if (uuid) {
      stopStream();
      onClose();
      navigate(`/sac/${uuid}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#000' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 absolute top-0 left-0 right-0 z-10">
        <button onClick={() => { stopStream(); onClose(); }}
          className="p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
          <X className="w-5 h-5" />
        </button>
        <span className="text-white text-sm font-semibold">Scanner un sac</span>
        <div className="flex items-center gap-2">
          {torchAvail && (
            <button onClick={toggleTorch} className="p-2 rounded-full" style={{ background: torch ? 'rgba(249,115,22,0.8)' : 'rgba(0,0,0,0.5)', color: '#fff' }}>
              <Flashlight className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => setShowManual(v => !v)} className="p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
            <Keyboard className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Caméra */}
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay viseur */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: 240, height: 240 }}>
          {/* Coins */}
          {[['top-0 left-0', 'top', 'left'], ['top-0 right-0', 'top', 'right'], ['bottom-0 left-0', 'bottom', 'left'], ['bottom-0 right-0', 'bottom', 'right']].map(([pos, v, h]) => (
            <div key={pos} className={`absolute ${pos} w-12 h-12`}
              style={{
                borderColor: found ? '#10B981' : '#F97316',
                borderStyle: 'solid',
                borderTopWidth: v === 'top' ? 3 : 0,
                borderBottomWidth: v === 'bottom' ? 3 : 0,
                borderLeftWidth: h === 'left' ? 3 : 0,
                borderRightWidth: h === 'right' ? 3 : 0,
                borderRadius: 4,
                transition: 'border-color 0.2s',
              }} />
          ))}
          {found && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.9)' }}>
                <span className="text-white text-3xl">✓</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Statuts */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe pb-6 px-5 space-y-3">
        {status === 'starting' && (
          <p className="text-center text-white/70 text-sm">Démarrage de la caméra...</p>
        )}
        {status === 'scanning' && !found && (
          <p className="text-center text-white/70 text-sm">Pointez la caméra vers le QR code du sac</p>
        )}
        {status === 'denied' && (
          <div className="rounded-2xl p-4 text-center space-y-2" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <QrCode className="w-8 h-8 mx-auto" style={{ color: '#F87171' }} />
            <p className="text-sm text-white font-semibold">Accès caméra refusé</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Autorisez l'accès caméra dans les réglages du navigateur</p>
          </div>
        )}
        {status === 'error' && (
          <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <p className="text-sm text-white">Impossible d'accéder à la caméra</p>
          </div>
        )}

        {/* Saisie manuelle */}
        {(showManual || status === 'denied' || status === 'error') && (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <p className="text-xs text-white/60 text-center">Saisie manuelle — UUID ou URL du sac</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manual}
                onChange={e => setManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 rounded-xl px-3 py-2 text-sm text-white"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', outline: 'none' }}
                autoCapitalize="none"
                autoCorrect="off"
              />
              <button onClick={handleManualSubmit}
                className="px-4 rounded-xl text-sm font-bold text-white"
                style={{ background: '#F97316' }}>
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bouton compact ───────────────────────────────────────────────────────────

export function QrScannerButton({ label = '📷 Scanner', className, style }: { label?: string; className?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className} style={style}>
        {label}
      </button>
      {open && <QrScanner onClose={() => setOpen(false)} />}
    </>
  );
}
