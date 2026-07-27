import { useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Socle d'animations ParaPass — discret, performant, respectueux de l'accessibilité
// ═══════════════════════════════════════════════════════════════════════════
// Toutes les animations passent par ces hooks pour garantir un comportement
// unique et le respect de « prefers-reduced-motion » (aucune animation ne doit
// retarder l'accès à l'information ni bloquer une action).

/** Vrai si l'utilisateur a demandé la réduction des animations (réactif). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Détecte l'entrée dans le viewport (une seule fois). Fallback : visible d'emblée. */
export function useInView<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setInView(true); obs.disconnect(); } },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

/**
 * Compteur animé 0 → `value` (montée douce), démarré quand `start` est vrai.
 * - `reduced-motion` ou durée nulle → affiche directement la valeur finale.
 * - `decimals` pour les moyennes (ex. 4.3). Jamais bloquant : rAF, nettoyé au démontage.
 */
export function useCountUp(value: number, { start = true, duration = 650, decimals = 0 }: { start?: boolean; duration?: number; decimals?: number } = {}): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    if (reduced || duration <= 0) { setDisplay(value); return; }
    const from = fromRef.current;
    const startTs = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / duration);
      // easeOutCubic — démarrage vif, fin douce
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      setDisplay(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, start, duration, reduced]);

  return decimals > 0 ? Number(display.toFixed(decimals)) : Math.round(display);
}
