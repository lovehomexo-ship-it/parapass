import type { ReactNode } from 'react';
import { color } from '../../design/tokens';

// État vide : un LIBELLÉ explicite paramétrable, JAMAIS un tiret orphelin.
// (ex. « Aucune séance ouverte », « Rien à vérifier »).
export function EmptyState({ label, hint, icon }: {
  label: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      {icon && <span className="mb-2" style={{ color: color.textDim }}>{icon}</span>}
      <p className="text-sm font-medium" style={{ color: color.textTertiary }}>{label}</p>
      {hint && <p className="text-xs mt-1" style={{ color: color.textDim }}>{hint}</p>}
    </div>
  );
}
