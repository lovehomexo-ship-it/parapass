import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Check, ArrowRight, Camera, Flame, Zap, Clock,
  Brain, Pencil, Siren, Scroll, Wind, Target, PlaneLanding, Medal, Award,
  CreditCard, Smartphone, ClipboardList, TrendingUp, GraduationCap, CheckCircle2,
  Backpack, CalendarDays, BarChart3, Wrench, Users, Euro, Sparkles, Building2, AlertTriangle,
  ShieldCheck, PlayCircle } from 'lucide-react';
import { ParachuteGlyph } from '../design/BadgeIcon';
import { ModuleIcon } from '../design/academieIcons';

import { ParachuteIcon, ParachuteDropIcon } from '../components/ParachuteIcon';

import { DemoSelectModal } from '../components/DemoSelectModal';
import { SectionSecurite } from '../components/landing/SectionSecurite';
import { CardRecto, CardVerso, type PasseportData } from '../components/PasseportCardView';
import type { Licence, Brevet, CertificatMedical, CentreLicencie } from '../lib/types';
import { supabase } from '../lib/supabase';
import { MODULES, STUDIO, ECONOMIE_STUDIO } from '../data/modules';

// ─── Persona démo unique — utilisé partout sur la page ───────────────────────
// Les chiffres viennent de la licence réelle affichée dans l'application pour
// cette personne : 57 sauts, licence FFP-2021-08734, brevets A puis B. La page
// en annonçait 187 et un autre numéro — deux vérités pour la même personne.
const DEMO = {
  nom: 'MARTIN',
  prenom: 'Sophie',
  brevet: 'B',
  licence: 'FFP-2021-08734',
  sauts: 57,
  dz: 'BigAir Rochefort',
  codeClub: '0916',
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

/**
 * LA CARTE DE LA PAGE D'ACCUEIL EST CELLE DE L'APPLICATION.
 *
 * Elle était redessinée à la main ici, et elle avait dérivé : autre mise en
 * page, autres champs, un « Brevet B » écrit en toutes lettres dans une ligne
 * de texte, pas de ligne de validité colorée, pas de bénéficiaire. Le visiteur
 * voyait une carte que le produit ne fabrique pas.
 *
 * On monte maintenant `CardRecto` / `CardVerso`, les composants que le
 * passeport utilise, avec une personne fictive. La démonstration ne peut plus
 * mentir sur le produit : si la carte change, la page d'accueil change avec.
 */
const DEMO_PASSEPORT: PasseportData = {
  profile: {
    id: '00000000-0000-4000-8000-00000000d3m0',
    nom: DEMO.nom, prenom: DEMO.prenom,
    avatar_url: null, photo_profil_url: '/sophie-martin.webp',
    numero_licence: DEMO.licence,
    date_naissance: '1990-01-30', lieu_naissance: 'Paris',
    partage_carte_centre: true, signature_url: '/signature-demo.svg',
  },
  licences: [{
    id: 'demo-lic', parachutiste_id: '00000000-0000-4000-8000-00000000d3m0',
    numero_licence: DEMO.licence, date_delivrance: '2026-01-01',
    date_expiration: '2026-12-31', organisme: 'FFP', statut: 'actif',
    created_at: '2026-01-01', code_club: DEMO.codeClub, nom_club: DEMO.dz,
    beneficiaire_nom: 'Martin Pierre', beneficiaire_lien: 'parent',
    beneficiaire_telephone: null, assurance_individuelle: true, assurance_rc: true,
    tampon_dz_url: null, tampon_valide_par: null, tampon_date_validation: null,
    tampon_signature_url: null, tampon_statut: 'valide', type_licence: 'lp',
    tampon_snapshot_url: null,
  } as Licence],
  brevets: [
    { type_brevet: 'A', date_obtention: '2021-11-12' } as Brevet,
    { type_brevet: 'B', date_obtention: '2022-06-08' } as Brevet,
  ],
  certificats: [{ date_expiration: '2027-03-15' } as CertificatMedical],
  centresLicencies: [{ statut: 'actif', centre: { nom: DEMO.dz } } as unknown as CentreLicencie],
  qualifications: [],
  sautsCount: DEMO.sauts, validSautsCount: DEMO.sauts,
  // Le QR et la signature ne s'affichent au verso QUE si le jeton et la
  // signature existent — sans eux, le verso montrait deux cadres vides.
  qrToken: 'demo-sophie-martin', tamponConfig: null, centre: null,
  loadedAt: new Date(), dernierSautValide: null,
  dernierSautDate: new Date().toISOString().slice(0, 10),
  dernierControle: null,
};

function DemoPassportCard({ compact = false }: { compact?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const largeur = compact ? 340 : 420;
  // La page monte DEUX cartes — celle du bandeau et celle de la version
  // mobile. Un identifiant partagé en donnait deux avec le même `id` : tout
  // code qui en cherche une par son id tombait sur la mauvaise, invisible et
  // haute de zéro pixel. Chaque instance porte le sien.
  const cle = compact ? 'compacte' : 'principale';

  return (
    <div className="relative w-full" style={{ maxWidth: largeur, perspective: 1200 }}>
      <div
        className="relative w-full select-none cursor-pointer"
        onClick={() => setFlipped(f => !f)}
        // Pas de `filter` ICI : un filtre sur un ancêtre aplatit le contexte 3D
        // et le retournement ne se voit plus. L'ombre est posée sur les faces.
        style={{ transform: compact ? 'rotate(1deg)' : 'rotate(2deg)' }}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            position: 'relative',
          }}
        >
          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <CardRecto data={DEMO_PASSEPORT} id={`carte-demo-recto-${cle}`} />
          </div>
          <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            {/* `isOwner` : le verso ne montre la signature qu'à son titulaire.
                Ici la titulaire est fictive, et c'est SA carte qu'on montre. */}
            <CardVerso data={DEMO_PASSEPORT} id={`carte-demo-verso-${cle}`} isOwner />
          </div>
        </div>
      </div>
      <p className="text-center mt-2" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
        Données fictives · cliquez pour retourner la carte
      </p>
    </div>
  );
}

