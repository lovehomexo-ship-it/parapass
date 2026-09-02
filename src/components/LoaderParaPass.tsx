// ═══════════════════════════════════════════════════════════════════════════
// Écran de chargement ParaPass — parachutiste sous voile.
//
// Visuel réaliste (silhouette issue du logo) animé d'un mouvement de BALANCIER,
// comme un pilote sous sa voile, avec des nuages qui défilent pour donner la
// sensation de descente. Animation en transform/opacity uniquement (GPU) :
// fluide même sur un téléphone modeste. Respecte prefers-reduced-motion.
//
// La silhouette s'adapte au thème : claire sur fond sombre, foncée en clair.
// ═══════════════════════════════════════════════════════════════════════════

export function LoaderParaPass({
  taille = 160,
  message = 'Chargement…',
  pleinEcran = false,
}: { taille?: number; message?: string | null; pleinEcran?: boolean }) {
  const scene = (
    <div className="flex flex-col items-center gap-3">
      <div className="pp-ciel" style={{ width: taille, height: taille * 0.78 }}>
        {/* Nuages qui défilent — matérialisent la descente */}
        <span className="pp-nuage" />
        <span className="pp-nuage pp-n2" />
        <span className="pp-nuage pp-n3" />
        <div className="pp-balancier">
          <div className="pp-flotte">
            <img src="/icons/parachutiste.png" alt="" aria-hidden className="pp-para" />
          </div>
        </div>
      </div>

      {message && (
        <p className="text-sm font-medium" style={{ color: 'var(--c-muted, #94A3B8)' }}>{message}</p>
      )}

      <style>{`
        .pp-ciel { position: relative; overflow: visible; }
        /* Balancier : le pilote oscille sous l'aile, comme en vol réel. */
        @keyframes ppBalancier {
          0%,100% { transform: rotate(-7deg) translateX(-10px); }
          50%     { transform: rotate(7deg)  translateX(10px); }
        }
        @keyframes ppFlotte { 0%,100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
        @keyframes ppNuage {
          0%   { transform: translateY(-24px); opacity: 0; }
          20%  { opacity: .30; }
          80%  { opacity: .30; }
          100% { transform: translateY(150px); opacity: 0; }
        }
        .pp-balancier { width:100%; height:100%; transform-origin:50% 8%;
          animation: ppBalancier 3.6s ease-in-out infinite; }
        .pp-flotte { width:100%; height:100%; animation: ppFlotte 2.6s ease-in-out infinite; }
        .pp-para { width:100%; height:100%; object-fit:contain;
          /* Silhouette claire par défaut (thème sombre) */
          filter: brightness(0) invert(1) drop-shadow(0 6px 18px rgba(96,165,250,.45)); }
        :root[data-theme="light"] .pp-para {
          filter: brightness(0) saturate(100%) invert(11%) sepia(38%) saturate(1800%)
                  hue-rotate(195deg) drop-shadow(0 6px 14px rgba(15,37,71,.25)); }
        .pp-nuage { position:absolute; left:0; right:0; top:20%; height:2px; border-radius:2px;
          background:linear-gradient(90deg, transparent, #93C5FD, transparent);
          animation: ppNuage 4.2s linear infinite; }
        .pp-n2 { animation-delay: 1.4s; }
        .pp-n3 { animation-delay: 2.8s; }
        @media (prefers-reduced-motion: reduce) {
          .pp-balancier, .pp-flotte, .pp-nuage { animation: none; }
        }
      `}</style>
    </div>
  );

  if (!pleinEcran) return scene;
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--c-bg, #001A4D)' }}>
      {scene}
    </div>
  );
}
