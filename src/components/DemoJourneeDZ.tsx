import { useState } from 'react';
import { useDialogues } from './useDialogues';
import { Sparkles, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { messageErreur } from '../lib/avionnage';
import { ErrorBoundary } from './ErrorBoundary';

// ═══════════════════════════════════════════════════════════════════════════
// LE BOUTON DE DÉMONSTRATION — un seul, pour toute la journée de la DZ.
//
// Il y en avait TROIS, sur trois écrans, avec deux populations différentes :
// l'avionnage travaillait sur les licenciés du centre, le tableau de bord
// fabriquait quatre profils « DÉMO » qui n'apparaissaient nulle part ailleurs,
// le pliage avait le sien. Montrer ça à un organisme, c'était montrer deux
// clubs qui s'ignorent dans la même application.
//
// `generer_demo_dz` repart d'une table rase et regénère tout — briefing,
// dossiers, planches, sauts, pliages, tandem, messagerie — sur LES LICENCIÉS
// DU CENTRE. Rejouable autant de fois qu'on veut, tous les jours, sans empiler.
//
// Retrait en prod : supprimer ce fichier + son import + les RPC
// generer_demo_dz / retirer_demo_dz.
// ═══════════════════════════════════════════════════════════════════════════

function DemoJourneeInner({ centreId, centreNom, onDone }: { centreId: string; centreNom?: string; onDone?: () => void }) {
  const { demanderConfirmation, dialogue } = useDialogues();
  const [busy, setBusy] = useState<'gen' | 'clr' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nb = (r: Record<string, unknown>, k: string) => Number(r[k] ?? 0);

  const run = async (mode: 'gen' | 'clr') => {
    // F13 — ce bouton ÉCRIT EN BASE. Le jour d'une présentation, un clic
    // malheureux coûte cher : on nomme le centre et ce qui va se passer.
    const ok = await demanderConfirmation(
      mode === 'gen' ? 'Générer la journée de démonstration ?' : 'Retirer la démonstration ?',
      mode === 'gen'
        ? `Sur « ${centreNom ?? centreId} ». La démonstration précédente est d'abord retirée, `
          + `puis toute la journée est régénérée sur les licenciés du centre : briefing publié, `
          + `dossiers à jour, planches d'avionnage, sauts, pliages, réservations tandem, messagerie. `
          + `Aucun licencié n'est créé ni supprimé.`
        : `Sur « ${centreNom ?? centreId} ». Seuls les enregistrements MARQUÉS démonstration `
          + `sont supprimés. Les licenciés du centre ne sont pas touchés.`);
    if (!ok) return;

    setBusy(mode); setError(null); setInfo(null);
    const fn = mode === 'gen' ? 'generer_demo_dz' : 'retirer_demo_dz';
    const { data, error: err } = await supabase.rpc(fn, { p_centre_id: centreId });
    setBusy(null);
    if (err) {
      // Erreur explicite, jamais masquée : « impossible » tout court ne disait
      // pas POURQUOI, et le retrait est resté cassé sur une clé étrangère.
      console.error(`${fn} échoué :`, { code: err.code, message: err.message, details: err.details, hint: err.hint });
      setError(messageErreur(err));
      return;
    }
    const r = (data ?? {}) as Record<string, unknown>;
    setInfo(mode === 'gen'
      ? `Journée générée : ${nb(r, 'planches')} planches, ${nb(r, 'places')} embarqués, `
        + `${nb(r, 'sauts')} sauts (dont ceux à valider), ${nb(r, 'pliages_du_jour') || nb(r, 'pliages')} pliages, `
        + `${nb(r, 'tandem')} réservations tandem, briefing publié et dossiers à jour.`
      : `Démonstration retirée : ${nb(r, 'planches')} planches, ${nb(r, 'sauts')} sauts, `
        + `${nb(r, 'pliages')} pliages, ${nb(r, 'tandem')} réservations, ${nb(r, 'presences')} présences.`);
    onDone?.(); // rafraîchit le dashboard sans rechargement complet
  };

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'rgba(148,163,184,0.05)', border: '1px dashed var(--c-border-f)' }}>
      <div className="flex items-center gap-1.5">
        <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--c-dim)' }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>Zone de test — hors production</span>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        Un seul bouton pour toute la journée : briefing, dossiers, planches d'avionnage, sauts,
        pliages, tandem et messagerie — sur les licenciés de ce centre, les mêmes partout.
        Rejouable tous les jours : la démonstration précédente est retirée avant d'être refaite.
      </p>
      <div className="flex gap-3 flex-wrap items-center">
        <button onClick={() => run('gen')} disabled={busy !== null}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50"
          style={{ background: '#F97316', color: 'white', minHeight: 40 }}>
          <Sparkles className="w-3.5 h-3.5" /> {busy === 'gen' ? 'Génération…' : 'Générer la journée de démonstration'}
        </button>
        {/* Le retrait n'est PAS un second bouton d'égale importance : c'est la
            sortie de scène, une fois la démonstration finie. */}
        <button onClick={() => run('clr')} disabled={busy !== null}
          className="text-[11px] underline disabled:opacity-50"
          style={{ color: 'var(--c-dim)', minHeight: 32 }}>
          {busy === 'clr' ? 'Retrait…' : 'tout retirer'}
        </button>
      </div>
      {dialogue}
      {info && <p className="text-[11px] font-medium" style={{ color: '#34D399' }}>{info}</p>}
      {error && <p role="alert" className="text-[11px] font-medium" style={{ color: '#F87171' }}>{error}</p>}
    </div>
  );
}

/** Bouton de démo DZ — sous ErrorBoundary, ne s'affiche que si un centre est fourni. */
export function DemoJourneeDZ({ centreId, centreNom, onDone }: { centreId: string | undefined; centreNom?: string; onDone?: () => void }) {
  if (!centreId) return null;
  return <ErrorBoundary><DemoJourneeInner centreId={centreId} centreNom={centreNom} onDone={onDone} /></ErrorBoundary>;
}