/**
 * LE LOGO DE LA PAGE D'ACCUEIL.
 *
 * La version précédente était posée sur une plaque blanche : le fichier fourni
 * n'avait pas de canal alpha, et sur le bleu marine de la page il affichait un
 * rectangle blanc autour du dessin. La plaque assumait ce blanc plutôt que de
 * le subir.
 *
 * Le fichier transparent est arrivé — WebP 1983 × 793 avec chunk ALPH, bit
 * alpha à 1 — donc la plaque n'a plus lieu d'être : le logo se pose
 * directement sur le fond, comme il devait le faire.
 */
function LogoParaPass({ hauteur = 64 }: { hauteur?: number }) {
  return (
    <img src="/logo-parapass.webp" alt="ParaPass"
      style={{ height: hauteur, width: 'auto', objectFit: 'contain', display: 'block', flexShrink: 0 }} />
  );
}

// ─── Section OCR — Import IA carnet papier ────────────────────────────────────

const OCR_STEPS = [
  { num: '01', icon: Camera, titre: 'Photographiez vos pages', desc: 'Prenez en photo toutes les pages de votre carnet en une fois. L\'IA s\'adapte à toutes les écritures.' },
  { num: '02', icon: Brain, titre: 'L\'IA analyse tout', desc: 'Dates, lieux, hauteurs, noms de moniteurs et programmes de saut — même en écriture cursive manuscrite.' },
  { num: '03', icon: Pencil, titre: 'Vous validez en 2 minutes', desc: 'Chaque saut extrait s\'affiche dans un formulaire éditable. Corrigez si besoin, cochez, importez.' },
  { num: '04', icon: CheckCircle2, titre: 'Votre historique est numérisé', desc: 'Les sauts importés reçoivent le statut "Historique · Déclaré sur l\'honneur" — archivés et horodatés.' },
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
              <Sparkles className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden /> Fonctionnalité différenciante
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
                    <step.icon className="w-6 h-6" />
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
                <Zap className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden /> Paiement unique
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
            <div className="flex-shrink-0 mt-2 sm:mt-0"><ModuleIcon id={STUDIO.id} label={STUDIO.nom} className="w-8 h-8" /></div>
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
                  <ModuleIcon id={mod.id} label={mod.nom} className="w-6 h-6" />
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
                      <span style={{ filter: 'grayscale(0.6)' }}><ModuleIcon id={mod.id} label={mod.nom} className="w-6 h-6" /></span>
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
  { icon: Siren, label: 'Sécurité & urgences', color: '#EF4444' },
  { icon: Scroll, label: 'Réglementation', color: '#3B82F6' },
  { icon: ParachuteGlyph, label: 'Matériel', color: '#F97316' },
  { icon: Wind, label: 'Météo & aérologie', color: '#0EA5E9' },
  { icon: Target, label: 'Pilotage sous voile', color: '#10B981' },
  { icon: PlaneLanding, label: 'Procédures DZ', color: '#8B5CF6' },
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
                      <t.icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug">{t.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              {[
                { icon: Zap, label: 'Système d\'XP', color: '#FBBF24' },
                { icon: Medal, label: 'Grades à débloquer', color: '#A78BFA' },
                { icon: Award, label: '11 badges Académie', color: '#34D399' },
              ].map(chip => (
                <span key={chip.label} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: chip.color, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <chip.icon className="w-4 h-4" /> {chip.label}
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
                    <GraduationCap className="w-5 h-5" aria-hidden />
                    <span className="text-xs font-bold text-white">Académie · Sécurité & urgences</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}><Zap className="w-3 h-3 inline-block mr-0.5 align-[-1px]" aria-hidden /> 1 240 XP</span>
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
                  { icon: Clock, bg: '#EF4444', title: 'Un scénario chronométré par jour', desc: 'Situation réelle, décision sous pression. Comme en l\'air.' },
                  { icon: Flame, bg: '#F97316', title: 'Série de jours consécutifs', desc: 'Votre streak grandit chaque jour. Ne cassez pas la chaîne.' },
                  { icon: Zap, bg: '#7C3AED', title: 'XP et bonus de rapidité', desc: 'Chaque bonne réponse alimente votre progression Académie.' },
                ].map(f => (
                  <li key={f.title} className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: f.bg }}>
                      <f.icon className="w-5 h-5 text-white" />
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
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#EF4444' }}><Zap className="w-3 h-3 inline-block mr-1 align-[-1px]" aria-hidden /> Réflexe du jour</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}><Siren className="w-3 h-3 inline-block mr-1 align-[-1px]" aria-hidden /> Sécurité & urgences</p>
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

  // LE COMPTEUR ANNONÇAIT 89 BÊTA TESTEURS POUR 47 PERSONNES RÉELLES.
  // Il comptait TOUS les profils : les comptes de démonstration, ceux des deux
  // centres fictifs, les comptes internes de ParaPass. Un chiffre gonflé de
  // moitié sur la page d'accueil, à côté d'une section qui se réclame de la
  // vérifiabilité — et devant un lecteur dont le métier est de recouper.
  // On ne compte plus que des personnes.
  useEffect(() => {
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('is_demo', 'is', true)
      .not('est_demo', 'is', true)
      .not('compte_interne', 'is', true)
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
            {/* Le logo de la page d'accueil : c'est la première chose qu'on
                voit, il a droit à sa place. */}
            <LogoParaPass hauteur={56} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 ml-3">
            <a href="#securite"
              className="hidden sm:inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium no-underline transition-colors whitespace-nowrap">
              Sécurité &amp; conformité
            </a>
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

              <p className="mb-6 leading-relaxed max-w-[480px]" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}>
                Carnet, licence, progression et sécurité — tout votre parachutisme dans une seule app.
                Gratuit pour les parachutistes.
              </p>

              {/* L'ARGUMENT QUI DISTINGUE, DES LE HAUT DE PAGE. Un carnet
                  numerique de plus n'interesse personne ; un carnet qui refuse
                  un embarquement non conforme, si. */}
              <a href="#securite"
                className="inline-flex items-start gap-2.5 mb-8 rounded-xl px-4 py-3 no-underline transition-colors"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', maxWidth: 480 }}>
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#6EE7B7' }} aria-hidden />
                <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                  <strong style={{ color: '#fff' }}>14 règles de sécurité opposables</strong> s’appliquent avant
                  l’embarquement — voilure, licence, médical, météo selon le niveau.
                  <span style={{ color: '#6EE7B7' }}> Voir le détail →</span>
                </span>
              </a>

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

              {/* La démonstration était un lien souligné, gris, sous les deux
                  boutons : c'est pourtant le seul endroit où l'on peut voir le
                  produit AVANT de donner son adresse. Elle mérite un bouton. */}
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="hero-btn-demo inline-flex items-center justify-center gap-2.5 font-semibold rounded-xl mb-7"
                style={{
                  color: '#BFDBFE', background: 'rgba(59,130,246,0.14)',
                  border: '1.5px solid rgba(147,197,253,0.45)',
                  padding: '13px 26px', fontSize: '15px', cursor: 'pointer',
                }}
              >
                <PlayCircle className="w-5 h-5 flex-shrink-0" aria-hidden />
                Essayer la démo — sans créer de compte
              </button>

              {/* Réassurance discrète */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: 500 }}>
                    {getBetaLabel(inscritCount)}
                  </p>
                </div>
                {/* « Conçu pour les licenciés et clubs FFP », sous un logo
                    fédéral, se lisait comme un produit de la fédération.
                    ParaPass est un outil indépendant : il le dit. */}
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                  Pour les parachutistes et les centres · Gratuit, sans carte bancaire
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
                icon: CreditCard,
                bg: '#EFF6FF',
                title: 'Créez votre profil',
                desc: 'Licence FFP, brevets, certificat médical, qualifs : tout au même endroit, en 5 minutes. Fini les documents éparpillés.',
              },
              {
                step: '02',
                icon: ParachuteGlyph,
                bg: '#FFFBEB',
                title: 'Enregistrez vos sauts',
                desc: 'Chaque saut s\'ajoute en quelques secondes, validé par votre moniteur d\'une signature horodatée. Un carnet qui grandit avec vous, sécurisé et horodaté.',
              },
              {
                step: '03',
                icon: Smartphone,
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
                  <item.icon className="w-6 h-6" />
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
                    <ParachuteGlyph className="w-9 h-9" style={{ color: '#2563EB' }} aria-hidden />
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(37,99,235,0.3)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.3)' }}>
                      Parachutiste · Gratuit
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-5">Tout votre parachutisme, en poche</h3>
                  <ul className="space-y-3 mb-8 flex-1">
                    {[
                      { icon: CreditCard, text: 'Carte numérique avec QR de vérification, même hors connexion' },
                      { icon: ClipboardList, text: 'Passeport complet : licence, médical, brevets — avec alertes d\'expiration' },
                      { icon: TrendingUp, text: 'Progression notée par votre moniteur sur 6 dimensions' },
                      { icon: GraduationCap, text: 'Académie + Réflexe du jour : la théorie et les bons réflexes, chaque jour' },
                      { icon: Award, text: '57 badges, stats, suivi matériel et communauté' },
                    ].map(f => (
                      <li key={f.text} className="flex items-start gap-3">
                        <span className="text-base w-5 flex-shrink-0"><f.icon className="w-5 h-5" /></span>
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
                    <Building2 className="w-9 h-9" style={{ color: '#F59E0B' }} aria-hidden />
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Centre / DZ · dès 49€ HT/mois
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-5" style={{ color: '#001A4D' }}>Pilotez votre dropzone en temps réel</h3>
                  <ul className="space-y-3 mb-8 flex-1">
                    {[
                      { icon: ClipboardList, text: 'Conformité de tous vos licenciés en un coup d\'œil' },
                      { icon: CheckCircle2, text: 'Validation des sauts par vos moniteurs — signature horodatée' },
                      { icon: Backpack, text: 'Modules Pliage (DT053, QR sacs) et Tandem (résas, bons cadeaux)' },
                      { icon: CalendarDays, text: 'Planning DZ avec météo intégrée' },
                      { icon: BarChart3, text: 'Statistiques, finances et rapports de sauts' },
                    ].map(f => (
                      <li key={f.text} className="flex items-start gap-3">
                        <span className="text-base w-5 flex-shrink-0"><f.icon className="w-5 h-5" /></span>
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
                  <Smartphone className="w-4 h-4 inline-block mr-1 align-[-3px]" aria-hidden /> Espace parachutiste
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
                      <img src="/logo-parapass.webp" alt="" aria-hidden className="h-6 w-auto" />
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
                    <AlertTriangle className="w-3 h-3 text-red-400" aria-hidden />
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
                      { num: 57, date: '22/06/2026', dz: 'BigAir Rochefort', alt: '4 000m', moniteur: 'Moniteur' },
                      { num: 56, date: '15/06/2026', dz: 'Saintes Parachutisme', alt: '3 500m', moniteur: 'Moniteur' },
                      { num: 55, date: '08/06/2026', dz: 'BigAir Rochefort', alt: '4 000m', moniteur: 'Moniteur' },
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
              { icon: BarChart3, title: 'Mes Stats', desc: 'Sauts par mois, altitudes, dropzones, paliers' },
              { icon: Wrench, title: 'Suivi Matériel', desc: 'Voile, secours, AAD, altimètre — alertes de révision' },
              { icon: Award, title: '57 badges', desc: 'Du commun au légendaire, chaque jalon compte' },
              { icon: Users, title: 'Communauté', desc: 'Abonnements, messagerie et centres' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="rounded-xl p-5 h-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-2xl mb-2"><f.icon className="w-5 h-5" /></div>
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
                  <Building2 className="w-4 h-4 inline-block mr-1 align-[-3px]" aria-hidden /> Espace centre / DZ
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
                      <img src="/logo-parapass.webp" alt="" aria-hidden className="h-6 w-auto" />
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
                        <AlertTriangle className="w-3 h-3 text-yellow-400" aria-hidden />
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
              { icon: Backpack, title: 'Module Pliage', desc: 'DT053, QR codes sacs, suivi plieurs et habilitations' },
              { icon: ParachuteGlyph, title: 'Module Tandem', desc: 'Planning, réservations, bons cadeaux, page publique' },
              { icon: Euro, title: 'Module Finances', desc: 'Suivi des encaissements et rapports' },
              { icon: CalendarDays, title: 'Planning DZ', desc: 'Journées de saut avec météo intégrée' },
            ].map((m, i) => (
              <Reveal key={m.title} delay={i * 60}>
                <div className="rounded-xl p-5 bg-white h-full" style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div className="text-2xl mb-2"><m.icon className="w-6 h-6" /></div>
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

      {/* ─── TÉMOIGNAGES — RETIRÉS ──────────────────────────────────────────
           Trois avis anonymes notés cinq étoiles, attribués à « un
           parachutiste bêta testeur » et « un directeur technique ». Rien ne
           permettait au lecteur de les vérifier, et la page s'adresse
           désormais aussi à des lecteurs dont le métier est précisément de
           vérifier. Un avis invérifiable coûte plus de crédit qu'il n'en
           apporte : la section attendra des retours nominatifs et datés.
           La preuve, en attendant, c'est la section Sécurité & conformité —
           elle, on peut la recouper texte par texte. */}

      {/* ─── SÉCURITÉ & CONFORMITÉ ──────────────────────────────────────────
           Placée AVANT les tarifs : on établit ce que l'outil garantit, et
           seulement ensuite ce qu'il coûte. C'est aussi la section vers
           laquelle pointe la navbar pour un directeur technique ou tout
           lecteur venu vérifier, et non chercher des badges. */}
      <SectionSecurite />

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
              {/* CE QUE CONTIENT LE SOCLE, ET CE QUI N'Y EST PAS.
                  La confusion coûte cher des deux côtés : un centre qui croit
                  l'avionnage compris, un commercial qui doit se dédire. On
                  écrit donc la frontière noir sur blanc. */}
              <p className="text-sm mb-4 mt-3 leading-relaxed" style={{ color: '#374151' }}>
                <strong>Le socle</strong> — licences, carnets de sauts et suivi de vos licenciés.
                Les modules métier s’ajoutent ensuite, à la carte.
              </p>
              <ul className="space-y-2.5 mb-4">
                {[
                  'Licences et certificats médicaux : échéances suivies, alertes automatiques',
                  'Carnets de sauts de tous vos licenciés, validation par moniteurs délégués',
                  'Tableau de bord conformité en temps réel',
                  'Attestation de carnet et export',
                  'Planning DZ, briefing du jour et météo par public',
                  'Journal de bord de la zone',
                  'Support prioritaire',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#0F172A' }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F97316' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* LES MODULES, ET LEUR PRIX. L'Avionnage est signale deux fois :
                  il est le seul a ne pas entrer dans le pack Studio, et c'est
                  exactement le point sur lequel un centre se trompe. */}
              <div className="mb-4 rounded-lg p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>
                  Modules complémentaires — en option
                </p>
                <div className="space-y-1">
                  {[
                    { n: 'Pliage',    p: '29,99 €', d: 'DT 53, QR sacs, plieurs habilités' },
                    { n: 'Academy',   p: '29,99 €', d: 'quiz sécurité, progression des brevets' },
                    { n: 'Tandem',    p: '19,99 €', d: 'réservations et marketplace' },
                    { n: 'Finances',  p: '19,99 €', d: 'encaissements et exports' },
                  ].map(m => (
                    <div key={m.n} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span style={{ color: '#0F172A' }}>
                        <strong>{m.n}</strong>{' '}
                        <span style={{ color: '#94A3B8' }}>· {m.d}</span>
                      </span>
                      <span className="font-semibold whitespace-nowrap" style={{ color: '#374151' }}>{m.p}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 pt-2.5 flex items-baseline justify-between gap-2 text-[12px]"
                  style={{ borderTop: '1px dashed #CBD5E1' }}>
                  <span style={{ color: '#0F172A' }}>
                    <strong>Avionnage</strong>{' '}
                    <span style={{ color: '#94A3B8' }}>· planches, file d’attente, largueur désigné</span>
                  </span>
                  <span className="font-semibold whitespace-nowrap" style={{ color: '#EA580C' }}>49,97 €</span>
                </div>
                <p className="text-[11px] mt-1.5 leading-snug" style={{ color: '#EA580C' }}>
                  Module à part : il n’est pas compris dans le socle, ni dans le pack Studio.
                </p>

                <div className="mt-2.5 pt-2.5 flex items-baseline justify-between gap-2 text-[12px]"
                  style={{ borderTop: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#0F172A' }}>
                    <strong>Pack Studio</strong>{' '}
                    <span style={{ color: '#94A3B8' }}>· Pliage + Academy + Tandem + Finances</span>
                  </span>
                  <span className="font-semibold whitespace-nowrap" style={{ color: '#2563EB' }}>49,99 €</span>
                </div>
              </div>

              {/* Paliers */}
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#64748B' }}>
                Socle — selon le nombre de licenciés
              </p>
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
              <LogoParaPass hauteur={44} />
              <span className="text-xs" style={{ color: '#475569' }}>© 2026 ParaPass — Tous droits réservés</span>
            </div>
            {/* LE LOGO FÉDÉRAL EST PARTI. Un logo officiel, cliquable vers le
                site de la fédération, sous la mention « conçu pour les clubs et
                licenciés FFP », se lit comme un partenariat. Il n'y en a pas.
                ParaPass s'appuie sur les textes fédéraux publics et le dit —
                c'est autre chose qu'être adoubé par la fédération. */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Outil indépendant, sans lien avec une fédération
              </span>
              <span className="text-xs text-center" style={{ color: '#475569' }}>
                Les règles de sécurité citent leurs sources officielles
              </span>
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
