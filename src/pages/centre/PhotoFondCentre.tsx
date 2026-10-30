import { useRef, useState } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// LA PHOTO DE FOND DU CENTRE — retour du DT de Rochefort : que l'application
// soit à l'image de la DZ. Elle habille le bandeau de la Journée (et l'accueil
// des parachutistes du centre). Réduite dans le navigateur à 1 920 px de large
// en JPEG : une photo de téléphone de 6 Mo ne doit pas se charger en 4G sur la
// zone d'embarquement.
// ═══════════════════════════════════════════════════════════════════════════

const LARGEUR_MAX = 1920;

/** Réduit l'image et la renvoie en JPEG. */
async function reduire(fichier: File): Promise<Blob> {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Image illisible')); i.src = url;
    });
    const echelle = Math.min(1, LARGEUR_MAX / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * echelle);
    c.height = Math.round(img.naturalHeight * echelle);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('Conversion impossible')), 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}

export function PhotoFondCentre({ centreId, fondUrl, onSaved }: {
  centreId: string; fondUrl: string | null; onSaved: (url: string | null) => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  // Même seau et même règle que le logo : `logo-<centre>.…` n'est inscriptible
  // que par un admin de ce centre.
  const chemin = `logo-${centreId}.fond.jpg`;

  const envoyer = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur(null);
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(fichier.type) && !/\.(jpe?g|png|webp|heic)$/i.test(fichier.name)) {
      setErreur('Choisissez une photo (JPG, PNG ou WebP).'); return;
    }
    setEnvoi(true);
    try {
      const blob = await reduire(fichier);
      const { error } = await supabase.storage.from('centre-logos').upload(chemin, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('centre-logos').getPublicUrl(chemin);
      const url = `${publicUrl}?t=${Date.now()}`;
      const { data, error: e2 } = await supabase.from('centres').update({ fond_url: url }).eq('id', centreId).select('id');
      if (e2 || !data?.length) throw e2 ?? new Error('droits insuffisants sur ce centre');
      onSaved(url);
    } catch (e) {
      setErreur(`La photo n’a pas pu être enregistrée : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    } finally {
      setEnvoi(false);
      if (champ.current) champ.current.value = '';
    }
  };

  const retirer = async () => {
    setErreur(null);
    const { data, error } = await supabase.from('centres').update({ fond_url: null }).eq('id', centreId).select('id');
    if (error || !data?.length) { setErreur('La photo n’a pas pu être retirée.'); return; }
    await supabase.storage.from('centre-logos').remove([chemin]);
    onSaved(null);
  };

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-text)' }}>Photo de fond</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
          Une photo de votre DZ : elle habille la Journée et l’accueil de vos parachutistes.
        </p>
      </div>
      <div className="relative mx-5 mb-4 rounded-xl overflow-hidden flex items-end"
        style={{ height: 150, background: fondUrl ? `center / cover no-repeat url("${fondUrl}")` : 'var(--c-hover)' }}>
        {fondUrl && <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,29,58,0.05), rgba(11,29,58,0.7))' }} />}
        {!fondUrl && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-[13px]" style={{ color: 'var(--c-muted)' }}>
            <ImageIcon className="w-5 h-5" aria-hidden /> Aucune photo
          </span>
        )}
        {fondUrl && <span className="relative px-3 pb-2 text-[15px] font-bold text-white">Aperçu du bandeau</span>}
      </div>
      <div className="px-5 pb-4 flex gap-2 flex-wrap">
        <input ref={champ} type="file" accept="image/*" className="sr-only" id="photo-fond-centre"
          onChange={e => envoyer(e.target.files?.[0])} />
        <label htmlFor="photo-fond-centre"
          className="inline-flex items-center gap-2 px-4 rounded-xl text-[14px] font-bold text-white cursor-pointer"
          style={{ minHeight: 44, background: 'var(--action-fond, #2563EB)', opacity: envoi ? 0.6 : 1 }}>
          <Upload className="w-4 h-4" aria-hidden /> {envoi ? 'Envoi…' : fondUrl ? 'Changer la photo' : 'Choisir une photo'}
        </label>
        {fondUrl && (
          <button type="button" onClick={retirer} className="inline-flex items-center gap-2 px-4 rounded-xl text-[14px] font-semibold"
            style={{ minHeight: 44, color: 'var(--sev-critique)', border: '1px solid var(--c-border)' }}>
            <Trash2 className="w-4 h-4" aria-hidden /> Retirer
          </button>
        )}
      </div>
      {erreur && <p role="alert" className="px-5 pb-4 text-[13px]" style={{ color: 'var(--sev-critique)' }}>{erreur}</p>}
    </section>
  );
}
