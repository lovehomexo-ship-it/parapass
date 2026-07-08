import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Check, ArrowRight, Camera, Flame, Zap, Clock } from 'lucide-react';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { ParachuteIcon, ParachuteDropIcon } from '../components/ParachuteIcon';
import { QRCodeSVG } from 'qrcode.react';
import { DemoSelectModal } from '../components/DemoSelectModal';
import { supabase } from '../lib/supabase';
import { MODULES, STUDIO, ECONOMIE_STUDIO } from '../data/modules';

// ─── Persona démo unique — utilisé partout sur la page ───────────────────────
const DEMO = {
  nom: 'MARTIN',
  prenom: 'Sophie',
  brevet: 'B',
  licence: 'FFP-2024-8801',
  sauts: 187,
  dz: 'BigAir Rochefort',
  licenceValide: '31/12/2026',
  medicalValide: '15/03/2027',
  noteProgression: '4,2',
};

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

// ─── Reveal — apparition douce au scroll ─────────────────────────────────────

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(18px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── AnimatedCounter ─────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const { ref, inView } = useInView();
  // Initialisé à la valeur cible pour éviter le flash « 0 » avant le déclenchement
  const [val, setVal] = useState(target);
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

  return (
    <div className={`relative w-full ${size}`} style={{ perspective: 1200 }}>
    <div
      className={`demo-card-wrapper relative w-full select-none cursor-pointer`}
      style={{ minHeight: compact ? 260 : 320 }}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        className="demo-card-inner w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          minHeight: compact ? 260 : 320,
          position: 'relative',
        }}
      >
        {/* ── FACE AVANT ── */}
        <div
          className="demo-card absolute inset-0 rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #001A4D 0%, #0f1a30 60%, #1E3A5F 100%)',
            filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.5))',
            transform: compact ? 'rotate(1deg)' : 'rotate(2deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
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
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: '#F97316' }}>CARNET DE SAUTS NUMÉRIQUE</div>
                </div>
              </div>
              <div style={{ background: '#10B981', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: 20 }}>ACTIF</div>
            </div>

            {/* Identity */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 overflow-hidden" style={{ width: compact ? 58 : 76, height: compact ? 58 : 76, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}>
                <img src="/sophie-martin.png" alt="Photo de profil de la carte démo" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: compact ? 18 : 22, fontWeight: 800, letterSpacing: '0.04em', color: '#fff', lineHeight: 1.1, textTransform: 'uppercase' }}>{DEMO.nom}</div>
                <div style={{ fontSize: compact ? 14 : 16, fontWeight: 400, color: '#fff', lineHeight: 1.2 }}>{DEMO.prenom}</div>
                <div style={{ fontSize: 11, color: '#F97316', marginTop: 1 }}>Fédération Française de Parachutisme</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Né(e) le 30/01/1990 à Paris</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 3, lineHeight: 1.4 }}>{DEMO.licence} · Code Club 0916 · Brevet {DEMO.brevet}</div>
              </div>
            </div>

            {/* Data grid */}
            <div className="grid gap-x-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              {[['Validité licence', DEMO.licenceValide], ['Cert. méd.', DEMO.medicalValide], ['Sauts totaux', String(DEMO.sauts)]].map(([label, val]) => (
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
                <span style={{ fontSize: 9, background: 'rgba(16,185,129,0.18)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>✓ Documents à jour</span>
              </div>
              <div className="bg-white rounded-lg flex-shrink-0" style={{ padding: 3 }}>
                <QRCodeSVG value="https://parapass.fr/verify/demo" size={54} level="M" fgColor="#001A4D" bgColor="#FFFFFF" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5, marginTop: 1 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>parapass.fr</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>↺ retourner</div>
            </div>
          </div>
        </div>

        {/* ── FACE ARRIÈRE — mini dashboard ── */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0f1a30 0%, #001A4D 100%)',
            filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.5))',
            transform: compact ? 'rotateY(180deg) rotate(-1deg)' : 'rotateY(180deg) rotate(-2deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            padding: compact ? '12px' : '16px',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: '#F97316' }} />
          <div className="relative flex flex-col gap-3 h-full" style={{ minHeight: compact ? 236 : 296 }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 10, color: 'rgba(147,197,253,0.8)' }}>{DEMO.prenom} {DEMO.nom}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Mon carnet</div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                <span style={{ fontSize: 12 }}>⭐</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FB923C' }}>{DEMO.noteProgression}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>/5 moy.</span>
              </div>
            </div>

            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total sauts validés</div>
              <div className="flex items-end gap-2">
                <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{DEMO.sauts}</span>
                <span style={{ fontSize: 11, color: '#34D399', marginBottom: 2 }}>+5 ce mois</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Derniers sauts</div>
              <div className="space-y-1.5">
                {[
                  { date: '22/06/2026', lieu: 'BigAir Rochefort', h: '4 000 m' },
                  { date: '15/06/2026', lieu: 'Saintes Parachutisme', h: '3 500 m' },
                  { date: '08/06/2026', lieu: 'BigAir Rochefort', h: '4 000 m' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{s.lieu}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{s.date}</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(96,165,250,0.8)', fontFamily: 'monospace' }}>{s.h}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Licence FFP</span>
                <span style={{ fontSize: 9, color: '#34D399', fontWeight: 600 }}>Valide jusqu'au {DEMO.licenceValide}</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 999 }} />
              </div>
            </div>

            <div className="flex items-center justify-between mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Données démo</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>↺ retourner</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Section OCR — Import IA carnet papier ────────────────────────────────────

const OCR_STEPS = [
  { num: '01', icon: '📷', titre: 'Photographiez vos pages', desc: 'Prenez en photo toutes les pages de votre carnet en une fois. L\'IA s\'adapte à toutes les écritures.' },
  { num: '02', icon: '🧠', titre: 'L\'IA analyse tout', desc: 'Dates, lieux, hauteurs, noms de moniteurs et programmes de saut — même en écriture cursive manuscrite.' },
  { num: '03', icon: '✏️', titre: 'Vous validez en 2 minutes', desc: 'Chaque saut extrait s\'affiche dans un formulaire éditable. Corrigez si besoin, cochez, importez.' },
  { num: '04', icon: '✅', titre: 'Votre historique est numérisé', desc: 'Les sauts importés reçoivent le statut "Historique · Déclaré sur l\'honneur" — archivés et horodatés.' },
];

const OCR_FEATURES = [
  'Nombre de sauts illimité',
  'Toutes les pages de votre carnet',
  'Reconnaissance écriture manuscrite',
  'Validation manuelle incluse',
  'Statut "Historique · Déclaré sur l\'honneur"',
  'Paiement sécurisé Stripe',
];

function SectionOCR() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #070E1C 0%, #0A1628 40%, #0F2240 70%, #071529 100%)' }}>
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)', transform: 'translateY(-40%)' }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5" style={{ background: 'rgba(249,115,22,0.12)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.3)' }}>
              ✨ Fonctionnalité différenciante
            </div>
            <h2 className="font-extrabold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.02em' }}>
              Votre carnet papier, importé par l'IA
            </h2>
            <p className="max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '17px', lineHeight: 1.65 }}>
              50, 100, 500 sauts dans un carnet papier ? L'IA lit votre écriture manuscrite et importe tout votre historique.
            </p>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Steps */}
          <div className="flex flex-col gap-0">
            {OCR_STEPS.map((step, i) => (
              <div key={step.num} className="flex gap-5 relative">
                {i < OCR_STEPS.length - 1 && (
                  <div className="absolute left-5 top-10 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom, rgba(249,115,22,0.35), transparent)', height: 'calc(100% - 2.5rem)' }} />
                )}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
                    {step.icon}
                  </div>
                </div>
                <div className="pb-8">
                  <span className="text-[10px] font-bold tracking-widest uppercase mb-1 block" style={{ color: 'rgba(249,115,22,0.7)' }}>Étape {step.num}</span>
                  <h3 className="font-semibold text-white text-base mb-1.5">{step.titre}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Price card */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(249,115,22,0.1) 0%, transparent 60%)' }} />
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full mb-4" style={{ background: 'rgba(249,115,22,0.18)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.35)' }}>
                ⚡ Paiement unique
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <Camera className="w-7 h-7" style={{ color: '#F97316' }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Import IA complet</h3>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>Tous vos sauts passés · Aucune limite de pages · Une seule fois</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-black text-white" style={{ fontSize: 48, lineHeight: 1 }}>4,99</span>
                <span className="text-2xl font-bold text-white mb-1">€</span>
              </div>
              <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>paiement unique · pas d'abonnement</p>
              <ul className="space-y-2 mb-6">
                {OCR_FEATURES.map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(16,185,129,0.2)', color: '#34D399' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="flex items-center justify-center gap-2 w-full text-white font-bold py-3.5 rounded-xl transition-all no-underline"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 6px 20px rgba(249,115,22,0.4)', fontSize: 15 }}
              >
                <Camera className="w-4 h-4" />
                Importer mon carnet papier →
              </Link>
              <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Disponible depuis votre espace parachutiste · Connexion requise
              </p>
            </div>

            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Shield className="w-4 h-4" style={{ color: '#34D399' }} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: '#34D399' }}>Archivé et horodaté</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Les sauts importés reçoivent le statut "Déclaré sur l'honneur". Le carnet numérique complète votre carnet papier.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section Modules complémentaires ─────────────────────────────────────────

function SectionModules() {
  const [waitlistEmail, setWaitlistEmail] = useState<Record<string, string>>({});
  const [waitlistSent, setWaitlistSent] = useState<Set<string>>(new Set());
  const [waitlistOpen, setWaitlistOpen] = useState<string | null>(null);

  const handleWaitlist = async (moduleId: string) => {
    const email = (waitlistEmail[moduleId] ?? '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    void supabase; // placeholder jusqu'à la table public waitlist
    setWaitlistSent((s) => new Set([...s, moduleId]));
    setWaitlistOpen(null);
  };

  const liveModules = MODULES.filter((m) => m.status === 'live');
  const soonModules = MODULES.filter((m) => m.status === 'soon');

  return (
    <section className="py-20" style={{ background: '#F8FAFC' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3" style={{ color: '#001A4D' }}>
            Des modules pensés pour votre dropzone
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: '#64748B' }}>
            Activez uniquement ce dont vous avez besoin, en supplément de votre abonnement centre. Sans engagement.
          </p>
        </div>

        {/* Pack Studio */}
        <div className="mb-8 max-w-4xl mx-auto">
          <div
            className="relative rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-5"
            style={{ border: '2px solid #F97316', background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 70%)', boxShadow: '0 4px 24px rgba(249,115,22,0.12)' }}
          >
            <div className="absolute -top-3.5 left-6 px-3 py-1 rounded-full text-[11px] font-bold text-white" style={{ background: '#F97316' }}>
              Le plus avantageux
            </div>
            <div className="text-4xl flex-shrink-0 mt-2 sm:mt-0">{STUDIO.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg" style={{ color: '#001A4D' }}>{STUDIO.nom}</p>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: '#64748B' }}>{STUDIO.desc}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="text-xl font-extrabold" style={{ color: '#F97316' }}>
                  {STUDIO.prix?.toFixed(2).replace('.', ',')} €
                  <span className="text-sm font-normal text-gray-500"> /mois</span>
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                  Économisez ~{ECONOMIE_STUDIO}€/mois vs modules séparés
                </span>
              </div>
            </div>
            <Link
              to="/inscription-centre"
              className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white no-underline transition-all"
              style={{ background: '#F97316', boxShadow: '0 4px 12px rgba(249,115,22,0.3)', whiteSpace: 'nowrap' }}
            >
              En savoir plus →
            </Link>
          </div>
        </div>

        {/* Modules disponibles */}
        <div className="mb-4 max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#10B981' }}>
            ✓ Disponibles maintenant
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {liveModules.map((mod) => (
              <div key={mod.id} className="rounded-xl p-5 flex flex-col gap-3 bg-white" style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{mod.icon}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                    Disponible
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: '#001A4D' }}>{mod.nom}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748B' }}>{mod.desc}</p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-sm" style={{ color: '#001A4D' }}>
                    {mod.prix?.toFixed(2).replace('.', ',')} €
                    <span className="font-normal text-xs text-gray-400"> /mois</span>
                  </span>
                  <Link
                    to="/inscription-centre"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold no-underline transition-all"
                    style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)' }}
                  >
                    En savoir plus →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {soonModules.length > 0 && (
          <>
            <div className="max-w-4xl mx-auto my-8 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Prochainement</span>
              <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {soonModules.map((mod) => (
                  <div key={mod.id} className="rounded-xl p-3.5 flex flex-col gap-2" style={{ border: '1.5px solid #E2E8F0', background: '#F8FAFC', opacity: 0.85 }}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg" style={{ filter: 'grayscale(0.6)' }}>{mod.icon}</span>
                      <p className="font-semibold text-sm flex-1 truncate" style={{ color: '#334155' }}>{mod.nom}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                        Bientôt
                      </span>
                    </div>
                    <div>
                      {waitlistSent.has(mod.id) ? (
                        <div className="w-full py-1.5 rounded-lg text-xs font-semibold text-center"
                          style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                          ✓ Vous serez prévenu au lancement
                        </div>
                      ) : waitlistOpen === mod.id ? (
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="votre@email.fr"
                            value={waitlistEmail[mod.id] ?? ''}
                            onChange={(e) => setWaitlistEmail((w) => ({ ...w, [mod.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleWaitlist(mod.id)}
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                            style={{ border: '1px solid #CBD5E1', fontSize: 12 }}
                            autoFocus
                          />
                          <button onClick={() => handleWaitlist(mod.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0" style={{ background: '#2563EB' }}>
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setWaitlistOpen(mod.id)}
                          className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
                        >
                          Être prévenu →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs mt-10 max-w-xl mx-auto" style={{ color: '#94A3B8' }}>
          Les modules sont optionnels et indépendants de votre abonnement de base.
        </p>
      </div>
    </section>
  );
}

// ─── Section Académie ─────────────────────────────────────────────────────────

const ACADEMIE_THEMES = [
  { icon: '🆘', label: 'Sécurité & urgences', color: '#EF4444' },
  { icon: '📜', label: 'Réglementation', color: '#3B82F6' },
  { icon: '🪂', label: 'Matériel', color: '#F97316' },
  { icon: '🌬️', label: 'Météo & aérologie', color: '#0EA5E9' },
  { icon: '🎯', label: 'Pilotage sous voile', color: '#10B981' },
  { icon: '🛬', label: 'Procédures DZ', color: '#8B5CF6' },
];

function SectionAcademie() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #0F172A 0%, #131B33 50%, #0F172A 100%)' }}>
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', transform: 'translateY(-40%)' }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5" style={{ background: 'rgba(124,58,237,0.15)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.35)' }}>
              🎓 ParaPass Académie · Inclus gratuitement
            </div>
            <h2 className="font-extrabold text-white mb-4" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.02em' }}>
              Révisez la théorie comme un jeu
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '17px', lineHeight: 1.65 }}>
              Quiz gamifié sur 6 thèmes essentiels. Gagnez de l'XP, montez en grade, débloquez 11 badges de progression.
            </p>
          </div>
        </Reveal>

        <div className="flex flex-col lg:flex-row gap-12 lg:items-center">
          {/* Thèmes */}
          <div className="lg:w-[55%]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ACADEMIE_THEMES.map((t, i) => (
                <Reveal key={t.label} delay={i * 60}>
                  <div
                    className="rounded-2xl p-5 h-full"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.color}30` }}
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-3" style={{ background: `${t.color}18`, border: `1px solid ${t.color}35` }}>
                      {t.icon}
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug">{t.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              {[
                { icon: <Zap className="w-3.5 h-3.5" />, label: 'Système d\'XP', color: '#FBBF24' },
                { icon: '🎖️', label: 'Grades à débloquer', color: '#A78BFA' },
                { icon: '🏅', label: '11 badges Académie', color: '#34D399' },
              ].map(chip => (
                <span key={chip.label} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: chip.color, border: '1px solid rgba(255,255,255,0.1)' }}>
                  {chip.icon} {chip.label}
                </span>
              ))}
            </div>
          </div>

          {/* Mockup quiz */}
          <div className="lg:w-[45%]">
            <Reveal delay={150}>
              <div className="rounded-2xl overflow-hidden max-w-sm mx-auto" style={{ background: '#131B33', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 56px rgba(0,0,0,0.45)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎓</span>
                    <span className="text-xs font-bold text-white">Académie · Sécurité & urgences</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>⚡ 1 240 XP</span>
                </div>
                <div className="p-4">
                  <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#F87171' }}>Question 3 / 10</p>
                    <p className="text-sm font-bold text-white leading-snug">À quelle hauteur minimale devez-vous décider d'une procédure de secours ?</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { txt: '450 m', ok: false },
                      { txt: '600 m', ok: true },
                      { txt: '300 m', ok: false },
                    ].map((r, i) => (
                      <div key={i} className="rounded-lg px-3 py-2.5 text-xs font-medium flex items-center justify-between"
                        style={{
                          background: r.ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                          border: r.ok ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(255,255,255,0.07)',
                          color: r.ok ? '#6EE7B7' : 'rgba(255,255,255,0.75)',
                        }}>
                        {r.txt}
                        {r.ok && <span className="font-bold">✓ +20 XP</span>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <span className="text-[10px] font-semibold" style={{ color: '#A78BFA' }}>Grade actuel</span>
                    <span className="text-xs font-bold text-white">🎖️ Confirmé · niveau 4</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-xl no-underline hero-btn-primary"
            style={{ background: '#7C3AED', boxShadow: '0 8px 24px rgba(124,58,237,0.4)', fontSize: 16 }}
          >
            Créer mon compte gratuit
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Section Réflexe du jour ──────────────────────────────────────────────────

function SectionReflexe() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row-reverse gap-12 lg:items-center">

          {/* Texte */}
          <div className="lg:w-[50%]">
            <Reveal>
              <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)' }}>
                🔴 Réflexe de sécurité du jour · Inclus gratuitement
              </div>
              <h2 className="font-extrabold mb-5" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                30 secondes par jour pour garder les bons réflexes
              </h2>
              <p className="mb-8 leading-relaxed" style={{ color: '#64748B', fontSize: '17px', lineHeight: 1.65 }}>
                Un scénario, une décision, chaque jour. Le bon réflexe se travaille — entretenez votre série.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  { icon: <Clock className="w-4 h-4 text-white" />, bg: '#EF4444', title: 'Un scénario chronométré par jour', desc: 'Situation réelle, décision sous pression. Comme en l\'air.' },
                  { icon: <Flame className="w-4 h-4 text-white" />, bg: '#F97316', title: 'Série de jours consécutifs', desc: 'Votre streak grandit chaque jour. Ne cassez pas la chaîne.' },
                  { icon: <Zap className="w-4 h-4 text-white" />, bg: '#7C3AED', title: 'XP et bonus de rapidité', desc: 'Chaque bonne réponse alimente votre progression Académie.' },
                ].map(f => (
                  <li key={f.title} className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: f.bg }}>
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold mb-0.5" style={{ color: '#0F172A' }}>{f.title}</p>
                      <p className="text-sm" style={{ color: '#64748B' }}>{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 text-white font-bold px-7 py-3.5 rounded-xl no-underline hero-btn-primary"
                style={{ background: '#EF4444', boxShadow: '0 8px 24px rgba(239,68,68,0.3)', fontSize: 15 }}
              >
                Commencer mon premier réflexe
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Reveal>
          </div>

          {/* Mockup drill */}
          <div className="lg:w-[50%]">
            <Reveal delay={120}>
              <div className="rounded-2xl overflow-hidden max-w-sm mx-auto" style={{ background: '#0F172A', boxShadow: '0 24px 56px rgba(15,23,42,0.35)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#EF4444' }}>🔴 Réflexe du jour</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>🆘 Sécurité & urgences</p>
                  </div>
                  {/* Timer ring */}
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg width={48} height={48} viewBox="0 0 48 48" className="absolute rotate-[-90deg]">
                      <circle cx={24} cy={24} r={19} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
                      <circle cx={24} cy={24} r={19} fill="none" stroke="#10B981" strokeWidth={4} strokeDasharray={119.4} strokeDashoffset={119.4 * 0.35} />
                    </svg>
                    <span className="text-sm font-bold" style={{ color: '#10B981' }}>13</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <p className="text-sm font-bold text-white leading-snug">
                      Ouverture : torsades sur les suspentes, la voile vole droit. Que faites-vous ?
                    </p>
                  </div>
                  <div className="space-y-2">
                    {['Je libère immédiatement', 'Je détorsade en écartant les élévateurs', 'J\'attends sans agir'].map((r, i) => (
                      <div key={i} className="rounded-lg px-3 py-2.5 text-xs font-medium flex items-center gap-2"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)', color: '#94A3B8' }}>{String.fromCharCode(65 + i)}</span>
                        {r}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-full px-4 py-2 mx-auto w-fit" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
                    <Flame className="w-4 h-4" style={{ color: '#F97316' }} />
                    <span className="text-sm font-bold" style={{ color: '#F97316' }}>12 jours de suite</span>
                  </div>
                  <p className="text-center text-[9px] mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>Une seule tentative par jour · Données démo</p>
                </div>
              </div>
            </Reveal>
          </div>
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
    if (n === null || n < 50) return 'Bêta ouverte · Soyez parmi les premiers';
    if (n < 200) return `${n}+ bêta testeurs · Rejoignez-les`;
    return `${n}+ parachutistes inscrits`;
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {showDemoModal && <DemoSelectModal onClose={() => setShowDemoModal(false)} />}

      {/* ── Animations CSS ── */}
      <style>{`
        @keyframes particle-float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-12px) translateX(4px); }
          66% { transform: translateY(6px) translateX(-4px); }
        }
        .demo-card-wrapper {
          animation: float-card 5s ease-in-out infinite;
        }
        @keyframes float-card {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        .demo-card-wrapper:hover { animation-play-state: paused; }
        .particle { animation: particle-float linear infinite; }
        .step-card { transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; }
        .step-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); border-color: #2563EB; }
        .hero-btn-primary { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .hero-btn-primary:hover { transform: translateY(-2px); }
        .hero-btn-secondary { transition: background 0.2s ease, border-color 0.2s ease; }
        .hero-btn-secondary:hover { background: rgba(255,255,255,0.15) !important; border-color: rgba(255,255,255,0.5) !important; }
        @media (prefers-reduced-motion: reduce) {
          .demo-card-wrapper { animation: none !important; }
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
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <ParachuteIcon className="absolute top-10 left-[6%] w-96 h-96 text-white" />
          <ParachuteDropIcon className="absolute top-24 right-[10%] w-72 h-72 text-white" />
          <ParachuteIcon className="absolute bottom-12 right-[28%] w-60 h-60 text-white" />
        </div>
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
              style={{ background: '#F97316' }}
            >
              Créer mon compte gratuit
            </Link>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-28 sm:pt-16 sm:pb-36">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-10">

            {/* Left — text */}
            <div className="md:w-[55%] min-w-0 max-w-2xl">
              <h1
                className="font-extrabold text-white mb-6 leading-[1.08] tracking-tight"
                style={{ fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.02em' }}
              >
                Votre carnet de sauts.<br />
                <span style={{
                  background: 'linear-gradient(135deg, #2563EB, #60A5FA)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Numérique, vérifiable,<br />toujours sur vous.
                </span>
              </h1>

              <p className="mb-8 leading-relaxed max-w-[480px]" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}>
                Carnet, licence, progression et sécurité — tout votre parachutisme dans une seule app. Gratuit pour les parachutistes.
              </p>

              {/* Mobile card */}
              <div className="flex md:hidden justify-center mb-8">
                <DemoPassportCard compact />
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link
                  to="/register"
                  className="hero-btn-primary inline-flex items-center justify-center gap-2 text-white font-semibold no-underline rounded-xl"
                  style={{ background: '#F97316', padding: '14px 28px', fontSize: '16px', boxShadow: '0 8px 24px rgba(249,115,22,0.4)', borderRadius: '12px' }}
                >
                  Créer mon compte gratuit
                </Link>
                <Link
                  to="/inscription-centre"
                  className="hero-btn-secondary inline-flex items-center justify-center gap-2 text-white font-semibold rounded-xl border no-underline"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(10px)', padding: '14px 28px', fontSize: '16px', borderRadius: '12px' }}
                >
                  Inscrire mon centre
                </Link>
              </div>

              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="text-sm font-medium underline underline-offset-4 mb-7"
                style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Ou explorer la démo sans compte →
              </button>

              {/* Réassurance discrète */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: 500 }}>
                    {getBetaLabel(inscritCount)}
                  </p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                  Conçu pour les licenciés et clubs FFP · Gratuit, sans carte bancaire
                </p>
              </div>
            </div>

            {/* Right — card (desktop) */}
            <div className="hidden md:flex md:w-[45%] min-w-0 justify-center md:justify-end">
              <div className="relative" style={{ width: '420px', maxWidth: '100%', padding: '48px 40px 48px 24px' }}>
                <DemoPassportCard />
              </div>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="w-full h-20 fill-white" aria-hidden>
            <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z" />
          </svg>
        </div>
      </header>

      {/* ─── BARRE DE CHIFFRES ──────────────────────────────────────────────── */}
      <section className="py-10 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { target: 505576, suffix: '', label: 'sauts réalisés en France en 2024' },
              { target: 12000, prefix: '~', suffix: '', label: 'parachutistes licenciés' },
              { target: 57, suffix: '', label: 'centres agréés' },
              { target: 3, suffix: ' s', label: 'pour vérifier un QR code' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#001A4D' }}>
                  {s.prefix ?? ''}<AnimatedCounter target={s.target} suffix={s.suffix} />
                </p>
                <p className="text-xs sm:text-sm mt-1" style={{ color: '#64748B' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMMENT ÇA MARCHE ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3" style={{ color: '#001A4D' }}>Comment ça marche</h2>
              <p className="max-w-xl mx-auto" style={{ color: '#64748B' }}>
                De votre premier saut au millième, tout votre carnet dans une seule appli — et plus jamais de papier.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div
              className="hidden md:block absolute top-[56px] left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] pointer-events-none"
              style={{ borderTop: '2px dashed #E2E8F0', zIndex: 0 }}
            />
            {[
              {
                step: '01',
                icon: '🪪',
                bg: '#EFF6FF',
                title: 'Créez votre profil',
                desc: 'Licence FFP, brevets, certificat médical, qualifs : tout au même endroit, en 5 minutes. Fini les documents éparpillés.',
              },
              {
                step: '02',
                icon: '🪂',
                bg: '#FFFBEB',
                title: 'Enregistrez vos sauts',
                desc: 'Chaque saut s\'ajoute en quelques secondes, validé par votre moniteur d\'une signature horodatée. Un carnet qui grandit avec vous, sécurisé et horodaté.',
              },
              {
                step: '03',
                icon: '📱',
                bg: '#F0FDF4',
                title: 'Toujours prêt',
                desc: 'Votre carte licence toujours à jour, dans votre poche. Au renouvellement comme à l\'accueil d\'une nouvelle DZ : un QR code, vérifié en 3 secondes.',
              },
            ].map(item => (
              <div
                key={item.step}
                className="step-card relative bg-white rounded-2xl p-8 border overflow-hidden z-10"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
              >
                <div
                  className="absolute top-4 right-5 font-black select-none"
                  style={{ fontSize: '48px', lineHeight: 1, color: 'rgba(37,99,235,0.08)' }}
                  aria-hidden
                >
                  {item.step}
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-2xl" style={{ background: item.bg }}>
                  {item.icon}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: '#001A4D' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── UNE APP, DEUX EXPÉRIENCES ──────────────────────────────────────── */}
      <section className="py-20" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3" style={{ color: '#001A4D' }}>Une app, deux expériences</h2>
              <p className="max-w-lg mx-auto" style={{ color: '#64748B' }}>
                Parachutiste ou gestionnaire de centre, ParaPass s'adapte.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">

            {/* Parachutiste */}
            <Reveal>
              <div className="rounded-2xl p-8 sm:p-10 flex flex-col relative overflow-hidden h-full" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
                <div className="absolute -bottom-8 -right-8 opacity-[0.06] pointer-events-none">
                  <ParachuteIcon className="w-48 h-48 text-white" />
                </div>
                <div className="relative flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-4xl" aria-hidden>🪂</span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(37,99,235,0.3)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.3)' }}>
                      Parachutiste · Gratuit
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-5">Tout votre parachutisme, en poche</h3>
                  <ul className="space-y-3 mb-8 flex-1">
                    {[
                      { icon: '🪪', text: 'Carte numérique avec QR de vérification, même hors connexion' },
                      { icon: '📋', text: 'Passeport complet : licence, médical, brevets — avec alertes d\'expiration' },
                      { icon: '📈', text: 'Progression notée par votre moniteur sur 6 dimensions' },
                      { icon: '🎓', text: 'Académie + Réflexe du jour : la théorie et les bons réflexes, chaque jour' },
                      { icon: '🏅', text: '57 badges, stats, suivi matériel et communauté' },
                    ].map(f => (
                      <li key={f.text} className="flex items-start gap-3">
                        <span className="text-base w-5 flex-shrink-0">{f.icon}</span>
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.80)' }}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-xl no-underline transition-all text-sm text-white self-start"
                    style={{ background: '#F97316', boxShadow: '0 6px 20px rgba(249,115,22,0.35)' }}
                  >
                    Créer mon compte gratuit →
                  </Link>
                </div>
              </div>
            </Reveal>

            {/* Centre */}
            <Reveal delay={100}>
              <div className="rounded-2xl p-8 sm:p-10 flex flex-col relative overflow-hidden bg-white h-full" style={{ border: '2px solid #F59E0B' }}>
                <div className="absolute -bottom-8 -right-8 opacity-[0.04] pointer-events-none">
                  <ParachuteIcon className="w-48 h-48" style={{ color: '#F59E0B' } as React.CSSProperties} />
                </div>
                <div className="relative flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-4xl" aria-hidden>🏫</span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Centre / DZ · dès 49€ HT/mois
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-5" style={{ color: '#001A4D' }}>Pilotez votre dropzone en temps réel</h3>
                  <ul className="space-y-3 mb-8 flex-1">
                    {[
                      { icon: '📋', text: 'Conformité de tous vos licenciés en un coup d\'œil' },
                      { icon: '✅', text: 'Validation des sauts par vos moniteurs — signature horodatée' },
                      { icon: '🎒', text: 'Modules Pliage (DT053, QR sacs) et Tandem (résas, bons cadeaux)' },
                      { icon: '📅', text: 'Planning DZ avec météo intégrée' },
                      { icon: '📊', text: 'Statistiques, finances et rapports de sauts' },
                    ].map(f => (
                      <li key={f.text} className="flex items-start gap-3">
                        <span className="text-base w-5 flex-shrink-0">{f.icon}</span>
                        <span className="text-sm" style={{ color: '#374151' }}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/inscription-centre"
                    className="inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-xl no-underline transition-all text-sm text-white self-start"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)', boxShadow: '0 6px 20px rgba(245,158,11,0.3)' }}
                  >
                    Inscrire mon centre — Essai 30j →
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── PRODUIT PARACHUTISTE — MOCKUPS ─────────────────────────────────── */}
      <section className="py-24" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #002266 60%, #001A4D 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-14">

            {/* Text */}
            <div className="lg:w-[42%]">
              <Reveal>
                <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA', border: '1px solid rgba(37,99,235,0.3)' }}>
                  📱 Espace parachutiste
                </div>
                <h2 className="font-extrabold text-white mb-5 leading-tight" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', letterSpacing: '-0.02em' }}>
                  Votre tableau de bord, toujours à jour
                </h2>
                <p className="mb-7 leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)', fontSize: '17px', lineHeight: 1.65 }}>
                  Derniers sauts, progression, alertes documents : tout en un coup d'œil.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    `${DEMO.sauts} sauts validés, historique complet`,
                    `Note de progression : ${DEMO.noteProgression} / 5`,
                    `Licence valide jusqu'au ${DEMO.licenceValide}`,
                    'Alertes matériel : voile, secours, AAD, altimètre',
                    'Stats par mois, altitudes, dropzones et paliers',
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
                  className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl group hero-btn-primary"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #003082)', boxShadow: '0 6px 20px rgba(37,99,235,0.4)' }}
                >
                  Explorer la démo
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Reveal>
            </div>

            {/* Mockup dashboard */}
            <div className="lg:w-[58%]">
              <Reveal delay={120}>
                <div className="rounded-2xl overflow-hidden" style={{ background: '#0B1D3A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: '#071529', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <img src="/Logo_ParaPass.png" alt="" aria-hidden className="h-6 w-auto" />
                      <span className="text-xs font-semibold text-white">{DEMO.prenom} {DEMO.nom}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(249,115,22,0.2)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>DÉMO</span>
                    </div>
                    <div className="flex gap-1">
                      {['Passeport', 'Sauts', 'Stats', 'Badges'].map(t => (
                        <span key={t} className="text-[10px] px-2 py-1 rounded-md hidden sm:inline" style={{ color: 'rgba(255,255,255,0.45)' }}>{t}</span>
                      ))}
                      <span className="text-[10px] px-2 py-1 rounded-md text-white font-semibold" style={{ background: 'rgba(255,255,255,0.1)' }}>Tableau de bord</span>
                    </div>
                  </div>
                  {/* Hero card */}
                  <div className="mx-4 mt-3 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #0F2549 0%, #1a3a6e 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#2563EB', border: '2px solid rgba(249,115,22,0.5)', fontSize: '14px' }}>SM</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-sm uppercase tracking-wide">{DEMO.nom} {DEMO.prenom}</div>
                        <div className="text-[10px]" style={{ color: '#93C5FD' }}>Brevet {DEMO.brevet} · {DEMO.dz}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: '#F97316' }}>{DEMO.licence}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-extrabold text-white">{DEMO.sauts}</div>
                        <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>sauts validés</div>
                      </div>
                    </div>
                  </div>
                  {/* Alert */}
                  <div className="mx-4 mt-2 rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <span className="text-red-400 text-xs">⚠</span>
                    <span className="text-[10px] font-semibold text-red-400">Parachute de secours</span>
                    <span className="text-[10px] text-red-300 ml-1 truncate">— révision avant le 15/09/2026</span>
                  </div>
                  {/* KPI */}
                  <div className="grid grid-cols-3 gap-2 px-4 mt-2">
                    {[
                      { label: 'Total sauts', value: String(DEMO.sauts), sub: '+5 ce mois', accent: '#F97316' },
                      { label: 'Dernier saut', value: '22/06', sub: DEMO.dz, accent: '#60A5FA' },
                      { label: 'Progression', value: `${DEMO.noteProgression}/5`, sub: 'Tendance +', accent: '#10B981' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${s.accent}` }}>
                        <div className="text-[9px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</div>
                        <div className="text-base font-bold text-white">{s.value}</div>
                        <div className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                  {/* Progression 6 dimensions */}
                  <div className="mx-4 mt-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-semibold text-white">Note de progression — 6 dimensions</span>
                      <span className="text-[10px] font-bold" style={{ color: '#F97316' }}>{DEMO.noteProgression} / 5</span>
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
                      { num: 187, date: '22/06/2026', dz: 'BigAir Rochefort', alt: '4 000m', moniteur: 'Guérin J.' },
                      { num: 186, date: '15/06/2026', dz: 'Saintes Parachutisme', alt: '3 500m', moniteur: 'Moreau L.' },
                      { num: 185, date: '08/06/2026', dz: 'BigAir Rochefort', alt: '4 000m', moniteur: 'Leroy M.' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                        <div className="w-6 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#F97316', fontSize: '8px' }}>{s.num}</div>
                        <span className="text-[9px] font-mono w-14 flex-shrink-0 hidden sm:inline" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.date}</span>
                        <span className="text-[10px] flex-1 text-white font-medium truncate">{s.dz}</span>
                        <span className="text-[9px] hidden sm:inline" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.alt}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>✓ {s.moniteur}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-3 text-center text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Interface réelle de l'application · Données démo
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Rangée features complémentaires */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: '📊', title: 'Mes Stats', desc: 'Sauts par mois, altitudes, dropzones, paliers' },
              { icon: '🔧', title: 'Suivi Matériel', desc: 'Voile, secours, AAD, altimètre — alertes de révision' },
              { icon: '🏅', title: '57 badges', desc: 'Du commun au légendaire, chaque jalon compte' },
              { icon: '👥', title: 'Communauté', desc: 'Abonnements, messagerie et centres' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="rounded-xl p-5 h-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ACADÉMIE ───────────────────────────────────────────────────────── */}
      <SectionAcademie />

      {/* ─── RÉFLEXE DU JOUR ────────────────────────────────────────────────── */}
      <SectionReflexe />

      {/* ─── PRODUIT CENTRE / DZ ────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row-reverse lg:items-center gap-14">

            {/* Text */}
            <div className="lg:w-[42%]">
              <Reveal>
                <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.3)' }}>
                  🏫 Espace centre / DZ
                </div>
                <h2 className="font-extrabold mb-5 leading-tight" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', color: '#0F172A', letterSpacing: '-0.02em' }}>
                  Gérez votre dropzone comme un pro
                </h2>
                <p className="mb-7 leading-relaxed" style={{ color: '#64748B', fontSize: '17px', lineHeight: 1.65 }}>
                  Conformité de vos licenciés, validation des sauts, planning et modules métiers — un seul tableau de bord.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Conformité réglementaire en temps réel',
                    'Validation des sauts par délégation aux moniteurs',
                    'Alertes licences et médicaux expirés',
                    'Planning DZ avec météo intégrée',
                    'Essai gratuit 30 jours, sans carte bancaire',
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
                  className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl no-underline group mb-3 hero-btn-primary"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 6px 20px rgba(245,158,11,0.3)' }}
                >
                  Inscrire mon centre — Essai 30j gratuit
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="text-xs" style={{ color: '#94A3B8' }}>De 49€ à 199€ HT/mois selon la taille · Sans engagement</p>
              </Reveal>
            </div>

            {/* Mockup centre */}
            <div className="lg:w-[58%]">
              <Reveal delay={120}>
                <div className="rounded-2xl overflow-hidden" style={{ background: '#0B1D3A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: '#071529', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <img src="/Logo_ParaPass.png" alt="" aria-hidden className="h-6 w-auto" />
                      <span className="text-xs font-bold text-white">BigAir Rochefort</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-1 rounded-lg font-semibold" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>3 alertes</span>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: '#F59E0B' }}>JG</div>
                    </div>
                  </div>
                  <div className="flex" style={{ minHeight: '300px' }}>
                    <div className="w-28 flex-shrink-0 hidden sm:flex flex-col py-2 gap-0.5" style={{ background: '#0F2549', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                      {[
                        { label: 'Dashboard', active: true },
                        { label: 'Licenciés', active: false },
                        { label: 'Pliage', active: false },
                        { label: 'Tandem', active: false },
                        { label: 'Planning', active: false },
                        { label: 'Finances', active: false },
                      ].map(item => (
                        <div key={item.label} className="mx-2 px-2 py-1.5 rounded-lg text-[10px] font-medium" style={{
                          background: item.active ? 'rgba(37,99,235,0.2)' : 'transparent',
                          color: item.active ? '#60A5FA' : 'rgba(255,255,255,0.4)',
                          borderLeft: item.active ? '2px solid #2563EB' : '2px solid transparent',
                        }}>{item.label}</div>
                      ))}
                    </div>
                    <div className="flex-1 p-3 overflow-hidden">
                      <div className="rounded-lg px-3 py-2 flex items-center gap-2 mb-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <span className="text-yellow-400 text-xs">⚠</span>
                        <span className="text-[10px]" style={{ color: '#FCD34D' }}>3 licenciés nécessitent votre attention</span>
                        <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded text-white" style={{ background: '#F59E0B' }}>Voir →</span>
                      </div>
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
                            <span className="text-[10px] font-semibold text-white flex-1 truncate">{p.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold mr-1 hidden sm:inline" style={{ background: 'rgba(37,99,235,0.2)', color: '#60A5FA' }}>Brevet {p.brevet}</span>
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
                    Tableau de bord réel du centre · Données démo
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Modules en cartes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: '🎒', title: 'Module Pliage', desc: 'DT053, QR codes sacs, suivi plieurs et habilitations' },
              { icon: '🪂', title: 'Module Tandem', desc: 'Planning, réservations, bons cadeaux, page publique' },
              { icon: '💶', title: 'Module Finances', desc: 'Suivi des encaissements et rapports' },
              { icon: '📅', title: 'Planning DZ', desc: 'Journées de saut avec météo intégrée' },
            ].map((m, i) => (
              <Reveal key={m.title} delay={i * 60}>
                <div className="rounded-xl p-5 bg-white h-full" style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div className="text-2xl mb-2">{m.icon}</div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#001A4D' }}>{m.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── IMPORT IA CARNET PAPIER ────────────────────────────────────────── */}
      <SectionOCR />

      {/* ─── TÉMOIGNAGES ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#0F172A' }}>Ils testent ParaPass en bêta</h2>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Avis de nos premiers bêta testeurs · Rejoignez-les gratuitement</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'ParaPass a révolutionné la gestion de mon carnet. Mon moniteur valide mes sauts en quelques secondes.',
                name: 'Jean-Luc Moreau',
                meta: 'Brevet B · Centre de Saintes',
                init: 'JL', color: '#2563EB',
              },
              {
                quote: 'En tant que DT, je vois en temps réel si mes élèves sont en règle. Fini les vérifications de dernière minute avant l\'embarquement.',
                name: 'Johnny Guerin',
                meta: 'Directeur Technique · BigAir Rochefort',
                init: 'JG', color: '#F59E0B',
              },
              {
                quote: 'La section progression est incroyable. Mon moniteur me note après chaque saut et je vois exactement sur quoi travailler.',
                name: 'Thomas R.',
                meta: 'Brevet A · Royan Atlantique',
                init: 'TR', color: '#10B981',
              },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <div className="bg-white rounded-2xl p-7 flex flex-col h-full" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)', border: '1px solid #E2E8F0' }}>
                  <div className="flex gap-0.5 mb-4" aria-label="5 étoiles sur 5">
                    {[1,2,3,4,5].map(s => <span key={s} className="text-yellow-400">★</span>)}
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TARIFS ─────────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3" style={{ color: '#001A4D' }}>Tarifs simples et transparents</h2>
              <p style={{ color: '#64748B' }}>Gratuit pour les parachutistes · À partir de 49€ pour les centres · Sans engagement</p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-start">

            {/* Parachutiste */}
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
                Carnet, passeport, progression, Académie et Réflexe du jour. Tout inclus.
              </p>
              <ul className="space-y-2.5 flex-1 mb-7">
                {[
                  'Carte de sauts numérique avec QR de vérification',
                  'Passeport : licence, médical, brevets, alertes',
                  'Progression notée par le moniteur',
                  'Académie : quiz, XP, grades',
                  'Réflexe de sécurité du jour + streak',
                  'Stats, suivi matériel, 57 badges',
                  'Communauté et messagerie',
                  'Accessible hors connexion',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#0F172A' }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="w-full text-center py-3 rounded-lg text-sm font-semibold no-underline transition-all text-white"
                style={{ background: '#F97316', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}
              >
                Créer mon compte gratuit →
              </Link>
            </div>

            {/* Centre */}
            <div
              className="rounded-2xl p-7 flex flex-col"
              style={{ border: '2px solid #F97316', background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 60%)', boxShadow: '0 4px 24px rgba(249,115,22,0.15)' }}
            >
              <div className="mb-1">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                  Pour les centres / DZ
                </span>
              </div>
              <div className="mt-4 mb-1">
                <div className="text-4xl font-extrabold" style={{ color: '#001A4D' }}>Dès 49€</div>
                <div className="text-sm font-medium mt-0.5" style={{ color: '#64748B' }}>HT / mois · Sans engagement</div>
              </div>
              <p className="text-sm mb-5 mt-3 leading-relaxed" style={{ color: '#374151' }}>
                Conformité, validation des sauts, planning et statistiques. Modules Pliage, Tandem et Finances en option.
              </p>
              <ul className="space-y-2.5 mb-5">
                {[
                  'Tableau de bord conformité temps réel',
                  'Gestion illimitée de vos licenciés',
                  'Validation des sauts par moniteurs délégués',
                  'Planning DZ avec météo intégrée',
                  'Statistiques et rapports de sauts',
                  'Support prioritaire',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#0F172A' }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F97316' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Paliers */}
              <div className="mb-3 rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                {[
                  { label: 'Starter',   detail: '< 500 licenciés', price: '49€', reco: false },
                  { label: 'Essentiel', detail: '500 – 1 500',      price: '99€', reco: true },
                  { label: 'Pro',       detail: '1 500 – 2 500',    price: '149€', reco: false },
                  { label: 'Premium',   detail: '> 2 500',          price: '199€', reco: false },
                ].map((tier, i) => (
                  <div
                    key={tier.label}
                    className="flex items-center justify-between px-3 py-2"
                    style={{
                      borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                      fontSize: '11px',
                      background: tier.reco ? 'rgba(249,115,22,0.08)' : undefined,
                    }}
                  >
                    <span className="font-semibold flex items-center gap-1.5" style={{ color: '#374151' }}>
                      {tier.label}
                      {tier.reco && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: '#F97316' }}>Recommandé</span>}
                    </span>
                    <span style={{ color: '#94A3B8' }}>{tier.detail}</span>
                    <span className="font-bold" style={{ color: '#374151' }}>{tier.price}/mois</span>
                  </div>
                ))}
              </div>
              <p className="mb-4 text-center text-[11px]" style={{ color: '#94A3B8' }}>
                Import IA du carnet papier : 4,99€ en paiement unique côté parachutiste
              </p>

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
          </div>
        </div>
      </section>

      {/* ─── MODULES COMPLÉMENTAIRES ────────────────────────────────────────── */}
      <SectionModules />

      {/* ─── CTA FINAL ──────────────────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden text-center" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <ParachuteIcon className="absolute top-6 left-[8%] w-24 h-24 text-white" />
          <ParachuteDropIcon className="absolute bottom-8 right-[12%] w-20 h-20 text-white" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-extrabold text-white mb-5" style={{ fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '-0.02em' }}>
            Prêt à passer au numérique ?
          </h2>
          <p className="mb-10 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.72)', fontSize: '18px', lineHeight: 1.65 }}>
            Rejoignez les parachutistes qui ne risquent plus jamais de perdre leur carnet.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link
              to="/register"
              className="hero-btn-primary inline-flex items-center justify-center gap-2 text-white font-semibold no-underline"
              style={{ background: '#F97316', padding: '16px 32px', fontSize: '16px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(249,115,22,0.4)' }}
            >
              Créer mon compte gratuit
            </Link>
            <Link
              to="/inscription-centre"
              className="hero-btn-secondary inline-flex items-center justify-center gap-2 text-white font-semibold no-underline rounded-xl border"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '16px 32px', fontSize: '16px', borderRadius: '12px' }}
            >
              Inscrire mon centre
            </Link>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Pas de carte bancaire requise · Résiliation en 1 clic · Données hébergées en Europe 🇪🇺
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="py-10" style={{ background: '#001540' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8 text-center sm:text-left">
            <div className="flex flex-col items-center sm:items-start gap-2">
              <ParaPassLogo mobile />
              <span className="text-xs" style={{ color: '#475569' }}>© 2026 ParaPass — Tous droits réservés</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <a href="https://www.ffp.asso.fr" target="_blank" rel="noopener noreferrer" className="no-underline flex flex-col items-center gap-1.5">
                <img
                  src="/logo-ffp-footer.png"
                  alt="Logo de la Fédération Française de Parachutisme"
                  style={{ height: '40px', width: 'auto', opacity: 0.7 }}
                />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Conçu pour les clubs et licenciés FFP</span>
              </a>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-2">
              <div className="flex flex-wrap justify-center sm:justify-end gap-4 text-xs" style={{ color: '#475569' }}>
                <span className="hover:text-white/80 cursor-pointer transition-colors">Mentions légales</span>
                <span className="hover:text-white/80 cursor-pointer transition-colors">CGU</span>
                <a href="mailto:contact@parapass.fr" className="hover:text-white/80 transition-colors no-underline" style={{ color: '#475569' }}>Contact</a>
              </div>
              <span className="text-xs text-center sm:text-right" style={{ color: '#475569' }}>RGPD · Données hébergées en France 🇫🇷</span>
            </div>
          </div>
          <div className="pt-6 border-t text-center text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#334155' }}>
            Hébergé en Europe · Données chiffrées et horodatées · Politique de confidentialité
          </div>
          <div className="pt-4 text-center text-xs leading-relaxed" style={{ color: '#475569' }}>
            ParaPass est un service indépendant. Il n'est, à ce jour, ni affilié à la Fédération Française de Parachutisme, ni certifié par la DGAC. Le carnet numérique complète le carnet de sauts papier sans s'y substituer.
          </div>
        </div>
      </footer>
    </div>
  );
}
