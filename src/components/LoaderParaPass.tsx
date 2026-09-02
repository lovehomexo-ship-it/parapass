// ═══════════════════════════════════════════════════════════════════════════
// Écran de chargement ParaPass — voile vue de dessus tournant autour de la cible.
//
// 100 % SVG + CSS : s'affiche instantanément (aucune image à télécharger), net
// à toutes les tailles, animé sur GPU (transform seul). Respecte
// prefers-reduced-motion : sans mouvement, la scène reste lisible et posée.
// ═══════════════════════════════════════════════════════════════════════════

export function LoaderParaPass({
  taille = 120,
  message = 'Chargement…',
  pleinEcran = false,
}: { taille?: number; message?: string | null; pleinEcran?: boolean }) {
  const scene = (
    <div className="flex flex-col items-center gap-4">
      <svg
        width={taille} height={taille} viewBox="0 0 120 120"
        role="img" aria-label="Chargement en cours"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="pp-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pp-voile" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#93C5FD" />
          </linearGradient>
        </defs>

        {/* Halo doux au centre */}
        <circle cx="60" cy="60" r="46" fill="url(#pp-halo)" />

        {/* CIBLE — anneaux concentriques, comme l'aire d'atterrissage */}
        <circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
        <circle cx="60" cy="60" r="27" fill="none" stroke="currentColor" strokeOpacity="0.20" strokeWidth="1" />
        <circle cx="60" cy="60" r="14" fill="none" stroke="#F97316" strokeOpacity="0.55" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="3.2" fill="#F97316" />

        {/* Trajectoire parcourue (arc qui suit la voile) */}
        <g className="pp-orbite">
          <path
            d="M 60 18 A 42 42 0 0 1 96 39"
            fill="none" stroke="#60A5FA" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round"
          />
          {/* VOILE vue de dessus : aile rectangulaire à caissons, inclinée dans le virage */}
          <g transform="translate(60 18)">
            <g transform="rotate(90)">
              <rect x="-4.5" y="-12" width="9" height="24" rx="4.5" fill="url(#pp-voile)" />
              {/* caissons */}
              {[-8, -4, 0, 4, 8].map((y) => (
                <line key={y} x1="-4.5" y1={y} x2="4.5" y2={y} stroke="#1E3A8A" strokeOpacity="0.35" strokeWidth="0.7" />
              ))}
              {/* suspentes + parachutiste */}
              <line x1="0" y1="12" x2="0" y2="17" stroke="#1E3A8A" strokeOpacity="0.5" strokeWidth="0.8" />
              <circle cx="0" cy="18.5" r="2.2" fill="#0F2547" />
            </g>
          </g>
        </g>
      </svg>

      {message && (
        <p className="text-sm font-medium" style={{ color: 'var(--c-muted, #64748B)' }}>{message}</p>
      )}

      <style>{`
        @keyframes ppOrbite { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pp-orbite {
          transform-origin: 60px 60px;
          animation: ppOrbite 2.8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pp-orbite { animation: none; }
        }
      `}</style>
    </div>
  );

  if (!pleinEcran) return scene;
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--c-bg, #001A4D)', color: 'var(--c-text, #FFFFFF)' }}>
      {scene}
    </div>
  );
}
