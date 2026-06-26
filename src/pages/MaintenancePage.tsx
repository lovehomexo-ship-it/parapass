export function MaintenancePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0B1D3A 0%, #1a3a6e 60%, #0e2850 100%)' }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-8deg); }
          50%       { transform: translateY(-18px) rotate(8deg); }
        }
        @keyframes progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        .icon-float { animation: float 3.4s ease-in-out infinite; }
        .progress-bar { animation: progress-slide 2s ease-in-out infinite; }
        .pulse-glow  { animation: pulse-glow 2.2s ease-in-out infinite; }
      `}</style>

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }} />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }} />
      </div>

      {/* Logo */}
      <div className="mb-8 relative z-10">
        <img
          src="/Logo_ParaPass.png"
          alt="ParaPass"
          className="h-16 sm:h-20 w-auto object-contain mx-auto"
        />
      </div>

      {/* Animated icon */}
      <div className="icon-float mb-8 relative z-10">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: 'rgba(249,115,22,0.12)',
            border: '1.5px solid rgba(249,115,22,0.3)',
            boxShadow: '0 0 40px rgba(249,115,22,0.15)',
          }}
        >
          <span className="text-5xl select-none" role="img" aria-label="parachute">🪂</span>
        </div>
      </div>

      {/* Badge */}
      <div className="mb-6 relative z-10">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase"
          style={{
            background: 'rgba(249,115,22,0.15)',
            color: '#F97316',
            border: '1px solid rgba(249,115,22,0.35)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-glow inline-block" />
          Bêta · Bientôt disponible
        </span>
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3 relative z-10">
        Application en cours de mise à jour
      </h1>

      {/* Subtitle */}
      <p
        className="text-sm sm:text-base text-center max-w-sm leading-relaxed mb-10 relative z-10"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        ParaPass revient très bientôt avec de nouvelles fonctionnalités.
        <br className="hidden sm:block" />
        Merci de votre patience.
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs relative z-10 mb-10">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="progress-bar h-full w-1/3 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #F97316, #EA580C, transparent)' }}
          />
        </div>
        <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Mise à jour en cours…
        </p>
      </div>

      {/* Footer */}
      <p className="text-xs relative z-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
        © 2026 ParaPass · Carnet de sauts numérique FFP
      </p>
    </div>
  );
}
