import { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Remplaçant de window.prompt().
//
// Les fenêtres natives (prompt / confirm) sont BLOQUÉES dans une PWA installée,
// dans un cadre isolé, et par de nombreux navigateurs mobiles. Le bouton semble
// alors mort : rien ne s'affiche, rien ne se passe, aucune erreur. C'est
// exactement ce qui rendait la décision météo inutilisable.
//
// Cette modale fonctionne partout, se referme par Échap ou en cliquant à côté,
// et respecte les cibles tactiles de 44 px (usage sur le terrain, une main).
// ═══════════════════════════════════════════════════════════════════════════

export function ModaleSaisie({
  titre,
  description,
  label,
  valeurInitiale = '',
  placeholder,
  obligatoire = false,
  multiligne = true,
  libelleValider = 'Valider',
  couleurValider = '#2563EB',
  onValider,
  onFermer,
}: {
  titre: string;
  description?: string;
  label: string;
  valeurInitiale?: string;
  placeholder?: string;
  obligatoire?: boolean;
  multiligne?: boolean;
  libelleValider?: string;
  couleurValider?: string;
  onValider: (valeur: string) => void | Promise<void>;
  onFermer: () => void;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);
  const [envoi, setEnvoi] = useState(false);
  const champRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    champRef.current?.focus();
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onFermer]);

  const valider = async () => {
    if (obligatoire && !valeur.trim()) return;
    setEnvoi(true);
    await onValider(valeur.trim());
    setEnvoi(false);
  };

  const styleChamp = {
    background: 'var(--c-bg)', border: '1px solid var(--c-border)',
    color: 'var(--c-text)', minHeight: 44,
  } as const;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onFermer}
      role="dialog" aria-modal="true" aria-label={titre}>
      <div className="w-full max-w-md rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
        onClick={e => e.stopPropagation()}>
        <div>
          <h4 className="font-bold text-sm" style={{ color: 'var(--c-text)' }}>{titre}</h4>
          {description && (
            <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>{description}</p>
          )}
        </div>

        {/* Un label vide signale une simple CONFIRMATION : pas de champ à saisir. */}
        {label !== '' && (
        <label className="block text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>
          {label}{obligatoire && ' *'}
          {multiligne ? (
            <textarea ref={champRef as React.RefObject<HTMLTextAreaElement>}
              value={valeur} onChange={e => setValeur(e.target.value)} rows={3}
              placeholder={placeholder}
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm" style={styleChamp} />
          ) : (
            <input ref={champRef as React.RefObject<HTMLInputElement>}
              value={valeur} onChange={e => setValeur(e.target.value)}
              placeholder={placeholder}
              onKeyDown={e => { if (e.key === 'Enter') valider(); }}
              className="mt-1 w-full rounded-xl px-3 text-sm" style={styleChamp} />
          )}
        </label>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onFermer} className="px-4 rounded-xl text-sm font-semibold"
            style={{ minHeight: 44, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
            Annuler
          </button>
          <button onClick={valider} disabled={envoi || (obligatoire && !valeur.trim())}
            className="px-4 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ minHeight: 44, background: couleurValider, color: '#fff' }}>
            {envoi ? 'Enregistrement…' : libelleValider}
          </button>
        </div>
      </div>
    </div>
  );
}
