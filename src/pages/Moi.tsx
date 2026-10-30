import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3, TrendingUp, Award, Backpack, CalendarDays, Wallet, MessageSquare, Users, CheckCircle,
  Target, GraduationCap, ScanLine, BookOpen, User, Settings, LogOut, ChevronRight, Sun, Moon, Smartphone,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth, isDelegationActive } from '../lib/auth';
import { useConversations } from '../lib/useMessages';
import { useAlertesContext } from '../lib/AlertesContext';
import { useTheme, type PreferenceTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { QrScanner } from '../components/QrScanner';

// ═══════════════════════════════════════════════════════════════════════════
// « MOI » — le cinquième onglet, comme les Réglages d'un iPhone.
//
// Il remplace le menu latéral de treize entrées, l'avatar, le bouton de thème
// de l'en-tête et les « raccourcis » du bas de l'accueil. Tout ce qui n'est pas
// la journée, le carnet, l'ajout d'un saut ou le passeport vit ici, rangé en
// groupes : on le trouve en une fois, au même endroit, à chaque fois.
// ═══════════════════════════════════════════════════════════════════════════

type Ligne = {
  libelle: string; detail?: string; icone: React.ReactNode; teinte: string;
  vers?: string; onClick?: () => void; pastille?: number; danger?: boolean;
};

function Groupe({ titre, lignes }: { titre?: string; lignes: Ligne[] }) {
  return (
    <section className="mb-6">
      {titre && <h2 className="text-[13px] font-semibold uppercase tracking-wide px-4 mb-1.5" style={{ color: 'var(--c-muted)' }}>{titre}</h2>}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        {lignes.map((l, i) => {
          const contenu = (
            <>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style={{ background: l.teinte }}>{l.icone}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium" style={{ color: l.danger ? 'var(--sev-critique)' : 'var(--c-text)' }}>{l.libelle}</span>
                {l.detail && <span className="block text-[13px] truncate" style={{ color: 'var(--c-muted)' }}>{l.detail}</span>}
              </span>
              {l.pastille ? (
                <span className="text-xs font-bold text-white rounded-full px-1.5 min-w-[22px] text-center" style={{ lineHeight: '22px', background: 'var(--sev-critique)' }}>
                  {l.pastille > 99 ? '99+' : l.pastille}
                </span>
              ) : null}
              {!l.danger && <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />}
            </>
          );
          const style = { minHeight: 56, borderTop: i ? '1px solid var(--c-border-s)' : undefined } as const;
          return l.vers
            ? <Link key={l.libelle} to={l.vers} className="no-underline flex items-center gap-3 px-4" style={style}>{contenu}</Link>
            : <button key={l.libelle} type="button" onClick={l.onClick} className="w-full text-left flex items-center gap-3 px-4" style={style}>{contenu}</button>;
        })}
      </div>
    </section>
  );
}

const THEMES: { cle: PreferenceTheme; libelle: string; icone: React.ReactNode }[] = [
  { cle: 'auto', libelle: 'Comme le téléphone', icone: <Smartphone className="w-4 h-4" aria-hidden /> },
  { cle: 'light', libelle: 'Clair', icone: <Sun className="w-4 h-4" aria-hidden /> },
  { cle: 'dark', libelle: 'Sombre', icone: <Moon className="w-4 h-4" aria-hidden /> },
];

export function MoiPage() {
  const { user, profile, signOut, delegation, sautsEnAttente } = useAuth();
  const navigate = useNavigate();
  const { totalUnread } = useConversations(user?.id);
  const { statutDocs } = useAlertesContext();
  const { preference, setPreference } = useTheme();
  const [scanOpen, setScanOpen] = useState(false);
  // « Mon compte DZ » n'existe que si une DZ a la formule qui le propose.
  const [aCompteDz, setACompteDz] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('licencies_centres').select('centres(plan)').eq('parachutiste_id', user.id).eq('statut', 'actif')
      .then(({ data }) => setACompteDz(((data ?? []) as unknown as { centres: { plan: string | null } | null }[])
        .some(r => ['pro', 'enterprise'].includes(r.centres?.plan ?? ''))));
  }, [user?.id]);

  if (!profile) return null;
  const delegue = isDelegationActive(delegation) || profile.role === 'moniteur_delegue';
  const etat = statutDocs === 'valide' ? { t: 'En règle', c: 'var(--sev-conforme)' }
    : statutDocs === 'expire' ? { t: 'Document expiré', c: 'var(--sev-critique)' }
    : statutDocs === 'expire_bientot' ? { t: 'Document à renouveler', c: 'var(--sev-vigilance)' }
    : null;
  const photo = (profile as { avatar_url?: string | null }).avatar_url;

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        {/* Qui je suis : un toucher mène au profil. */}
        <Link to="/profil" className="no-underline flex items-center gap-4 rounded-2xl p-4 mb-6"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          {photo
            ? <img src={photo} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
            : <span className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ background: 'var(--accent-fond)' }}>
                {(profile.prenom?.[0] ?? '') + (profile.nom?.[0] ?? '')}
              </span>}
          <span className="flex-1 min-w-0">
            <span className="block text-xl font-bold truncate" style={{ color: 'var(--c-text)' }}>{profile.prenom} {profile.nom}</span>
            <span className="block text-[13px]" style={{ color: 'var(--c-muted)' }}>Profil, licence, coordonnées</span>
            {etat && <span className="inline-block mt-1 text-xs font-bold rounded-full px-2" style={{ lineHeight: '22px', color: etat.c, background: `color-mix(in srgb, ${etat.c} 14%, transparent)` }}>{etat.t}</span>}
          </span>
          <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />
        </Link>

        <Groupe titre="Mon parachutisme" lignes={[
          { libelle: 'Statistiques', icone: <BarChart3 className="w-4 h-4" />, teinte: '#2563EB', vers: '/stats' },
          { libelle: 'Progression', detail: 'Évaluations et éléments maîtrisés', icone: <TrendingUp className="w-4 h-4" />, teinte: '#7C3AED', vers: '/progression' },
          { libelle: 'Badges', icone: <Award className="w-4 h-4" />, teinte: '#C2410C', vers: '/badges' },
          { libelle: 'Matériel', detail: 'Voiles, secours, échéances', icone: <Backpack className="w-4 h-4" />, teinte: '#0E7490', vers: '/materiel' },
          { libelle: 'Planning de mes DZ', icone: <CalendarDays className="w-4 h-4" />, teinte: '#047857', vers: '/dashboard?tab=planning' },
          ...(aCompteDz ? [{ libelle: 'Mon compte DZ', icone: <Wallet className="w-4 h-4" />, teinte: '#475569', vers: '/dashboard?tab=compte' }] : []),
        ]} />

        <Groupe titre="Échanges" lignes={[
          { libelle: 'Messages', icone: <MessageSquare className="w-4 h-4" />, teinte: '#2563EB', vers: '/messages', pastille: totalUnread },
          { libelle: 'Communauté', icone: <Users className="w-4 h-4" />, teinte: '#DB2777', vers: '/communaute' },
          ...(delegue ? [{ libelle: 'Validations', detail: 'Sauts à signer', icone: <CheckCircle className="w-4 h-4" />, teinte: '#C2410C', vers: '/validations', pastille: sautsEnAttente }] : []),
        ]} />

        <Groupe titre="S'entraîner" lignes={[
          { libelle: 'Réflexe du jour', icone: <Target className="w-4 h-4" />, teinte: '#DC2626', vers: '/reflexe' },
          { libelle: 'Académie', detail: 'Quiz et révisions', icone: <GraduationCap className="w-4 h-4" />, teinte: '#7C3AED', vers: '/academie' },
          { libelle: 'Scanner un sac', detail: 'QR code de pliage', icone: <ScanLine className="w-4 h-4" />, teinte: '#475569', onClick: () => setScanOpen(true) },
          { libelle: 'Règles de sécurité', icone: <BookOpen className="w-4 h-4" />, teinte: '#0E7490', vers: '/regles-securite' },
        ]} />

        {/* L'apparence se choisit ici, une fois : elle quitte l'en-tête. */}
        <section className="mb-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide px-4 mb-1.5" style={{ color: 'var(--c-muted)' }}>Apparence</h2>
          <div role="radiogroup" aria-label="Apparence" className="grid grid-cols-3 gap-2">
            {THEMES.map(t => {
              const actif = preference === t.cle;
              return (
                <button key={t.cle} type="button" role="radio" aria-checked={actif} onClick={() => setPreference(t.cle)}
                  className="rounded-xl px-2 flex flex-col items-center justify-center gap-1 text-[13px] font-semibold"
                  style={{ minHeight: 64, background: actif ? 'color-mix(in srgb, var(--accent-texte) 14%, var(--c-card))' : 'var(--c-card)',
                           border: `1.5px solid ${actif ? 'var(--accent-texte)' : 'var(--c-border)'}`, color: actif ? 'var(--accent-texte)' : 'var(--c-text2)' }}>
                  {t.icone}{t.libelle}
                </button>
              );
            })}
          </div>
        </section>

        <Groupe lignes={[
          { libelle: 'Mon profil', icone: <User className="w-4 h-4" />, teinte: '#475569', vers: '/profil' },
          { libelle: 'Réglages', detail: 'Notifications, sécurité, compte', icone: <Settings className="w-4 h-4" />, teinte: '#475569', vers: '/parametres' },
        ]} />

        <Groupe lignes={[
          { libelle: 'Se déconnecter', icone: <LogOut className="w-4 h-4" />, teinte: 'var(--sev-critique)', danger: true,
            onClick: async () => { await signOut(); navigate('/'); } },
        ]} />
      </div>
      {scanOpen && <QrScanner onClose={() => setScanOpen(false)} />}
    </Layout>
  );
}
