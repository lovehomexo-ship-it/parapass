import { useEffect, useState, useCallback } from 'react';
import { X, Share2, ImagePlus, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { fetchRegulatorySnapshot } from '../lib/regulatory';
import { countMasteredElements, TECH_ELEMENTS } from '../lib/progression';
import {
  buildCardModel, generateShareCard, loadImage,
  type ShareFormat, type ShareToggles,
} from '../lib/shareCard';
import { LoaderParaPass } from './LoaderParaPass';

interface Props {
  userId: string;
  prenom: string;
  centre: string | null;
  /** Nombre de sauts enregistrés aujourd'hui (entrée « à chaud »), 0 sinon. */
  sautsDuJour?: number;
  /** Palier franchi éventuel (variante badge). */
  nouveauBadge?: string | null;
  onClose: () => void;
}

function ShareCardInner({ userId, prenom, centre, sautsDuJour = 0, nouveauBadge = null, onClose }: Props) {
  const [total, setTotal] = useState(0);
  const [maitrises, setMaitrises] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [format, setFormat] = useState<ShareFormat>('carre');
  const [toggles, setToggles] = useState<ShareToggles>({ showTotal: true, showProgression: true, showCentre: true });
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [rendering, setRendering] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Données RÉELLES depuis la source unique (total) + progression (éléments).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingData(true); setDataError(null);
      const snap = await fetchRegulatorySnapshot(userId);
      const { data, error } = await supabase
        .from('jump_progression')
        .select('*').eq('user_id', userId).not('note_globale', 'is', null)
        .order('created_at', { ascending: false }).limit(100);
      if (cancelled) return;
      if (error) { console.error('Chargement progression carte échoué :', error); setDataError('Impossible de charger les données.'); setLoadingData(false); return; }
      const evalRecords = (data ?? []) as unknown as Record<string, unknown>[];
      setTotal(snap.total);
      setMaitrises(countMasteredElements(evalRecords).mastered);
      setLoadingData(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const dateLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // (Re)génère l'aperçu à chaque changement — MAJ locale immédiate, sans reload.
  const regenerate = useCallback(async () => {
    if (loadingData) return;
    setRendering(true); setShareError(null);
    try {
      const model = buildCardModel(
        { prenom, total, sautsDuJour, elementsMaitrises: maitrises, elementsTotal: TECH_ELEMENTS.length, centre, dateLabel, nouveauBadge },
        toggles,
      );
      const blob = await generateShareCard(model, format, photo);
      setLastBlob(blob);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch (e) {
      console.error('Génération carte échouée :', e);
      setShareError('La génération de la carte a échoué.');
    } finally {
      setRendering(false);
    }
  }, [loadingData, prenom, total, sautsDuJour, maitrises, centre, dateLabel, nouveauBadge, toggles, format, photo]);

  useEffect(() => { regenerate(); }, [regenerate]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setShareError(null);
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      setPhoto(img); // le passage canvas retire l'EXIF/GPS à la génération
    } catch {
      setShareError('Photo illisible. Choisissez une autre image.');
    }
  };

  const partager = async () => {
    if (!lastBlob) return;
    setShareError(null);
    const file = new File([lastBlob], `parapass-${format}.png`, { type: 'image/png' });
    // Feuille de partage native si dispo (mobile), sinon téléchargement — action explicite.
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Ma journée ParaPass' });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { console.error('Partage échoué :', e); setShareError('Le partage a échoué.'); }
      }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(lastBlob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const Toggle = ({ label, k }: { label: string; k: keyof ShareToggles }) => (
    <button
      onClick={() => setToggles(t => ({ ...t, [k]: !t[k] }))}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
      style={{ background: toggles[k] ? 'rgba(249,115,22,0.15)' : 'var(--c-hover)', color: toggles[k] ? '#F97316' : 'var(--c-muted)', border: `1px solid ${toggles[k] ? 'rgba(249,115,22,0.4)' : 'var(--c-border-s)'}` }}
    >
      {toggles[k] ? '☑' : '☐'} {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: 'var(--c-card)', maxHeight: '94vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--c-border-s)' }}>
          <h2 className="font-bold" style={{ color: 'var(--c-text)' }}>Partager ma carte</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--c-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* Aperçu */}
          <div className="rounded-2xl overflow-hidden flex items-center justify-center" style={{ background: '#001A4D', minHeight: 220 }}>
            {loadingData || (rendering && !previewUrl) ? (
              // Génération de l'image : attente de plusieurs secondes, donc un
              // vrai écran de chargement plutôt qu'un cercle anonyme.
              <div className="my-8"><LoaderParaPass taille={130} message="Préparation de votre carte…" /></div>
            ) : dataError ? (
              <p className="text-sm text-red-300 py-16 px-4 text-center">{dataError}</p>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Aperçu de la carte" className="w-full h-auto" style={{ maxHeight: '52vh', objectFit: 'contain' }} />
            ) : null}
          </div>

          {/* Format */}
          <div className="flex gap-2">
            {(['carre', 'story'] as ShareFormat[]).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: format === f ? '#001A4D' : 'var(--c-hover)', color: format === f ? '#fff' : 'var(--c-muted)' }}>
                {f === 'carre' ? 'Carré (feed)' : 'Story'}
              </button>
            ))}
          </div>

          {/* Blocs */}
          <div className="flex flex-wrap gap-2">
            <Toggle label="Total" k="showTotal" />
            <Toggle label="Progression" k="showProgression" />
            <Toggle label="Centre" k="showCentre" />
          </div>

          {/* Photo */}
          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--c-hover)', color: 'var(--c-text)', border: '1px solid var(--c-border-s)' }}>
              <ImagePlus className="w-4 h-4" /> {photo ? 'Changer la photo' : 'Ajouter une photo'}
              <input type="file" accept="image/*" className="hidden" onChange={e => onPickPhoto(e.target.files?.[0])} />
            </label>
            {photo && (
              <button onClick={() => setPhoto(null)} className="px-3 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--c-hover)', color: 'var(--c-muted)' }}>Retirer</button>
            )}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
            Ta photo reste sur ton téléphone ; ses métadonnées (dont la position GPS) sont retirées avant génération.
          </p>

          {shareError && <p role="alert" className="text-sm text-red-500">{shareError}</p>}
        </div>

        <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--c-border-s)' }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--c-hover)', color: 'var(--c-muted)' }}>Fermer</button>
          <button onClick={partager} disabled={!lastBlob || rendering}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
            {typeof navigator !== 'undefined' && (navigator as Navigator & { canShare?: unknown }).canShare
              ? <><Share2 className="w-4 h-4" /> Partager</>
              : <><Download className="w-4 h-4" /> Télécharger</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Écran de prévisualisation/partage — sous ErrorBoundary (Prompt V2). */
export function ShareCardModal(props: Props) {
  return <ErrorBoundary><ShareCardInner {...props} /></ErrorBoundary>;
}
