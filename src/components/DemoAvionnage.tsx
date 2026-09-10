import { useState } from 'react';
import { Sparkles, Trash2, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { useDialogues } from './useDialogues';
import { messageErreur } from '../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — journée de démonstration.
//
// Un module d'avionnage vide ne se montre pas : une planche sans avion et une
// file sans personne ne disent rien de ce que fait le produit. Ce bloc remplit
// la journée, puis la vide.
//
// MÊME FORME que la zone de test de la Journée DZ (encadré pointillé, boutons
// neutres) : le DT reconnaît au premier coup d'œil ce qui n'est pas de la
// production. Les deux zones se retirent le jour venu par le même geste.
//
// LE RETRAIT VISE UNE COLONNE, pas un nom. `rotations.demo` — une planche
// réelle ne peut pas être confondue avec une planche de démo, quel que soit
// son pilote ou son heure.
// ═══════════════════════════════════════════════════════════════════════════

function Inner({ centreId, centreNom, onFait }: {
  centreId: string; centreNom?: string; onFait: () => void;
}) {
  const { demanderConfirmation, dialogue } = useDialogues();
  const [occupe, setOccupe] = useState<'gen' | 'clr' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = async (mode: 'gen' | 'clr') => {
    // Ces deux boutons ÉCRIVENT EN BASE. On nomme le centre et ce qui va se
    // passer avant d'agir — un clic malheureux un jour de présentation coûte
    // plus cher qu'une confirmation.
    const ok = await demanderConfirmation(
      mode === 'gen' ? 'Remplir la journée d’avionnage ?' : 'Retirer la démonstration ?',
      mode === 'gen'
        ? `Sur « ${centreNom ?? centreId} » : 4 planches du jour et une file d’attente, remplies avec les licenciés actifs du centre. Aucun saut n’est enregistré. Les personnes placées verront « vous êtes manifesté » sur leur téléphone tant que la démo est active.`
        : `Sur « ${centreNom ?? centreId} » : seules les planches et lignes de file MARQUÉES démonstration seront supprimées. Les planches réelles du jour ne sont pas touchées.`);
    if (!ok) return;

    setOccupe(mode); setErreur(null); setInfo(null);
    const { data, error } = await supabase.rpc(
      mode === 'gen' ? 'generer_demo_avionnage' : 'retirer_demo_avionnage',
      { p_centre_id: centreId });
    setOccupe(null);
    if (error) {
      console.error('Démo avionnage échouée :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(messageErreur(error));
      return;
    }
    const r = (data ?? {}) as { planches?: number; places?: number; file?: number; largueur_designe?: boolean };
    setInfo(mode === 'gen'
      ? `${r.planches ?? 0} planches, ${r.places ?? 0} places, ${r.file ?? 0} en file.`
        + (r.largueur_designe ? '' : ' Aucun largueur qualifié au centre : les avions restent au sol.')
      : `Retiré : ${r.planches ?? 0} planches, ${r.places ?? 0} places, ${r.file ?? 0} lignes de file.`);
    onFait();
  };

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'rgba(148,163,184,0.05)', border: '1px dashed var(--c-border-f)' }}>
      <div className="flex items-center gap-1.5">
        <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--c-dim)' }} aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>
          Zone de test — hors production
        </span>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        Remplit la journée de 4 planches et d’une file d’attente, avec les licenciés
        actifs du centre. Ne crée aucun saut. Le retrait ne vise que ce qui est
        marqué démonstration.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => lancer('gen')} disabled={occupe !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ background: 'rgba(148,163,184,0.14)', color: 'var(--c-text2)', border: '1px solid var(--c-border-f)' }}>
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          {occupe === 'gen' ? 'Remplissage…' : 'Remplir la journée (démo)'}
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

export function DemoAvionnage({ centreId, centreNom, onFait }: {
  centreId: string | undefined; centreNom?: string; onFait: () => void;
}) {
  if (!centreId) return null;
  return <ErrorBoundary><Inner centreId={centreId} centreNom={centreNom} onFait={onFait} /></ErrorBoundary>;
}
