import { useCountUp, useInView, usePrefersReducedMotion } from '../lib/useAnimation';

/**
 * Nombre qui « monte » de 0 vers sa valeur à l'apparition à l'écran.
 * Non bloquant, respecte prefers-reduced-motion (affiche la valeur finale).
 * `decimals` pour les moyennes (4.3), `prefix`/`suffix` pour les unités.
 */
export function AnimatedNumber({
  value, decimals = 0, duration = 650, prefix = '', suffix = '', className,
}: {
  value: number; decimals?: number; duration?: number; prefix?: string; suffix?: string; className?: string;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const display = useCountUp(value, { start: inView, duration, decimals });
  const formatted = decimals > 0 ? display.toFixed(decimals) : String(display);
  return (
    <span ref={ref} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

/**
 * Barre de progression qui se remplit de 0 → `pct` à l'apparition.
 * Respecte prefers-reduced-motion (remplie d'emblée, sans transition).
 */
export function AnimatedBar({
  pct, color, height = 6, track = 'var(--c-hover)', style,
}: {
  pct: number; color: string; height?: number; track?: string; style?: React.CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const target = Math.max(0, Math.min(100, pct));
  const width = reduced || inView ? `${target}%` : '0%';
  return (
    <div ref={ref} style={{ height, background: track, borderRadius: height / 2, overflow: 'hidden', ...style }}>
      <div style={{ height: '100%', width, background: color, borderRadius: height / 2, transition: reduced ? 'none' : 'width 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  );
}
