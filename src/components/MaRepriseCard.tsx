import { Wind } from 'lucide-react';
import { useJumpCounts } from '../lib/useJumpCount';
import {
  useCurrencyRules, getCurrencyStatus, getCurrencyRule,
  CURRENCY_STATUS_CONFIG, daysSince, formatDuree,
} from '../lib/currency';
import { TYPE_BREVET_LABELS } from '../lib/types';

/** Carte « Ma reprise » : récence du dernier saut vs règles paramétrées par niveau.
 *  Signale seulement — la décision reste au moniteur / à la DZ. */
export function MaRepriseCard({ userId, niveau, onPlanifierReprise, masquerSiAJour = false }: {
  userId: string | undefined; niveau: string | null | undefined; onPlanifierReprise?: () => void;
  /** L'accueil ne montre la carte que lorsqu'il y a une reprise à prévoir :
   *  452 px pour dire « À jour » répétaient ce que la pastille d'état dit déjà. */
  masquerSiAJour?: boolean;
}) {
  const { lastJumpDate, lastJumpIsUnvalidated } = useJumpCounts(userId);
  const { rules } = useCurrencyRules();

  const status = getCurrencyStatus(lastJumpDate, niveau, rules);
  const cfg = CURRENCY_STATUS_CONFIG[status];
  const rule = getCurrencyRule(niveau, rules);
  const jours = daysSince(lastJumpDate);
  const niveauLabel = niveau ? (TYPE_BREVET_LABELS[niveau] ?? niveau) : 'niveau non renseigné';

  if (masquerSiAJour && status === 'a_jour') return null;

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
    // LE MODE JOUR RENDAIT CETTE CARTE ILLISIBLE. Fond et textes étaient
    // écrits en blanc translucide — pensés pour le bleu nuit, posés tels quels
    // sur le blanc du thème clair : la carte entière disparaissait, titre
    // compris. Tout passe par les jetons, qui ont une valeur par thème.
    <div className="rounded-2xl p-4" style={{ background: 'var(--c-card)', border: `1px solid ${cfg.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg }}>
            <Wind className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>Ma reprise</h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          {status === 'reprise_obligatoire' ? 'Reprise obligatoire*' : cfg.label}
        </span>
      </div>
      {lastJumpDate && (
        <p className="text-xs mb-1.5" style={{ color: 'var(--c-text2)' }}>
          Dernier saut : <span className="font-semibold" style={{ color: 'var(--c-text)' }}>{new Date(lastJumpDate).toLocaleDateString('fr-FR')}</span>
          {lastJumpIsUnvalidated && <span style={{ color: 'var(--sev-vigilance)' }}> (saut importé non validé)</span>}
        </p>
      )}
      <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text2)' }}>{phrase}</p>
      {status !== 'indetermine' && (
        <p className="text-xs mt-2" style={{ color: 'var(--c-dim)' }}>
          Seuils pour {niveauLabel} : conseillé {rule.seuil_conseille_jours} j · reprise {rule.seuil_obligatoire_jours} j — selon les règles paramétrées{status === 'reprise_obligatoire' ? ' (*)' : ''}.
        </p>
      )}
      {/* Action suggérée (Prompt P) : raccourci vers le planning DZ. Aucune
          inscription automatique — le parachutiste choisit et confirme son créneau. */}
      {(status === 'reprise_conseillee' || status === 'reprise_obligatoire') && onPlanifierReprise && (
        <button
          onClick={onPlanifierReprise}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: cfg.color }}
        >
          Planifier un saut de reprise →
        </button>
      )}
    </div>
  );
}
