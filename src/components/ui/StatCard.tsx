import type { ReactNode } from 'react';
import { color, layout, numberColor, type NumberKind } from '../../design/tokens';

// Carte de statistique : libellé + GRAND CHIFFRE (couleur selon sa nature, via
// la règle centrale numberColor) + sous-texte. Le `kind` impose la couleur —
// on ne passe jamais une couleur en dur.
export function StatCard({ label, value, sub, kind = 'informatif', icon, onClick }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  kind?: NumberKind;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={onClick ? 'text-left w-full transition hover:opacity-90' : 'w-full'}
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: layout.radius,
        padding: layout.cardPadding,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && <span style={{ color: numberColor(kind) }}>{icon}</span>}
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: color.textTertiary }}>{label}</span>
      </div>
      <div className="text-2xl font-extrabold leading-none" style={{ color: numberColor(kind) }}>{value}</div>
      {sub != null && <div className="text-xs mt-1" style={{ color: color.textDim }}>{sub}</div>}
    </Tag>
  );
}
