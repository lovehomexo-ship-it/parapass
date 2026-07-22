import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { ErrorBoundary } from './ErrorBoundary';
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';

// ─── Éditeur de photo : recadrage carré (aperçu rond) + zoom + déplacement ────
// Sortie = image RÉELLEMENT recadrée générée au canvas (pas l'originale).
// Mobile-first : pincement + glisser natifs (react-easy-crop) + slider de zoom.

interface Props {
  file: File;
  /** taille du côté de sortie en px (défaut 512) */
  outputSize?: number;
  onCancel: () => void;
  onValidate: (cropped: Blob) => void | Promise<void>;
  /** libellé du bouton valider pendant l'enregistrement */
  saving?: boolean;
}

/** Recadre la zone sélectionnée sur un canvas carré et exporte un JPEG. */
async function cropToBlob(imageSrc: string, area: Area, size: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('decode'));
    i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85);
  });
}

function PhotoCropModalInner({ file, outputSize = 512, onCancel, onValidate, saving }: Props) {
  const [imageSrc] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Monte le Cropper une frame après le conteneur : sinon react-easy-crop mesure
  // un conteneur de taille 0 (image en cache) et calcule une zone de crop nulle.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setAreaPixels(pixels), []);

  const valider = async () => {
    if (!areaPixels) return;
    setError(null);
    try {
      const blob = await cropToBlob(imageSrc, areaPixels, outputSize);
      await onValidate(blob);
    } catch {
      setError('Le recadrage a échoué. Réessayez ou choisissez une autre image.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--c-surface, #0b1220)', maxHeight: '92vh' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--c-border, #1e293b)' }}>
          <p className="font-semibold text-white text-sm">Cadrer la photo</p>
          <button onClick={onCancel} aria-label="Fermer" className="p-1 rounded-lg" style={{ color: 'var(--c-muted, #94a3b8)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zone de recadrage — aperçu rond, ratio 1:1 */}
        <div className="relative w-full" style={{ height: 320, background: '#000' }}>
          {ready && <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={1}
            maxZoom={4}
            zoomSpeed={0.2}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={() => setError(null)}
          />}
        </div>

        {/* Slider de zoom + boutons */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: '1px solid var(--c-border, #1e293b)' }}>
          <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))} aria-label="Dézoomer" className="p-2 rounded-lg" style={{ color: 'var(--c-muted, #94a3b8)' }}>
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#F97316]"
            aria-label="Zoom"
          />
          <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))} aria-label="Zoomer" className="p-2 rounded-lg" style={{ color: 'var(--c-muted, #94a3b8)' }}>
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); }} aria-label="Réinitialiser" className="p-2 rounded-lg" style={{ color: 'var(--c-muted, #94a3b8)' }}>
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <p className="px-4 pb-1 text-[11px]" style={{ color: 'var(--c-muted, #94a3b8)' }}>
          Glissez pour déplacer, pincez ou utilisez le curseur pour zoomer.
        </p>
        {error && <p className="px-4 pb-1 text-xs text-red-400">{error}</p>}

        {/* Actions — gros boutons tactiles */}
        <div className="px-4 py-3 flex gap-3" style={{ borderTop: '1px solid var(--c-border, #1e293b)' }}>
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ minHeight: 48, background: 'var(--c-border, #1e293b)', color: 'white' }}
          >
            <X className="w-4 h-4" /> Annuler
          </button>
          <button
            onClick={valider}
            disabled={saving || !areaPixels}
            className="flex-1 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ minHeight: 48, background: '#F97316' }}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enregistrement…</>
            ) : (
              <><Check className="w-4 h-4" /> Valider</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PhotoCropModal(props: Props) {
  return (
    <ErrorBoundary>
      <PhotoCropModalInner {...props} />
    </ErrorBoundary>
  );
}
