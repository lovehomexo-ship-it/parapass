import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Shield, FileText, Wind, Target, Trophy, Check, QrCode, Upload, Lock, ArrowRight, User, Camera } from 'lucide-react';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { ParachuteIcon, ParachuteDropIcon, AltitudeIcon } from '../components/ParachuteIcon';
import { QRCodeSVG } from 'qrcode.react';
import { DemoSelectModal } from '../components/DemoSelectModal';
import { supabase } from '../lib/supabase';

void Smartphone; void FileText; void AltitudeIcon; void Wind; void Target; void Trophy; void User;

// ─── useInView ────────────────────────────────────────────────────────────────

function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold: 0.15, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ─── AnimatedCounter ─────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const { ref, inView } = useInView();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);
  return <span ref={ref}>{val.toLocaleString('fr-FR')}{suffix}</span>;
}



const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  size: (i % 3) + 1,
  duration: 14 + (i % 12),
  delay: (i * 1.3) % 10,
}));

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: 0.18,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Demo Passport Card (flippable) ──────────────────────────────────────────

function DemoPassportCard({ compact = false }: { compact?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const size = compact ? 'max-w-[340px]' : 'max-w-[420px]';

  const h = compact ? 260 : 320;
  const rot = compact ? 'rotate(1deg)' : 'rotate(2deg)';

  return (
    // Outer wrapper carries the decorative tilt + float animation
    <div
      className={`demo-card-wrapper relative w-full ${size} select-none cursor-pointer`}
      style={{ perspective: 1200, height: h, transform: rot }}
      onClick={() => setFlipped(f => !f)}
    >
      {/* Inner div carries only the flip — no extra rotation */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── FACE AVANT ── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            borderRadius: 12, overflow: 'hidden',
            background: 'linear-gradient(135deg, #001A4D 0%, #0f1a30 60%, #1E3A5F 100%)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-end opacity-[0.06] pointer-events-none pr-3">
            <ParachuteIcon className="w-48 h-48 text-white" />
          </div>
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: '#F97316' }} />

          <div className="relative flex flex-col gap-2" style={{ padding: compact ? '12px 12px 10px' : '14px 14px 12px', minHeight: compact ? 'calc(260px - 6px)' : 'calc(320px - 6px)', justifyContent: 'space-between' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-6 w-auto flex-shrink-0" />
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(147,197,253,0.9)', letterSpacing: '0.04em' }}>Carnet de sauts numérique</div>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: '#F97316' }}>CARNET OFFICIEL FFP</div>
                </div>
              </div>
              <div style={{ background: '#10B981', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: 20 }}>ACTIF</div>
            </div>

            {/* Identity */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ width: compact ? 58 : 76, height: compact ? 58 : 76, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)' }}>
                <User style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.5)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: compact ? 18 : 22, fontWeight: 800, letterSpacing: '0.04em', color: '#fff', lineHeight: 1.1, textTransform: 'uppercase' }}>MARTIN</div>
                <div style={{ fontSize: compact ? 14 : 16, fontWeight: 400, color: '#fff', lineHeight: 1.2 }}>Sophie</div>
                <div style={{ fontSize: 11, color: '#F97316', marginTop: 1 }}>Fédération Française de Parachutisme</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Né(e) le 14/03/1992 à Bordeaux</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 3, lineHeight: 1.4 }}>FFP-2024-8801 · Code Club 0916 · Brevet B</div>
              </div>
            </div>

            {/* Data grid */}
            <div className="grid gap-x-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              {[['Validité licence','31/12/2026'],['Cert. méd.','15/03/2027'],['Sauts totaux','51']].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'monospace', lineHeight: 1.3 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Badges + QR */}
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span style={{ fontSize: 9, background: 'rgba(16,185,129,0.18)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>✓ Assuré</span>
                <span style={{ fontSize: 9, background: 'rgba(16,185,129,0.18)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>✓ Validé DZ</span>
              </div>
              <div className="bg-white rounded-lg flex-shrink-0" style={{ padding: 3 }}>
                <QRCodeSVG value="https://parapass.fr/verify/demo" size={54} level="M" fgColor="#001A4D" bgColor="#FFFFFF" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5, marginTop: 1 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Conforme DGAC</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>↺ retourner</div>
            </div>
          </div>
        </div>

        {/* ── FACE ARRIÈRE — mini dashboard ── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            borderRadius: 12, overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f1a30 0%, #001A4D 100%)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            padding: compact ? '12px' : '16px',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: '#F97316' }} />
          <div className="relative flex flex-col gap-3 h-full" style={{ minHeight: compact ? 236 : 296 }}>
            {/* Header mini dashboard */}
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 10, color: 'rgba(147,197,253,0.8)' }}>Sophie MARTIN</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Mon carnet</div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                <span style={{ fontSize: 12 }}>⭐</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FB923C' }}>4.7</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>/5 moy.</span>
              </div>
            </div>

            {/* KPI total sauts */}
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total sauts validés</div>
              <div className="flex items-end gap-2">
                <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>51</span>
                <span style={{ fontSize: 11, color: '#34D399', marginBottom: 2 }}>+3 ce mois</span>
              </div>
            </div>

            {/* Derniers sauts */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Derniers sauts</div>
              <div className="space-y-1.5">
                {[
                  { num: 51, date: '26/06/2026', lieu: 'BigAir Rochefort', h: '4 200 m' },
                  { num: 50, date: '15/06/2026', lieu: 'Royan Ocean Parachutisme', h: '3 500 m' },
                  { num: 49, date: '14/06/2026', lieu: 'BigAir Rochefort', h: '4 000 m' },
                ].map((s) => (
                  <div key={s.num} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>#{s.num} </span>{s.lieu}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{s.date}</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(96,165,250,0.8)', fontFamily: 'monospace' }}>{s.h}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Barre progression licence */}
            <div>
              <div className="flex justify-between mb-1">
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Licence FFP</span>
                <span style={{ fontSize: 9, color: '#34D399', fontWeight: 600 }}>Valide jusqu'au 31/12/2026</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 999 }} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Données démo</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>↺ retourner</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Floating badge ───────────────────────────────────────────────────────────

function FloatingBadge({
  icon, label, delay, className,
}: {
  icon: React.ReactNode;
  label: string;
  delay: string;
  className: string;
}) {
  return (
    <div
      className={`floating-badge absolute flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl px-3 py-2 text-xs font-semibold text-gray-800 whitespace-nowrap border border-white/60 ${className}`}
      style={{ animationDelay: delay }}
    >
      {icon}
      {label}
    </div>
  );
}

// ─── Section OCR — Import IA carnet papier ────────────────────────────────────

const OCR_STEPS = [
  {
    num: '01', icon: '📷',
    titre: 'Photographiez vos pages',
    desc: 'Prenez en photo toutes les pages de votre carnet en une fois. Lumière naturelle recommandée. L\'IA s\'adapte à toutes les écritures.',
  },
  {
    num: '02', icon: '🧠',
    titre: 'Claude Vision analyse tout',
    desc: 'Notre IA reconnaît les dates, lieux, hauteurs, noms de moniteurs et programmes de saut — même en écriture cursive manuscrite.',
  },
  {
    num: '03', icon: '✏️',
    titre: 'Vous validez en 2 minutes',
    desc: 'Chaque saut extrait s\'affiche dans un formulaire éditable. Corrigez si besoin, cochez, importez. Taux de précision : 75 à 85%.',
  },
  {
    num: '04', icon: '✅',
    titre: 'Votre carnet est numérisé',
    desc: 'Les sauts importés reçoivent le statut "Historique · Déclaré sur l\'honneur" — conforme à la réglementation DGAC et FFP.',
  },
];

const OCR_FEATURES = [
  'Nombre de sauts illimité',
  'Toutes les pages de votre carnet',
  'Reconnaissance écriture manuscrite',
  'Validation manuelle incluse',
  'Statut "Historique · Conforme DGAC"',
  'Paiement sécurisé Stripe',
];

const OCR_STATS = [
  { val: '75–85%', label: 'Taux de reconnaissance', sub: 'Sur écriture manuscrite' },
  { val: '< 10s', label: 'Par page analysée', sub: 'Traitement parallèle' },
  { val: 'Illimité', label: 'Nombre de sauts', sub: 'Pour 4,99€ unique' },
];

function SectionOCR() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #070E1C 0%, #0A1628 40%, #0F2240 70%, #071529 100%)' }}>
      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)', transform: 'translateY(-40%)' }} />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)', transform: 'translateY(30%)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5" style={{ background: 'rgba(249,115,22,0.12)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.3)' }}>
            <span>✨</span>
            <span>Fonctionnalité exclusive</span>
          </div>
          <h2 className="font-extrabold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.02em' }}>
            Votre carnet papier dans ParaPass
            <br />
            <span style={{ color: '#F97316' }}>en quelques secondes</span>
          </h2>
          <p className="max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '17px', lineHeight: 1.65 }}>
            Vous avez 50, 100, 500 sauts dans un carnet papier ? Notre intelligence artificielle lit votre écriture manuscrite et importe tout votre historique automatiquement.
          </p>
        </div>

        {/* 2-col grid: steps + price card */}
        <div className="grid lg:grid-cols-2 gap-10 mb-14">

          {/* Left — Steps */}
          <div className="flex flex-col gap-0">
            {OCR_STEPS.map((step, i) => (
              <div key={step.num} className="flex gap-5 relative">
                {/* Vertical connector */}
                {i < OCR_STEPS.length - 1 && (
                  <div className="absolute left-5 top-10 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom, rgba(249,115,22,0.35), transparent)', height: 'calc(100% - 2.5rem)' }} />
                )}

                {/* Icon circle */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
                    {step.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="pb-8">
                  <span className="text-[10px] font-bold tracking-widest uppercase mb-1 block" style={{ color: 'rgba(249,115,22,0.7)' }}>Étape {step.num}</span>
                  <h3 className="font-semibold text-white text-base mb-1.5">{step.titre}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right — Price card */}
          <div className="flex flex-col gap-4">
            {/* Main card */}
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
              {/* Glow */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(249,115,22,0.1) 0%, transparent 60%)' }} />

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full mb-4" style={{ background: 'rgba(249,115,22,0.18)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.35)' }}>
                ⚡ Paiement unique
              </div>

              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <Camera className="w-7 h-7" style={{ color: '#F97316' }} />
              </div>

              <h3 className="text-xl font-bold text-white mb-1">Import IA complet</h3>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>Tous vos sauts passés · Aucune limite de pages · Une seule fois</p>

              {/* Price */}
              <div className="flex items-end gap-1 mb-1">
                <span className="font-black text-white" style={{ fontSize: 48, lineHeight: 1 }}>4,99</span>
                <span className="text-2xl font-bold text-white mb-1">€</span>
              </div>
              <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>paiement unique · pas d'abonnement</p>

              {/* Feature list */}
              <ul className="space-y-2 mb-6">
                {OCR_FEATURES.map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(16,185,129,0.2)', color: '#34D399' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to="/register"
                className="flex items-center justify-center gap-2 w-full text-white font-bold py-3.5 rounded-xl transition-all"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 6px 20px rgba(249,115,22,0.4)', fontSize: 15 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 28px rgba(249,115,22,0.5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(249,115,22,0.4)'; }}
              >
                <Camera className="w-4 h-4" />
                Importer mon carnet papier →
              </Link>

              <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Disponible depuis votre espace parachutiste · Connexion requise
              </p>
            </div>

            {/* Regulatory note */}
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Shield className="w-4 h-4" style={{ color: '#34D399' }} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: '#34D399' }}>Conforme réglementation FFP et DGAC</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Les sauts importés reçoivent le statut "Déclaré sur l'honneur" — identique à la procédure officielle FFP pour les carnets perdus. Archivé et horodaté.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {OCR_STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="px-8 py-6 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', borderRight: i < OCR_STATS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
            >
              <p className="font-black text-white mb-1" style={{ fontSize: 28, letterSpacing: '-0.02em', color: i === 0 ? '#F97316' : i === 1 ? '#60A5FA' : '#34D399' }}>{stat.val}</p>
              <p className="text-sm font-semibold text-white mb-0.5">{stat.label}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export function LandingPage() {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [inscritCount, setInscritCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => { if (count !== null) setInscritCount(count); });
  }, []);

  function getBetaLabel(n: number | null): string {
    if (n === null) return 'Bêta ouverte · Soyez parmi les premiers';
    if (n < 50) return 'Bêta ouverte · Soyez parmi les premiers';
    if (n < 200) return `${n}+ bêta testeurs · Rejoignez-les`;
    return `${n}+ parachutistes inscrits`;
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {showDemoModal && <DemoSelectModal onClose={() => setShowDemoModal(false)} />}
      {/* ── Animations CSS ── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: rotate(2deg) translateY(0px); }
          50% { transform: rotate(2deg) translateY(-16px); }
        }
        @keyframes float-badge {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes badge-appear {
          from { opacity: 0; transform: scale(0.85) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes particle-float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-12px) translateX(4px); }
          66% { transform: translateY(6px) translateX(-4px); }
        }
        @keyframes step-hover-in {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }
        .demo-card-wrapper {
          animation: float-card 5s ease-in-out infinite;
        }
        @keyframes float-card {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        .demo-card-wrapper:hover {
          animation-play-state: paused;
        }
        .floating-badge {
          animation: badge-appear 0.5s ease forwards, float-badge 3.5s ease-in-out 0.5s infinite;
        }
        .particle {
          animation: particle-float linear infinite;
        }
        .step-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .step-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1);
          border-color: #2563EB;
        }
        .hero-btn-primary {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hero-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(37,99,235,0.5) !important;
        }
        .hero-btn-secondary {
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .hero-btn-secondary:hover {
          background: rgba(255,255,255,0.15) !important;
          border-color: rgba(255,255,255,0.5) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .demo-card-wrapper { animation: none !important; }
          .floating-badge { animation: none !important; opacity: 1 !important; }
          .particle { animation: none !important; }
        }
      `}</style>

      {/* ─── NAVBAR + HERO ──────────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(245,158,11,0.08) 0%, transparent 40%),
            linear-gradient(135deg, #001A4D 0%, #002266 50%, #001A4D 100%)
          `,
        }}
      >
        {/* Background decorative parachutes */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <ParachuteIcon className="absolute top-10 left-[6%] w-96 h-96 text-white" />
          <ParachuteDropIcon className="absolute top-24 right-[10%] w-72 h-72 text-white" />
          <ParachuteIcon className="absolute bottom-20 left-[28%] w-48 h-48 text-white" />
          <ParachuteDropIcon className="absolute top-16 left-[50%] w-40 h-40 text-white" />
          <ParachuteIcon className="absolute bottom-12 right-[28%] w-60 h-60 text-white" />
        </div>

        {/* Animated particles */}
        <Particles />

        {/* ─── NAVBAR ─── */}
        <nav className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-3 sm:py-4">
          <Link to="/" className="no-underline flex items-center flex-shrink-0">
            <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-16 sm:h-20 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 ml-3">
            <Link to="/login" className="text-white/80 hover:text-white text-sm font-medium no-underline transition-colors whitespace-nowrap">
              Se connecter
            </Link>
            <Link
              to="/register"
              className="hidden sm:inline-flex text-white text-sm font-semibold px-4 py-2 rounded-lg no-underline transition-all whitespace-nowrap"
              style={{ background: '#2563EB' }}
            >
              Créer un compte
            </Link>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-28 sm:pt-20 sm:pb-36">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

            {/* Left — text */}
            <div className="max-w-2xl">
              {/* Trust badges */}
              <div className="flex flex-wrap gap-2.5 mb-8">
                {[
                  { color: '#10B981', icon: '✓', label: 'Conforme DGAC' },
                  { color: '#60A5FA', icon: <Lock className="w-3 h-3" />, label: 'Signature eIDAS' },
                  { color: '#F59E0B', icon: '🇪🇺', label: 'RGPD Europe' },
                ].map(b => (
                  <span
                    key={b.label}
                    className="flex items-center gap-1.5 border text-white/80 text-xs px-3 py-1.5 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(8px)',
                      borderColor: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <span style={{ color: b.color }}>{b.icon}</span>
                    {b.label}
                  </span>
                ))}
                {/* FFP partner badge */}
                <span
                  className="flex items-center gap-2 border text-white/90 text-xs px-3 py-1.5 rounded-full"
                  style={{
                    background: '#002266',
                    backdropFilter: 'blur(8px)',
                    borderColor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  <img src="/logo-ffp-footer.png" alt="Logo FFP" style={{ height: '18px', width: 'auto' }} />
                  Partenaire officiel
                </span>
              </div>

              {/* Headline */}
              <h1
                className="font-extrabold text-white mb-6 leading-[1.08] tracking-tight"
                style={{ fontSize: 'clamp(36px, 5vw, 62px)', letterSpacing: '-0.02em' }}
              >
                Votre carnet de sauts,<br />
                <span style={{
                  background: 'linear-gradient(135deg, #2563EB, #60A5FA)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  toujours avec vous.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mb-8 leading-relaxed max-w-[480px]" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}>
                Le premier carnet de sauts numérique certifié DGAC. Validé par vos moniteurs en temps réel, accessible partout, même sans connexion.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link
                  to="/register"
                  className="hero-btn-primary inline-flex items-center justify-center gap-2 text-white font-semibold no-underline rounded-xl"
                  style={{
                    background: '#F97316',
                    padding: '14px 28px',
                    fontSize: '16px',
                    boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
                    borderRadius: '12px',
                  }}
                >
                  Créer mon compte gratuit
                </Link>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="hero-btn-secondary inline-flex items-center justify-center gap-2 text-white font-semibold rounded-xl border"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(10px)',
                    padding: '14px 28px',
                    fontSize: '16px',
                    borderRadius: '12px',
                  }}
                >
                  Voir la démo
                </button>
              </div>

              {/* FFP reassurance */}
              <div className="flex items-center gap-2 mb-7">
                <img src="/logo-ffp-footer.png" alt="Logo FFP — Fédération Française de Parachutisme" style={{ height: '20px', width: 'auto', opacity: 0.8 }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                  Application reconnue par la Fédération Française de Parachutisme
                </span>
              </div>

              {/* Social proof */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: 500 }}>
                    {getBetaLabel(inscritCount)}
                  </p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                  🇫🇷 60 000 licenciés FFP en France · 57 centres agréés · marché cible
                </p>
              </div>
            </div>

            {/* Right — card (always visible, grid handles layout) */}
            <div className="flex justify-center">
              <div className="relative" style={{ padding: '40px 40px 40px 24px' }}>

                {/* Badge — top left: Certifié DGAC */}
                <FloatingBadge
                  icon={<span className="text-green-500 font-bold text-sm">✓</span>}
                  label="Certifié DGAC"
                  delay="0.8s"
                  className="top-2 -left-2 z-10"
                />

                {/* Badge — bottom left: Chiffré */}
                <FloatingBadge
                  icon={<Lock className="w-3.5 h-3.5 text-blue-600" />}
                  label="Chiffré AES-256"
                  delay="1.4s"
                  className="-bottom-2 -left-4 z-10"
                />

                {/* Badge — bottom right: hors ligne */}
                <FloatingBadge
                  icon={<span className="text-base">📱</span>}
                  label="Accessible hors ligne"
                  delay="2.0s"
                  className="-bottom-4 -right-2 z-10"
                />

                <DemoPassportCard />
              </div>
            </div>
          </div>
        </div>

        {/* Wave separator — élégant */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="w-full h-20 fill-white">
            <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z" />
          </svg>
        </div>
      </header>

      {/* ─── COMMENT ÇA MARCHE ──────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-3" style={{ color: '#001A4D' }}>Comment ça marche</h2>
            <p className="max-w-xl mx-auto" style={{ color: '#64748B' }}>
              Trois étapes simples pour digitaliser votre carnet et rester en règle avec la DGAC
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Dashed connector line — desktop only */}
            <div
              className="hidden md:block absolute top-[56px] left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] pointer-events-none"
              style={{ borderTop: '2px dashed #E2E8F0', zIndex: 0 }}
            />
            {[
              {
                step: '01',
                icon: <Upload className="w-6 h-6 text-blue-600" />,
                bg: '#EFF6FF',
                iconColor: '#2563EB',
                title: 'Créez votre profil',
                desc: 'Renseignez votre licence FFP, vos brevets, votre certificat médical. Tout est centralisé en 5 minutes.',
              },
              {
                step: '02',
                icon: <ParachuteDropIcon className="w-7 h-7 text-amber-600" />,
                bg: '#FFFBEB',
                iconColor: '#D97706',
                title: 'Enregistrez vos sauts',
                desc: 'Ajoutez chaque saut, votre moniteur le valide par signature électronique certifiée. Conforme au format DGAC.',
              },
              {
                step: '03',
                icon: <QrCode className="w-6 h-6 text-green-600" />,
                bg: '#F0FDF4',
                iconColor: '#16A34A',
                title: 'Présentez votre carnet',
                desc: 'Lors des contrôles DGAC, gendarmerie ou renouvellement de licence, affichez votre QR code. Vérifié en 3 secondes.',
              },
            ].map(item => (
              <div
                key={item.step}
                className="step-card relative bg-white rounded-2xl p-8 border overflow-hidden z-10"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
              >
                {/* Large background number */}
                <div
                  className="absolute top-4 right-5 font-black select-none"
                  style={{ fontSize: '48px', lineHeight: 1, color: 'rgba(37,99,235,0.08)' }}
                >
                  {item.step}
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: item.bg }}
                >
                  {item.icon}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: '#001A4D' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DEUX UNIVERS ───────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: '#001A4D' }}>Une app, deux expériences</h2>
            <p className="max-w-lg mx-auto" style={{ color: '#64748B' }}>
              Que vous soyez parachutiste ou que vous gériez un centre, ParaPass s'adapte.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">

            {/* Card Parachutiste */}
            <div
              className="rounded-2xl p-10 flex flex-col relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}
            >
              <div className="absolute -bottom-8 -right-8 opacity-[0.06] pointer-events-none">
                <ParachuteIcon className="w-48 h-48 text-white" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-5xl" aria-label="parachute">🪂</span>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(37,99,235,0.3)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.3)' }}
                  >
                    Pour les parachutistes
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-6">Votre passeport numérique</h3>
                <ul className="space-y-3 mb-8">
                  {[
                    { icon: '🪪', text: 'Licence FFP avec alertes d\'expiration' },
                    { icon: '🏥', text: 'Certificat médical avec rappels automatiques' },
                    { icon: '🎓', text: 'Brevets A, B, BPA, C, D certifiés' },
                    { icon: '✅', text: 'Sauts validés par moniteur agréé' },
                    { icon: '📱', text: 'QR code pour contrôles DGAC' },
                    { icon: '🛡️', text: 'Matériel avec alertes de révision' },
                    { icon: '👥', text: 'Communauté + messagerie privée' },
                    { icon: '🌤️', text: 'Météo dropzone personnalisée' },
                  ].map(f => (
                    <li key={f.text} className="flex items-center gap-3">
                      <span className="text-base w-5 flex-shrink-0">{f.icon}</span>
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.80)' }}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-5 text-sm font-semibold" style={{ color: '#10B981' }}>
                  Gratuit · Toujours
                </div>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl no-underline transition-all text-sm text-white"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #003082)',
                    boxShadow: '0 6px 20px rgba(37,99,235,0.35)',
                  }}
                >
                  Créer mon compte →
                </Link>
              </div>
            </div>

            {/* Card Centre */}
            <div
              className="rounded-2xl p-10 flex flex-col relative overflow-hidden bg-white"
              style={{ border: '2px solid #F59E0B' }}
            >
              <div className="absolute -bottom-8 -right-8 opacity-[0.04] pointer-events-none">
                <ParachuteIcon className="w-48 h-48" style={{ color: '#F59E0B' } as React.CSSProperties} />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-5xl" aria-label="centre">🏫</span>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.3)' }}
                  >
                    Pour les centres agréés
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-6" style={{ color: '#001A4D' }}>Votre outil de gestion</h3>
                <ul className="space-y-3 mb-8">
                  {[
                    { icon: '👥', text: 'Gérez tous vos licenciés en un clic' },
                    { icon: '✅', text: 'Validez les sauts via délégation DT' },
                    { icon: '⚠️', text: 'Alertes licences et médicaux expirés' },
                    { icon: '📊', text: 'Statistiques et rapports de sauts' },
                    { icon: '💬', text: 'Messagerie avec vos parachutistes' },
                    { icon: '🔑', text: 'Délégation validation aux moniteurs' },
                    { icon: '📋', text: 'Vue conformité réglementaire en temps réel' },
                    { icon: '🔗', text: 'API pour logiciels existants' },
                  ].map(f => (
                    <li key={f.text} className="flex items-center gap-3">
                      <span className="text-base w-5 flex-shrink-0">{f.icon}</span>
                      <span className="text-sm" style={{ color: '#374151' }}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-5 text-sm font-semibold" style={{ color: '#D97706' }}>
                  49€ HT/mois · Essai 30j offert
                </div>
                <Link
                  to="/inscription-centre"
                  className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl no-underline transition-all text-sm text-white"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #F97316)',
                    boxShadow: '0 6px 20px rgba(245,158,11,0.3)',
                  }}
                >
                  Inscrire mon centre →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION A — GRILLE FONCTIONNALITÉS ─────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-extrabold mb-4 tracking-tight" style={{ fontSize: 'clamp(28px, 3.5vw, 36px)', color: '#0F172A' }}>
              Tout ce dont vous avez besoin,<br className="hidden sm:block" /> dans une seule application
            </h2>
            <p className="max-w-xl mx-auto" style={{ fontSize: '18px', color: '#64748B', lineHeight: 1.6 }}>
              Des milliers de données, zéro paperasse. Votre vie de parachutiste numérisée en 5 minutes.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { emoji: '🪪', title: 'Passeport numérique', desc: 'Licence, brevet, certificat médical. Tout vérifié en un scan de QR code.', border: '#2563EB' },
              { emoji: '✅', title: 'Validation moniteur', desc: 'Vos moniteurs signent vos sauts directement depuis leur téléphone. Horodaté et certifié eIDAS.', border: '#10B981' },
              { emoji: '⚠️', title: 'Alertes intelligentes', desc: 'Expiration licence, révision parachute, certificat médical. ParaPass vous prévient avant qu\'il soit trop tard.', border: '#F59E0B' },
              { emoji: '📊', title: 'Statistiques avancées', desc: 'Sauts par mois, altitude moyenne, dropzones visitées, prochain badge. Votre progression visualisée.', border: '#8B5CF6' },
              { emoji: '👥', title: 'Communauté', desc: 'Suivez vos amis parachutistes, messagerie privée, partagez vos sauts. Le réseau social certifié.', border: '#06B6D4' },
              { emoji: '🌤️', title: 'Météo réglementaire', desc: 'Vent au sol comparé à vos limites selon votre brevet. Alerte si conditions hors normes.', border: '#0EA5E9' },
              { emoji: '🏅', title: 'Badges et jalons', desc: '10, 50, 100, 500 sauts… Chaque progression est récompensée et visible par votre communauté.', border: '#EAB308' },
              { emoji: '🔧', title: 'Suivi matériel', desc: 'Parachute, AAD, altimètre. Dates de révision avec alertes automatiques avant échéance.', border: '#EF4444' },
              { emoji: '📱', title: 'Hors connexion', desc: 'QR code accessible sans internet. Parfait sur les DZ sans réseau. Vos données toujours disponibles.', border: '#64748B' },
            ].map(card => (
              <div
                key={card.title}
                className="feat-card group bg-white rounded-xl p-6 border border-l-4"
                style={{
                  borderColor: '#E2E8F0',
                  borderLeftColor: card.border,
                  borderLeftWidth: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
              >
                <div className="text-3xl mb-3">{card.emoji}</div>
                <h3 className="font-semibold mb-1.5 text-[15px]" style={{ color: '#0F172A' }}>{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION B — MOCKUP DASHBOARD PARACHUTISTE ──────────────────── */}
      <section className="py-24" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #002266 60%, #001A4D 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-14">

            {/* Left — text */}
            <div className="lg:w-[42%]">
              <div
                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-6"
                style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA', border: '1px solid rgba(37,99,235,0.3)' }}
              >
                📱 Interface parachutiste
              </div>
              <h2
                className="font-extrabold text-white mb-5 leading-tight"
                style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', letterSpacing: '-0.02em' }}
              >
                Votre tableau de bord<br />toujours à jour
              </h2>
              <p className="mb-7 leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)', fontSize: '17px', lineHeight: 1.65 }}>
                En un coup d'œil : vos derniers sauts, votre progression vers le prochain badge, et toutes vos alertes réglementaires.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  '31 sauts certifiés, historique complet',
                  'Note de progression : 4,2 / 5',
                  'Dernière DZ : BigAir Rochefort',
                  'Licence valide jusqu\'au 31/12/2026',
                  'Alerte parachute de secours active',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#2563EB' }}>
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl group"
                style={{ background: 'linear-gradient(135deg, #2563EB, #003082)', boxShadow: '0 6px 20px rgba(37,99,235,0.4)' }}
              >
                Essayer la démo gratuite
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Right — dashboard mockup */}
            <div className="lg:w-[58%]">
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0B1D3A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
                {/* Top nav */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: '#071529', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-6 w-auto" />
                    <span className="text-xs font-semibold text-white">Sophie MARTIN</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(249,115,22,0.2)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>DÉMO</span>
                  </div>
                  <div className="flex gap-1">
                    {['Passeport', 'Sauts', 'Stats', 'Badges'].map(t => (
                      <span key={t} className="text-[10px] px-2 py-1 rounded-md" style={{ color: 'rgba(255,255,255,0.45)' }}>{t}</span>
                    ))}
                    <span className="text-[10px] px-2 py-1 rounded-md text-white font-semibold" style={{ background: 'rgba(255,255,255,0.1)' }}>Tableau de bord</span>
                  </div>
                </div>
                {/* Sub-tabs */}
                <div className="flex gap-1 px-4 py-2" style={{ background: '#0F2549', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Tableau de bord', 'Mon Carnet', 'Ma DZ'].map((t, i) => (
                    <span key={t} className="text-[10px] px-3 py-1 rounded-md" style={{
                      background: i === 0 ? 'rgba(37,99,235,0.25)' : 'transparent',
                      color: i === 0 ? '#60A5FA' : 'rgba(255,255,255,0.4)',
                      fontWeight: i === 0 ? 600 : 400,
                    }}>{t}</span>
                  ))}
                </div>
                {/* Hero card */}
                <div className="mx-4 mt-3 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #0F2549 0%, #1a3a6e 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#2563EB', border: '2px solid rgba(249,115,22,0.5)', fontSize: '14px' }}>SM</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm uppercase tracking-wide">MARTIN Sophie</div>
                      <div className="text-[10px]" style={{ color: '#93C5FD' }}>Brevet B · BigAir Rochefort</div>
                      <div className="text-[9px] mt-0.5" style={{ color: '#F97316' }}>FFP-2021-08734</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-extrabold text-white">31</div>
                      <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>sauts certifiés</div>
                    </div>
                  </div>
                </div>
                {/* Alert */}
                <div className="mx-4 mt-2 rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <span className="text-red-400 text-xs">⚠</span>
                  <span className="text-[10px] font-semibold text-red-400">Parachute de secours</span>
                  <span className="text-[10px] text-red-300 ml-1">— révision requise avant le 15/06/2026</span>
                  <span className="ml-auto text-[9px] text-red-400 font-bold">URGENT</span>
                </div>
                {/* KPI cards */}
                <div className="grid grid-cols-3 gap-2 px-4 mt-2">
                  {[
                    { label: 'Total sauts', value: '31', sub: '+5 ce mois', accent: '#F97316' },
                    { label: 'Dernier saut', value: '18/05', sub: 'BigAir Rochefort', accent: '#60A5FA' },
                    { label: 'Progression', value: '4,2/5', sub: 'Tendance +', accent: '#10B981' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${s.accent}` }}>
                      <div className="text-[9px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</div>
                      <div className="text-base font-bold text-white">{s.value}</div>
                      <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Progression mini */}
                <div className="mx-4 mt-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-semibold text-white">Note de progression</span>
                    <span className="text-[10px] font-bold" style={{ color: '#F97316' }}>4,2 / 5</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Position', val: 4.1 },
                      { label: 'Mental', val: 4.3 },
                      { label: 'Atterrissage', val: 3.8 },
                    ].map(kpi => (
                      <div key={kpi.label}>
                        <div className="text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{kpi.label}</div>
                        <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${kpi.val / 5 * 100}%`, background: 'linear-gradient(90deg, #F97316, #FBBF24)' }} />
                        </div>
                        <div className="text-[9px] mt-0.5 font-semibold" style={{ color: '#F59E0B' }}>{kpi.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Derniers sauts */}
                <div className="mx-4 mt-2 mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="px-3 py-1.5 text-[9px] font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)' }}>
                    DERNIERS SAUTS
                  </div>
                  {[
                    { num: 31, date: '18/05/2026', dz: 'BigAir Rochefort', alt: '4 000m', moniteur: 'Guérin J.' },
                    { num: 30, date: '11/05/2026', dz: 'BigAir Rochefort', alt: '3 800m', moniteur: 'Moreau L.' },
                    { num: 29, date: '03/05/2026', dz: 'Gap-Tallard', alt: '4 200m', moniteur: 'Leroy M.' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#F97316', fontSize: '8px' }}>{s.num}</div>
                      <span className="text-[9px] font-mono w-14 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.date}</span>
                      <span className="text-[10px] flex-1 text-white font-medium truncate">{s.dz}</span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.alt}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>✓ {s.moniteur}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-3 text-center text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Interface réelle de l'application
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION — PROGRESSION ATHLÈTE ────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C', border: '1px solid rgba(249,115,22,0.25)' }}
            >
              📈 Suivi de progression
            </div>
            <h2
              className="font-extrabold mb-4 tracking-tight"
              style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', color: '#0F172A', letterSpacing: '-0.02em' }}
            >
              Suivez votre progression<br className="hidden sm:block" /> comme un athlète
            </h2>
            <p className="max-w-xl mx-auto" style={{ fontSize: '18px', color: '#64748B', lineHeight: 1.65 }}>
              Après chaque saut, votre moniteur note vos performances. Visualisez vos axes d'amélioration, mesurez vos progrès, devenez meilleur.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start gap-12">
            {/* Left — visual mini-dashboard */}
            <div className="lg:w-[55%]">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #0B1D3A 0%, #0F2549 100%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 24px 56px rgba(0,0,0,0.35)',
                }}
              >
                {/* Header */}
                <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div>
                    <div className="text-xs font-bold text-white">Progression · Sophie MARTIN</div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Brevet B · 31 sauts</div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span className="text-[10px] font-bold" style={{ color: '#10B981' }}>↑ Tendance positive</span>
                  </div>
                </div>
                {/* Global note */}
                <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl flex-shrink-0" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
                    <div className="text-2xl font-extrabold text-white leading-none">4,2</div>
                    <div className="text-[9px] text-white/70 mt-0.5">/ 5,0</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white mb-1">Note globale de progression</div>
                    <div className="flex gap-0.5 mb-2">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="h-2 rounded-full flex-1" style={{ background: i <= 4 ? '#F97316' : 'rgba(255,255,255,0.1)' }} />
                      ))}
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Basée sur 8 sauts évalués · Dernière mise à jour 18/05/2026</div>
                  </div>
                </div>
                {/* 6 KPIs grid */}
                <div className="grid grid-cols-3 gap-2 p-4">
                  {[
                    { label: 'Position corps', val: 4.1, max: 5, color: '#60A5FA' },
                    { label: 'Mental / Confiance', val: 4.3, max: 5, color: '#10B981' },
                    { label: 'Ouverture voile', val: 4.5, max: 5, color: '#F97316' },
                    { label: 'Atterrissage', val: 3.8, max: 5, color: '#F59E0B' },
                    { label: 'Poses debout', val: '8/10', max: null, color: '#0EA5E9' },
                    { label: 'Élém. maîtrisés', val: '9/11', max: null, color: '#8B5CF6' },
                  ].map(kpi => (
                    <div key={kpi.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-[9px] mb-2 font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{kpi.label}</div>
                      {kpi.max ? (
                        <>
                          <div className="text-base font-bold text-white mb-1">{kpi.val}</div>
                          <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${(kpi.val as number) / kpi.max * 100}%`, background: kpi.color }} />
                          </div>
                        </>
                      ) : (
                        <div className="text-base font-bold text-white">{kpi.val}</div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Precision */}
                <div className="mx-4 mb-4 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
                  <div>
                    <div className="text-[10px] font-semibold" style={{ color: '#F97316' }}>Précision atterrissage</div>
                    <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Moyenne des 5 derniers sauts évalués</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-white">12 m</div>
                    <div className="text-[9px]" style={{ color: '#10B981' }}>↓ -3m vs mois dernier</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — feature bullets */}
            <div className="lg:w-[45%] flex flex-col justify-center gap-6">
              {[
                {
                  icon: '📊',
                  title: 'Notes par saut, signées par le moniteur',
                  desc: 'Chaque évaluation est horodatée et liée au saut correspondant. Votre progression est inattaquable et vérifiable.',
                },
                {
                  icon: '🎯',
                  title: '6 dimensions évaluées',
                  desc: 'Position corps, mental, ouverture voile, atterrissage, poses techniques, éléments maîtrisés. Un tableau de bord d\'athlète.',
                },
                {
                  icon: '📈',
                  title: 'Tendances et évolution dans le temps',
                  desc: 'Visualisez vos progrès saut après saut. Identifiez vos points forts et axes d\'amélioration en un coup d\'œil.',
                },
                {
                  icon: '🏅',
                  title: 'Visible par votre centre',
                  desc: 'Votre Directeur Technique suit votre progression. Plus besoin de carnets papier pour les entretiens brevet.',
                },
              ].map(feat => (
                <div key={feat.title} className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                  >
                    {feat.icon}
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold mb-1" style={{ color: '#0F172A' }}>{feat.title}</div>
                    <div className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{feat.desc}</div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="mt-2 inline-flex items-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl self-start group"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 6px 20px rgba(249,115,22,0.3)' }}
              >
                Voir ma progression en démo
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION C — MOCKUP CENTRE + B2B ───────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row-reverse lg:items-center gap-14">

            {/* Right (text) */}
            <div className="lg:w-[42%]">
              <div
                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-6"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                🏫 Interface centre agréé
              </div>
              <h2
                className="font-extrabold mb-5 leading-tight"
                style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', color: '#0F172A', letterSpacing: '-0.02em' }}
              >
                Gérez votre dropzone<br />comme un pro
              </h2>
              <p className="mb-7 leading-relaxed" style={{ color: '#64748B', fontSize: '17px', lineHeight: 1.65 }}>
                En un seul tableau de bord : statut réglementaire de tous vos licenciés, validation des sauts par vos moniteurs, messagerie intégrée.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Conformité réglementaire en temps réel',
                  'Délégation validation aux moniteurs',
                  'Messagerie avec vos parachutistes',
                  'Alertes licences et médicaux expirés',
                  'Statistiques et rapports de sauts',
                  'Essai gratuit 30 jours sans CB',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm" style={{ color: '#0F172A' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F59E0B' }}>
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/inscription-centre"
                className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl no-underline group mb-3"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 6px 20px rgba(245,158,11,0.3)' }}
              >
                Inscrire mon centre — Essai 30j gratuit
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="text-xs" style={{ color: '#94A3B8' }}>49€ HT/mois · Sans engagement · Annulation en 1 clic</p>
            </div>

            {/* Left (mockup) */}
            <div className="lg:w-[58%]">
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0B1D3A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}>
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: '#071529', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-6 w-auto" />
                    <span className="text-xs font-bold text-white">BigAir Rochefort</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.2)', color: '#10B981' }}>Agréé FFP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-1 rounded-lg font-semibold" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>3 alertes</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: '#F59E0B' }}>JG</div>
                  </div>
                </div>
                {/* Body with sidebar */}
                <div className="flex" style={{ minHeight: '300px' }}>
                  {/* Sidebar */}
                  <div className="w-28 flex-shrink-0 flex flex-col py-2 gap-0.5" style={{ background: '#0F2549', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    {[
                      { label: 'Dashboard', active: true },
                      { label: 'Licenciés', active: false },
                      { label: 'Demandes', active: false },
                      { label: 'Planning', active: false },
                      { label: 'Stats', active: false },
                      { label: 'Messages', active: false },
                    ].map(item => (
                      <div key={item.label} className="mx-2 px-2 py-1.5 rounded-lg text-[10px] font-medium" style={{
                        background: item.active ? 'rgba(37,99,235,0.2)' : 'transparent',
                        color: item.active ? '#60A5FA' : 'rgba(255,255,255,0.4)',
                        borderLeft: item.active ? '2px solid #2563EB' : '2px solid transparent',
                      }}>{item.label}</div>
                    ))}
                  </div>
                  {/* Main content */}
                  <div className="flex-1 p-3 overflow-hidden">
                    {/* Alert */}
                    <div className="rounded-lg px-3 py-2 flex items-center gap-2 mb-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <span className="text-yellow-400 text-xs">⚠</span>
                      <span className="text-[10px]" style={{ color: '#FCD34D' }}>3 licenciés nécessitent votre attention</span>
                      <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded text-white" style={{ background: '#F59E0B' }}>Voir →</span>
                    </div>
                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {[
                        { label: 'Licenciés', value: '47', accent: '#60A5FA' },
                        { label: 'Conformité', value: '86%', accent: '#10B981' },
                        { label: 'Sauts/mois', value: '312', accent: '#F97316' },
                      ].map(k => (
                        <div key={k.label} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${k.accent}` }}>
                          <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{k.label}</div>
                          <div className="text-sm font-bold text-white">{k.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Licenciés list */}
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="px-3 py-1.5 text-[9px] font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)' }}>
                        LICENCIÉS RÉCENTS
                      </div>
                      {[
                        { init: 'SM', name: 'Sophie M.', brevet: 'B', licence: true, medical: true },
                        { init: 'TB', name: 'Thomas B.', brevet: 'A', licence: true, medical: false },
                        { init: 'CD', name: 'Claire D.', brevet: 'C', licence: true, medical: true },
                        { init: 'LM', name: 'Lucas M.', brevet: 'B', licence: false, medical: true },
                      ].map((p, i) => (
                        <div key={p.init} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0" style={{ background: '#2563EB' }}>{p.init}</div>
                          <span className="text-[10px] font-semibold text-white flex-1">{p.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold mr-1" style={{ background: 'rgba(37,99,235,0.2)', color: '#60A5FA' }}>Brevet {p.brevet}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: p.licence ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: p.licence ? '#10B981' : '#EF4444' }}>
                            {p.licence ? '✓' : '✗'} Lic.
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold ml-1" style={{ background: p.medical ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: p.medical ? '#10B981' : '#EF4444' }}>
                            {p.medical ? '✓' : '✗'} Méd.
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 text-center text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  Tableau de bord réel du centre
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION OCR — IMPORT IA CARNET PAPIER ──────────────────────── */}
      <SectionOCR />

      {/* ─── SECTION D — TÉMOIGNAGES + SOCIAL PROOF ─────────────────────── */}
      <section className="py-20" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2" style={{ color: '#0F172A' }}>Ils testent ParaPass en bêta</h2>
            <p className="text-sm" style={{ color: '#94A3B8' }}>Avis de nos premiers bêta testeurs · Rejoignez-les gratuitement</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              {
                stars: 5,
                quote: 'ParaPass a révolutionné la gestion de mon carnet. Mon moniteur valide mes sauts en quelques secondes.',
                name: 'Jean-Luc Moreau',
                meta: 'Brevet B · Centre de Saintes',
                init: 'JL', color: '#2563EB',
              },
              {
                stars: 5,
                quote: 'En tant que DT, je vois en temps réel si mes élèves sont en règle. Plus jamais de surprise lors des contrôles DGAC.',
                name: 'Johnny Guerin',
                meta: 'Directeur Technique · BigAir Rochefort',
                init: 'JG', color: '#F59E0B',
              },
              {
                stars: 5,
                quote: 'J\'ai perdu mon carnet papier 3 fois. Avec ParaPass, tout est sauvegardé. Je recommande à tous les parachutistes.',
                name: 'Sophie M.',
                meta: 'Brevet B · Gap-Tallard',
                init: 'SM', color: '#10B981',
              },
              {
                stars: 5,
                quote: 'La section progression est incroyable. Je vois exactement sur quoi travailler après chaque saut. Mon moniteur me note et je progresse deux fois plus vite.',
                name: 'Thomas R.',
                meta: 'Brevet A · Royan Atlantique',
                init: 'TR', color: '#EA580C',
              },
            ].map(t => (
              <div key={t.name} className="bg-white rounded-2xl p-7 flex flex-col" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)', border: '1px solid #E2E8F0' }}>
                <div className="flex gap-0.5 mb-4">
                  {'★★★★★'.slice(0, t.stars * 1).split('').map((s, i) => (
                    <span key={i} className="text-yellow-400">{s}</span>
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed flex-1 mb-5" style={{ color: '#374151' }}>"{t.quote}"</blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: t.color }}>{t.init}</div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: '#0F172A' }}>{t.name}</div>
                    <div className="text-xs" style={{ color: '#64748B' }}>{t.meta}</div>
                    <div className="text-[10px] mt-0.5 font-medium" style={{ color: '#94A3B8' }}>Avis bêta testeur</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats — marché cible honnête */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '60 000', suffix: '', label: 'Licenciés FFP en France', note: 'marché cible' },
              { value: '57', suffix: '', label: 'Centres agréés FFP', note: 'marché cible' },
              { value: '505 000', suffix: '', label: 'Sauts pratiqués/an', note: 'source FFP' },
              { value: '4,9', suffix: '/5', label: 'Note bêta testeurs', note: 'bêta interne' },
            ].map(s => (
              <div key={s.label} className="text-center bg-white rounded-2xl py-8 px-4" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0' }}>
                <div className="text-3xl font-extrabold mb-1" style={{ color: '#001A4D' }}>{s.value}{s.suffix}</div>
                <div className="text-sm font-medium" style={{ color: '#374151' }}>{s.label}</div>
                <div className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FONCTIONNALITÉS CARDS ──────────────────────────────────────────── */}
      <section className="py-16" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { icon: <AltitudeIcon className="w-16 h-16 text-blue-500" />, title: 'Hauteur de largage', desc: 'Enregistrez chaque altitude' },
              { icon: <Wind className="w-8 h-8 text-sky-500" />, title: 'Conditions météo', desc: 'Observations du jour' },
              { icon: <Target className="w-8 h-8 text-green-500" />, title: 'Catégories DGAC', desc: 'OA, OC, OR classées auto' },
              { icon: <Trophy className="w-8 h-8 text-amber-500" />, title: 'Badges & jalons', desc: 'Votre progression valorisée' },
            ].map(item => (
              <div key={item.title} className="step-card rounded-xl p-5 bg-white border border-gray-100 hover:border-blue-200">
                <div className="mb-3">{item.icon}</div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: '#001A4D' }}>{item.title}</h3>
                <p className="text-xs" style={{ color: '#64748B' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CENTRES DE CONFIANCE ───────────────────────────────────────────── */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-medium mb-4 uppercase tracking-wider" style={{ color: '#94A3B8' }}>Bêta ouverte</p>
          <p className="text-2xl font-bold mb-3" style={{ color: '#001A4D' }}>Conçu pour les 60 000 licenciés et les 57 centres agréés FFP de France</p>
          <p className="text-sm max-w-md mx-auto" style={{ color: '#64748B' }}>ParaPass est conçu pour les 60 000 licenciés et les 57 centres agréés FFP de France. Rejoignez la bêta et participez à la digitalisation officielle du carnet de sauts.</p>
        </div>
      </section>

      {/* ─── TARIFS ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: '#001A4D' }}>Tarifs simples et transparents</h2>
            <p style={{ color: '#64748B' }}>Gratuit pour les parachutistes · À partir de 49€ pour les centres · Sans engagement</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">

            {/* Colonne 1 — Parachutiste */}
            <div className="rounded-2xl border border-gray-200 p-7 flex flex-col bg-white">
              <div className="mb-1">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  Pour les parachutistes
                </span>
              </div>
              <div className="mt-4 mb-2">
                <div className="text-4xl font-extrabold" style={{ color: '#001A4D' }}>Gratuit</div>
                <div className="text-sm font-medium mt-0.5" style={{ color: '#10B981' }}>Pour toujours</div>
              </div>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: '#64748B' }}>
                Votre carnet numérique officiel, accessible partout, même sans connexion.
              </p>
              <ul className="space-y-2.5 flex-1 mb-7">
                {[
                  'Carnet de sauts certifié DGAC',
                  'QR code de vérification instantané',
                  'Alertes expiration licence et médical',
                  'Suivi de progression personnalisé',
                  'Export PDF certifié',
                  'Communauté et messagerie',
                  'Météo dropzone personnalisée',
                  'Badges et jalons',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#0F172A' }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="w-full text-center py-2.5 rounded-lg text-sm font-semibold no-underline transition-all text-white"
                style={{ background: '#003082' }}
              >
                Créer mon compte gratuit →
              </Link>
            </div>

            {/* Colonne 2 — Centre (mise en avant) */}
            <div
              className="rounded-2xl p-7 flex flex-col relative"
              style={{
                border: '2px solid #F97316',
                background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 60%)',
                boxShadow: '0 4px 24px rgba(249,115,22,0.15)',
              }}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap" style={{ background: '#F97316' }}>
                Le plus populaire
              </div>
              <div className="mb-1 mt-1">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                  Pour les centres agréés
                </span>
              </div>
              <div className="mt-4 mb-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold" style={{ color: '#001A4D' }}>À partir de 49€</span>
                </div>
                <div className="text-sm font-medium mt-0.5" style={{ color: '#64748B' }}>HT / mois · Sans engagement</div>
                <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>Tarif adapté à la taille de votre centre · De 49€ à 199€/mois</div>
              </div>
              <p className="text-sm mb-5 mt-3 leading-relaxed" style={{ color: '#374151' }}>
                Gérez tous vos licenciés, validez les sauts, suivez les conformités réglementaires.
              </p>
              <ul className="space-y-2.5 flex-1 mb-4">
                {[
                  'Tableau de bord centre complet',
                  'Gestion illimitée de vos licenciés',
                  'Validation sauts par moniteurs délégués',
                  'Alertes licences et certificats médicaux',
                  'Messagerie avec vos parachutistes',
                  'Statistiques et rapports de sauts',
                  'Suivi progression de vos licenciés',
                  'Planning DZ avec météo intégrée',
                  'API partenaires (AfiFly, PeakTime…)',
                  'Support prioritaire',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#0F172A' }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F97316' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Grille de tarifs discrète */}
              <div className="mb-3 rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                {[
                  { label: 'Starter', detail: '< 500 licenciés', price: '49€' },
                  { label: 'Essentiel', detail: '500 – 1 500', price: '99€' },
                  { label: 'Pro', detail: '1 500 – 2 500', price: '149€' },
                  { label: 'Premium', detail: '> 2 500', price: '199€' },
                ].map((tier, i) => (
                  <div
                    key={tier.label}
                    className="flex items-center justify-between px-3 py-1.5"
                    style={{
                      borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                      fontSize: '11px',
                    }}
                  >
                    <span className="font-semibold" style={{ color: '#374151' }}>{tier.label}</span>
                    <span style={{ color: '#94A3B8' }}>{tier.detail}</span>
                    <span className="font-bold" style={{ color: '#374151' }}>{tier.price}/mois</span>
                  </div>
                ))}
              </div>
              <div className="mb-4 text-center">
                <span className="text-[11px]" style={{ color: '#94A3B8' }}>Comment est calculé mon tarif ? </span>
                <a href="/inscription-centre" className="text-[11px] font-semibold no-underline" style={{ color: '#F97316' }}>Voir les détails →</a>
              </div>

              <Link
                to="/inscription-centre"
                className="w-full text-center py-3 rounded-lg text-sm font-bold no-underline transition-all text-white"
                style={{ background: '#F97316', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}
              >
                Inscrire mon centre — Essai 30j gratuit →
              </Link>
              <p className="text-center text-[11px] mt-2" style={{ color: '#94A3B8' }}>
                Sans engagement · Annulation en 1 clic · Aucune CB requise
              </p>
            </div>

            {/* Colonne 3 — Renouvellement licence */}
            <div className="rounded-2xl border border-gray-200 p-7 flex flex-col bg-white">
              <div className="mb-1">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                  Service optionnel
                </span>
              </div>
              <div className="mt-4 mb-1">
                <div className="text-4xl font-extrabold" style={{ color: '#001A4D' }}>4,99€</div>
                <div className="text-sm font-medium mt-0.5" style={{ color: '#64748B' }}>par renouvellement · Une seule fois/an</div>
              </div>
              <p className="text-sm mb-6 mt-3 leading-relaxed" style={{ color: '#64748B' }}>
                Renouvelez votre licence FFP en 1 clic depuis ParaPass. On s'occupe de tout.
              </p>
              <ul className="space-y-2.5 flex-1 mb-6">
                {[
                  'Renouvellement assisté licence FFP',
                  'Pré-remplissage automatique du dossier',
                  'Confirmation par email',
                  'Mise à jour instantanée dans ParaPass',
                  'Assistance en cas de problème',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#0F172A' }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-center gap-1.5 mb-4 py-2 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <span className="text-sm">🔒</span>
                <span className="text-xs font-medium" style={{ color: '#64748B' }}>Paiement sécurisé Stripe</span>
              </div>
              <Link
                to="/register"
                className="w-full text-center py-2.5 rounded-lg text-sm font-semibold no-underline border transition-colors"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
              >
                En savoir plus →
              </Link>
              <p className="text-center text-[11px] mt-2.5" style={{ color: '#94A3B8' }}>
                Paiement unique · Disponible depuis votre espace
              </p>
            </div>
          </div>

          {/* Bandeau de réassurance */}
          <div
            className="mt-10 max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-5 rounded-xl"
            style={{ background: '#F8F9FA', border: '1px solid #E2E8F0' }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider mr-2" style={{ color: '#94A3B8' }}>Marché cible :</span>
            {[
              { icon: '🎯', text: '57 centres agréés FFP' },
              { icon: '🪂', text: '60 000 licenciés' },
              { icon: '📋', text: '505 000 sauts/an en France' },
              { icon: '🔒', text: 'RGPD · Données en France' },
              { icon: '⭐', text: 'Essai 30j sans CB' },
            ].map((item, i) => (
              <span key={item.text} className="flex items-center gap-1.5 text-[13px]" style={{ color: '#6B7280' }}>
                {i > 0 && <span className="hidden sm:inline mr-2" style={{ color: '#D1D5DB' }}>·</span>}
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ──────────────────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden text-center" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <ParachuteIcon className="absolute top-6 left-[8%] w-24 h-24 text-white" />
          <ParachuteDropIcon className="absolute bottom-8 right-[12%] w-20 h-20 text-white" />
          <ParachuteIcon className="absolute top-10 right-[38%] w-14 h-14 text-white" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ParachuteIcon className="w-16 h-16 mx-auto mb-6 demo-card" style={{ color: '#60A5FA', animation: 'float 4s ease-in-out infinite' } as React.CSSProperties} />
          <h2
            className="font-extrabold text-white mb-5"
            style={{ fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '-0.02em' }}
          >
            Prêt à digitaliser votre carnet ?
          </h2>
          <p className="mb-10 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.72)', fontSize: '18px', lineHeight: 1.65 }}>
            Rejoignez les parachutistes qui ne risquent plus jamais de perdre leur carnet. Gratuit, certifié, accessible partout.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link
              to="/register"
              className="hero-btn-primary inline-flex items-center justify-center gap-2 text-white font-semibold no-underline"
              style={{
                background: '#F97316',
                padding: '16px 32px',
                fontSize: '16px',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
              }}
            >
              Créer mon compte gratuit
            </Link>
            <Link
              to="/inscription-centre"
              className="hero-btn-primary inline-flex items-center justify-center gap-2 text-white font-semibold no-underline"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                padding: '16px 32px',
                fontSize: '16px',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
              }}
            >
              Inscrire mon centre
            </Link>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Pas de carte bancaire requise · Résiliation en 1 clic · Données hébergées en Europe 🇪🇺
          </p>
        </div>
      </section>


      {/* ─── PARTENAIRE FFP ─────────────────────────────────────────────────── */}
      <section style={{ background: '#002266', padding: '28px 24px' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-5 text-center sm:text-left">
          <a href="https://www.ffp.asso.fr" target="_blank" rel="noopener noreferrer" className="no-underline flex items-center gap-4 group">
            <img
              src="/logo-ffp-footer.png"
              alt="Logo FFP — Fédération Française de Parachutisme"
              style={{ height: '40px', width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.9, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.9')}
            />
            <div>
              <div className="text-sm font-semibold text-white">
                Application reconnue par la <strong>Fédération Française de Parachutisme</strong>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                En cours de déploiement dans les 57 clubs agréés FFP du réseau national
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="py-10" style={{ background: '#001540' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8 text-center sm:text-left">
            {/* Col gauche */}
            <div className="flex flex-col items-center sm:items-start gap-2">
              <ParaPassLogo mobile />
              <span className="text-xs" style={{ color: '#475569' }}>© 2026 ParaPass — Tous droits réservés</span>
            </div>
            {/* Col centre — FFP */}
            <div className="flex flex-col items-center gap-2">
              <a href="https://www.ffp.asso.fr" target="_blank" rel="noopener noreferrer" className="no-underline flex flex-col items-center gap-1.5 group">
                <img
                  src="/logo-ffp-footer.png"
                  alt="Logo FFP — Fédération Française de Parachutisme"
                  style={{ height: '40px', width: 'auto', opacity: 0.7, transition: 'opacity 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>En partenariat avec la Fédération Française de Parachutisme</span>
              </a>
            </div>
            {/* Col droite */}
            <div className="flex flex-col items-center sm:items-end gap-2">
              <div className="flex flex-wrap justify-center sm:justify-end gap-4 text-xs" style={{ color: '#475569' }}>
                <span className="hover:text-white/80 cursor-pointer transition-colors">Mentions légales</span>
                <span className="hover:text-white/80 cursor-pointer transition-colors">CGU</span>
                <a href="mailto:contact@parapass.fr" className="hover:text-white/80 transition-colors no-underline" style={{ color: '#475569' }}>Contact</a>
              </div>
              <span className="text-xs text-center sm:text-right" style={{ color: '#475569' }}>Conforme DGAC · RGPD · Données hébergées en France 🇫🇷</span>
            </div>
          </div>
          <div className="pt-6 border-t text-center text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#334155' }}>
            Hébergé en Europe · Chiffré AES-256 · Politique de confidentialité
          </div>
        </div>
      </footer>
    </div>
  );
}
