import { Wind } from 'lucide-react';
import { useJumpCounts } from '../lib/useJumpCount';
import {
  useCurrencyRules, getCurrencyStatus, getCurrencyRule,
  CURRENCY_STATUS_CONFIG, daysSince, formatDuree,
} from '../lib/currency';
import { TYPE_BREVET_LABELS } from '../lib/types';

/** Carte « Ma reprise » : récence du dernier saut vs règles paramétrées par niveau.
 *  Signale seulement — la décision reste au moniteur / à la DZ. */
export function MaRepriseCard({ userId, niveau }: { userId: string | undefined; niveau: string | null | undefined }) {
  const { lastJumpDate, lastJumpIsUnvalidated } = useJumpCounts(userId);
  const { rules } = useCurrencyRules();

  const status = getCurrencyStatus(lastJumpDate, niveau, rules);
  const cfg = CURRENCY_STATUS_CONFIG[status];
  const rule = getCurrencyRule(niveau, rules);
  const jours = daysSince(lastJumpDate);
  const niveauLabel = niveau ? (TYPE_BREVET_LABELS[niveau] ?? niveau) : 'niveau non renseigné';

  let phrase: string;
  if (status === 'indetermine') {
    phrase = 'Aucun saut connu dans votre carnet — statut de reprise indéterminé. Ajoutez ou importez vos sauts pour un suivi précis.';
  } else if (status === 'a_jour') {
    phrase = `Dernier saut ${formatDuree(jours!)} — dans le seuil paramétré pour votre niveau (${niveauLabel}).`;
  } else if (status === 'reprise_conseillee') {
    phrase = `Dernier saut ${formatDuree(jours!)} — au-delà du seuil conseillé pour votre niveau (${niveauLabel}) : saut de reprise avec moniteur recommandé.`;
  } else {
    phrase = `Dernier saut ${formatDuree(jours!)} — au-delà du seuil paramétré pour votre niveau (${niveauLabel}) : reprise encadrée par un moniteur, selon les règles paramétrées. La décision reste à votre moniteur / votre DZ.`;
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${cfg.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg }}>
            <Wind className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <h3 className="text-sm font-bold text-white">Ma reprise</h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          {status === 'reprise_obligatoire' ? 'Reprise obligatoire*' : cfg.label}
        </span>
      </div>
      {lastJumpDate && (
        <p className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Dernier saut : <span className="font-semibold text-white">{new Date(lastJumpDate).toLocaleDateString('fr-FR')}</span>
          {lastJumpIsUnvalidated && <span style={{ color: '#FBBF24' }}> (saut importé non validé)</span>}
        </p>
      )}
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{phrase}</p>
      {status !== 'indetermine' && (
        <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Seuils pour {niveauLabel} : conseillé {rule.seuil_conseille_jours} j · reprise {rule.seuil_obligatoire_jours} j — selon les règles paramétrées{status === 'reprise_obligatoire' ? ' (*)' : ''}.
        </p>
      )}
    </div>
  );
}
