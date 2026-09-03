import { useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// F03 — Un tiroir, pour changer le NIVEAU DE LECTURE sans perdre l'information.
//
// Le profil vertical de vent est une bonne idée d'instrument : il ne disparaît
// pas, il descend d'un cran. Replié, il coûte moins de 50 px ; déplié, il rend
// tout son contenu.
//
// Vrai composant dépliant accessible : bouton, aria-expanded, aria-controls,
// et contenu focusable une fois ouvert. L'état survit à la visite.
// ═══════════════════════════════════════════════════════════════════════════

export function Tiroir({ titre, soustitre, cle, children, defautOuvert = false }: {
  titre: string;
  soustitre?: string;
  /** Clé de mémorisation. Sans elle, l'état ne survit pas à la visite. */
  cle: string;
  children: React.ReactNode;
  defautOuvert?: boolean;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(() => {
    try {
      const v = localStorage.getItem(`parapass.tiroir.${cle}`);
      return v === null ? defautOuvert : v === '1';
    } catch { return defautOuvert; }
  });

  const basculer = () => {
    setOuvert(v => {
      const n = !v;
      try { localStorage.setItem(`parapass.tiroir.${cle}`, n ? '1' : '0'); } catch { /* mode privé */ }
      return n;
    });
  };

  return (
    <section className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <button onClick={basculer} aria-expanded={ouvert} aria-controls={id}
        className="w-full flex items-center gap-2 px-4 text-left"
        style={{ minHeight: 48 }}>
        <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform"
          style={{ color: 'var(--c-muted)', transform: ouvert ? 'none' : 'rotate(-90deg)' }}
          aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold" style={{ color: 'var(--c-text)' }}>{titre}</span>
          {soustitre && (
            <span className="block text-[11px]" style={{ color: 'var(--c-muted)' }}>{soustitre}</span>
          )}
        </span>
      </button>
      {ouvert && (
        <div id={id} className="px-4 pb-4" style={{ borderTop: '1px solid var(--c-border)' }}>
          {children}
        </div>
      )}
    </section>
  );
}
