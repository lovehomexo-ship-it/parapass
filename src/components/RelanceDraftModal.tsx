import { useState } from 'react';
import { sendMessage } from '../lib/useMessages';

// ─── Brouillon de relance (Prompt P) ─────────────────────────────────────────
// Action SUGGÉRÉE, jamais automatique : le DT relit le message pré-rédigé, peut
// le modifier, et l'envoie LUI-MÊME. « Annuler » n'envoie ni n'enregistre rien.
// Aucun envoi n'a lieu sans clic explicite sur « Envoyer ».

export function RelanceDraftModal({
  dtId, destinataireId, destinataireNom, initialText, onClose, onSent,
}: {
  dtId: string;
  destinataireId: string;
  destinataireNom: string;
  initialText: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const envoyer = async () => {
    if (!text.trim()) { setError('Le message est vide.'); return; }
    setSending(true); setError(null);
    try {
      await sendMessage(dtId, destinataireId, text.trim());
      setSending(false);
      onSent();
    } catch (e) {
      // Erreur explicite : rien n'est masqué, le brouillon reste ouvert.
      console.error('Envoi de la relance échoué :', e);
      setError("L'envoi a échoué. Réessayez.");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Préparer une relance</h2>
          <p className="text-xs text-gray-500 mt-0.5">Brouillon à relire et modifier avant envoi à <span className="font-semibold">{destinataireNom}</span>.</p>
        </div>

        <div className="px-5 py-4 flex-1 overflow-y-auto">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Message</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={7}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 resize-none"
          />
          {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={sending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={envoyer} disabled={sending}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: sending ? '#CBD5E1' : 'linear-gradient(135deg, #001A4D, #1E3A5F)' }}>
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
