import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { color } from '../../design/tokens';

// Bouton partagé basé sur les tokens. UN SEUL traitement primaire par écran
// (orange plein) ; tout le reste en secondaire (surface neutre + bordure).

type Variant = 'primary' | 'secondary';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  full?: boolean;
}

export function Button({ variant = 'secondary', icon, full, children, style, ...rest }: Props) {
  const base: React.CSSProperties = {
    minHeight: 44,
    borderRadius: 12,
    fontWeight: variant === 'primary' ? 800 : 600,
    padding: '10px 16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: full ? '100%' : undefined,
    cursor: rest.disabled ? 'not-allowed' : 'pointer',
    opacity: rest.disabled ? 0.5 : 1,
  };
  const variantStyle: React.CSSProperties = variant === 'primary'
    ? { background: `linear-gradient(135deg, ${color.action}, #EA580C)`, color: '#fff', border: 'none' }
    : { background: color.surface, color: color.textPrimary, border: `1px solid ${color.borderStrong}` };

  return (
    <button {...rest} style={{ ...base, ...variantStyle, ...style }}>
      {icon}
      {children}
    </button>
  );
}
