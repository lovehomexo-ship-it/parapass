import type { ReactNode } from 'react';
import { color, layout } from '../../design/tokens';

// Carte de base (surface + bordure + arrondi homogènes, issus des tokens).
export function Card({ children, elevated, style, className }: {
  children: ReactNode; elevated?: boolean; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: elevated ? color.surfaceElevated : color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: layout.radius,
        padding: layout.cardPadding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Carte de SECTION : surtitre discret + action optionnelle (« Voir tout »).
export function SectionCard({ title, action, children, elevated }: {
  title: string; action?: ReactNode; children: ReactNode; elevated?: boolean;
}) {
  return (
    <Card elevated={elevated} style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="flex items-center justify-between"
        style={{ padding: `${layout.cardPadding}px`, borderBottom: `1px solid ${color.separator}` }}
      >
        <h2 className="text-sm font-semibold" style={{ color: color.textPrimary }}>{title}</h2>
        {action}
      </div>
      <div style={{ padding: layout.cardPadding }}>{children}</div>
    </Card>
  );
}
