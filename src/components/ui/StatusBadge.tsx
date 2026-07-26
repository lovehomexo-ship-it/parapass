import type { ReactNode } from 'react';
import { statusSoft, type StatusKind } from '../../design/tokens';

// Pastille de statut — couleur STRICTEMENT liée au sens (ok/warn/danger/neutral).
export function StatusBadge({ status, children, icon }: {
  status: StatusKind; children: ReactNode; icon?: ReactNode;
}) {
  const s = statusSoft[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {icon}
      {children}
    </span>
  );
}
