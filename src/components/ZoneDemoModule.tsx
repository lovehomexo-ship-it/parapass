import { useState } from 'react';
import { Sparkles, Trash2, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { useDialogues } from './useDialogues';
import { messageErreur } from '../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DE DÉMONSTRATION — un seul bloc pour tous les modules.
//
// Un module vide ne se montre pas. Ce bloc remplit la journée du module, puis
// la vide. Il porte la MÊME forme partout (encadré pointillé, boutons neutres)
// pour que le DT reconnaisse au premier coup d'œil ce qui n'est pas de la
// production — et pour qu'au moment de retirer la démo du produit, il n'y ait
// qu'un fichier à supprimer.
//
// Le retrait vise une COLONNE `demo`, pas un nom ni une date : une donnée
// réelle ne peut pas être confondue avec une donnée de démonstration.
// ═══════════════════════════════════════════════════════════════════════════

type Cle = 'avionnage' | 'pliage';

interface Config {
  /** Ce que le bloc annonce de lui-même, avant tout clic. */
  description: string;
  /** Ce qui va être écrit — nommé AVANT d'écrire. */
  avertissementGenerer: string;
  avertissementRetirer: string;
  libelleGenerer: string;
  rpcGenerer: string;
  rpcRetirer: string;
  /** Ce qui s'est réellement passé, lu dans la réponse de la base. */
  resumer: (r: Record<string, unknown>, mode: 'gen' | 'clr') => string;
}

const n = (r: Record<string, unknown>, k: string) => Number(r[k] ?? 0);

const MODULES: Record<Cle, Config> = {
  avionnage: {
    description: 'Remplit la journée de 4 planches et d’une file d’attente, avec les '
      + 'licenciés actifs du centre. Ne crée aucun saut.',
    avertissementGenerer: '4 planches du jour et une file d’attente, remplies avec les licenciés '
      + 'actifs du centre. Aucun saut n’est enregistré. Les personnes placées verront '
      + '« vous êtes manifesté » sur leur téléphone tant que la démo est active.',
    avertissementRetirer: 'Seules les planches et lignes de file MARQUÉES démonstration seront '
      + 'supprimées. Les planches réelles du jour ne sont pas touchées.',
    libelleGenerer: 'Remplir la journée (démo)',
    rpcGenerer: 'generer_demo_avionnage',
    rpcRetirer: 'retirer_demo_avionnage',
    resumer: (r, mode) => mode === 'gen'
      ? `${n(r,'planches')} planches, ${n(r,'places')} places, ${n(r,'file')} en file.`
        + (r.largueur_designe ? '' : ' Aucun largueur qualifié au centre : les avions restent au sol.')
      : `Retiré : ${n(r,'planches')} planches, ${n(r,'places')} places, ${n(r,'file')} lignes de file.`,
  },
  pliage: {
    description: 'Remplit la journée de 6 sacs, de leurs preneurs et de leurs pliages. '
      + 'N’attribue un pliage habilité qu’à un plieur réellement habilité.',
    avertissementGenerer: '6 sacs de démonstration, leurs assignations du jour et leurs pliages, '
      + 'rattachés aux licenciés actifs du centre. Aucune habilitation de plieur n’est créée : '
      + 'sans plieur habilité, les pliages passent en auto-pliage.',
    avertissementRetirer: 'Seuls les sacs, assignations et pliages MARQUÉS démonstration seront '
      + 'supprimés. Le parc réel et l’historique des pliages ne sont pas touchés.',
    libelleGenerer: 'Remplir la journée (démo)',
    rpcGenerer: 'generer_demo_pliage',
    rpcRetirer: 'retirer_demo_pliage',
    resumer: (r, mode) => mode === 'gen'
      ? `${n(r,'sacs')} sacs, ${n(r,'assignations')} pris, ${n(r,'pliages')} pliages.`
        + (n(r,'plieurs_habilites') > 0
            ? ` ${n(r,'plieurs_habilites')} plieur(s) habilité(s) employé(s).`
            : ' Aucun plieur habilité au centre : tout est en auto-pliage.')
      : `Retiré : ${n(r,'sacs')} sacs, ${n(r,'assignations')} assignations, ${n(r,'pliages')} pliages.`,
  },
};

function Inner({ module, centreId, centreNom, onFait }: {
  module: Cle; centreId: string; centreNom?: string; onFait: () => void;
}) {
  const cfg = MODULES[module];
  const { demanderConfirmation, dialogue } = useDialogues();
  const [occupe, setOccupe] = useState<'gen' | 'clr' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = async (mode: 'gen' | 'clr') => {
    // Ces boutons ÉCRIVENT EN BASE. On nomme le centre et ce qui va se passer
    // avant d'agir : un clic malheureux un jour de présentation coûte plus
    // cher qu'une confirmation.
    const ok = await demanderConfirmation(
      mode === 'gen' ? 'Remplir la journée de démonstration ?' : 'Retirer la démonstration ?',
      `Sur « ${centreNom ?? centreId} » : `
        + (mode === 'gen' ? cfg.avertissementGenerer : cfg.avertissementRetirer));
    if (!ok) return;

    setOccupe(mode); setErreur(null); setInfo(null);
    const { data, error } = await supabase.rpc(
      mode === 'gen' ? cfg.rpcGenerer : cfg.rpcRetirer, { p_centre_id: centreId });
    setOccupe(null);
    if (error) {
      console.error(`Démo ${module} échouée :`, {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(messageErreur(error));
      return;
    }
    setInfo(cfg.resumer((data ?? {}) as Record<string, unknown>, mode));
    onFait();
  };

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2 mt-4"
      style={{ background: 'rgba(148,163,184,0.05)', border: '1px dashed var(--c-border-f)' }}>
      <div className="flex items-center gap-1.5">
        <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--c-dim)' }} aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>
          Zone de test — hors production
        </span>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        {cfg.description} Le retrait ne vise que ce qui est marqué démonstration.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => lancer('gen')} disabled={occupe !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ background: 'rgba(148,163,184,0.14)', color: 'var(--c-text2)', border: '1px solid var(--c-border-f)' }}>
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          {occupe === 'gen' ? 'Remplissage…' : cfg.libelleGenerer}
        </button>
        <button type="button" onClick={() => lancer('clr')} disabled={occupe !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ background: 'transparent', color: 'var(--c-dim)', border: '1px solid var(--c-border-f)' }}>
          <Trash2 className="w-3.5 h-3.5" aria-hidden />
          {occupe === 'clr' ? 'Retrait…' : 'Retirer la démo'}
        </button>
      </div>
      {dialogue}
      {info && <p className="text-[11px] font-medium" style={{ color: '#34D399' }}>{info}</p>}
      {erreur && <p role="alert" className="text-[11px] font-medium" style={{ color: '#F87171' }}>{erreur}</p>}
    </div>
  );
}

export function ZoneDemoModule({ module, centreId, centreNom, onFait }: {
  module: Cle; centreId: string | undefined; centreNom?: string; onFait: () => void;
}) {
  if (!centreId) return null;
  return <ErrorBoundary><Inner module={module} centreId={centreId} centreNom={centreNom} onFait={onFait} /></ErrorBoundary>;
}
