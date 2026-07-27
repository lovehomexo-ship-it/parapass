import { useEffect } from 'react';
import { usePrefersReducedMotion } from '../lib/useAnimation';

// ═══════════════════════════════════════════════════════════════════════════
// Célébration légère et NON BLOQUANTE — éclat + confettis en overlay.
// pointer-events: none → n'intercepte jamais un clic. Jouée une seule fois
// (montée via `show`, auto-effacée après la durée). Respecte reduced-motion.
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = ['#F97316', '#10B981', '#2563EB', '#FCD34D', '#A78BFA'];

export function CelebrationBurst({ show, onDone }: { show: boolean; onDone: () => void }) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!show) return;
    // Auto-nettoyage : durée courte, jamais persistante.
    const ms = reduced ? 400 : 1100;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [show, reduced, onDone]);

  if (!show) return null;

  // Reduced-motion : pas de mouvement, un simple halo bref et discret.
  if (reduced) {
    return (
      <div aria-hidden className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
        <div style={{ width: 90, height: 90, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.6)' }} />
      </div>
    );
  }

  return (
    <div aria-hidden className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden">
      <div className="celeb-ring absolute rounded-full" style={{ width: 80, height: 80, border: '3px solid rgba(16,185,129,0.7)' }} />
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * 360 + (i % 2 ? 9 : 0);
        const dist = 90 + (i % 5) * 26;
        const dx = Math.round(Math.cos(angle * Math.PI / 180) * dist);
        const dy = Math.round(Math.sin(angle * Math.PI / 180) * dist);
        return (
          <span
            key={i}
            className="celeb-confetti absolute rounded-[1px]"
            style={{
              width: 7, height: 10, background: COLORS[i % COLORS.length],
              ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`,
              ['--rot' as string]: `${(i % 2 ? 1 : -1) * (180 + i * 12)}deg`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes celebRingPulse { 0% { transform: scale(0.4); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes celebConfetti {
          0% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }
        .celeb-ring { animation: celebRingPulse 0.9s ease-out 1 both; }
        .celeb-confetti { animation: celebConfetti 1s cubic-bezier(0.22,0.61,0.36,1) 1 both; }
        @media (prefers-reduced-motion: reduce) {
          .celeb-ring, .celeb-confetti { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
