import { CheckCircle, Clock, AlertTriangle, HelpCircle } from 'lucide-react';
import type { ComplianceStatus } from '../lib/compliance';
import { STATUS_CONFIG, daysUntil } from '../lib/compliance';

const ICONS: Record<ComplianceStatus, React.ReactNode> = {
  ok: <CheckCircle className="w-3.5 h-3.5" />,
  bientot: <Clock className="w-3.5 h-3.5" />,
  expire: <AlertTriangle className="w-3.5 h-3.5" />,
  inconnu: <HelpCircle className="w-3.5 h-3.5" />,
};

/** Badge d'état de conformité (pill colorée avec icône). */
export function ComplianceBadge({ status, echeance }: { status: ComplianceStatus; echeance?: string | null }) {
  const cfg = STATUS_CONFIG[status];
  const days = echeance ? daysUntil(echeance) : null;
  let label = cfg.label;
  if (status === 'bientot' && days !== null) label = `Dans ${days} j`;
  if (status === 'expire' && echeance) label = `Expiré le ${new Date(echeance).toLocaleDateString('fr-FR')}`;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {ICONS[status]} {label}
    </span>
  );
}

/** Pastille discrète (point coloré) pour cartes et listes. */
export function ComplianceDot({ status, title }: { status: ComplianceStatus; title?: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: cfg.color, boxShadow: `0 0 0 3px ${cfg.bg}` }}
      title={title ?? `Conformité : ${cfg.label}`}
      aria-label={title ?? `Conformité : ${cfg.label}`}
    />
  );
}
