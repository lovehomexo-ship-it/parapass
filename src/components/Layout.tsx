import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, isDelegationActive } from '../lib/auth';
import {
  Menu, X, LogOut, BookOpen, Bell, MessageSquare,
  Settings, User, Award, ChevronDown, CheckCircle, AlertTriangle,
  Sun, Moon, QrCode,
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useNotifications } from '../lib/useNotifications';
import { useConversations } from '../lib/useMessages';
import { useAlertesContext } from '../lib/AlertesContext';
import { enrichirAlerte } from './AlertsPanel';
import { DemoBanner, useGlobalDemo } from '../lib/DemoContext';
import { useTheme } from '../lib/ThemeContext';
import { DemoGate, getDemoAllowedRoutes } from './DemoGate';

export function Layout({ children, noPadding = false }: { children: React.ReactNode; noPadding?: boolean }) {
  const { user, profile, signOut, delegation, sautsEnAttente, isDemoAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markRead, dismiss, markAllRead } = useNotifications(user?.id);
  const { totalUnread: msgUnread } = useConversations(user?.id);
  const { alertes: alertesCtx, acquittees, acquitterAlertes } = useAlertesContext();
  const { isDemoMode } = useGlobalDemo();
  const { isDark, toggleTheme } = useTheme();

  const hasActiveDelegation = useMemo(() => isDelegationActive(delegation), [delegation]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    setDrawerOpen(false);
    await signOut();
    navigate('/');
  };

  const initials = profile
    ? `${profile.prenom?.[0] ?? ''}${profile.nom?.[0] ?? ''}`.toUpperCase()
    : '?';

  const isActive = (path: string) => location.pathname === path;

  const parachutisteItems = [
    { to: '/dashboard', label: 'Tableau de bord' },
    { to: '/passeport', label: 'Mon Passeport' },
    { to: '/stats', label: 'Mes Stats' },
    { to: '/progression', label: 'Ma Progression' },
    { to: '/materiel', label: 'Mon Matériel' },
    { to: '/badges', label: 'Badges' },
    { to: '/communaute', label: 'Communauté' },
  ];

  const navItems =
    profile?.role === 'parachutiste' || profile?.role === 'moniteur' || profile?.role === 'moniteur_delegue'
      ? [
          ...parachutisteItems,
          ...(hasActiveDelegation || profile?.role === 'moniteur_delegue'
            ? [{ to: '/validations', label: 'Validations', accent: true, badge: sautsEnAttente > 0 ? sautsEnAttente : 0 }]
            : []),
        ]
      : profile?.role === 'admin'
      ? [{ to: '/admin', label: 'Administration', accent: false, badge: 0 }]
      : [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>

      {/* ── Demo Banner ────────────────────────────────────────────────────── */}
      {isDemoMode && <DemoBanner />}
      {isDemoAccount && !isDemoMode && (
        <DemoBanner isCentre={profile?.role === 'admin_centre'} />
      )}

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'var(--c-nav)',
          borderBottom: '1px solid var(--c-border)',
          height: '56px',
          boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center gap-6">

          {/* Logo + FFP co-branding */}
          <Link to="/dashboard" className="no-underline flex items-center gap-3 flex-shrink-0">
            <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-8 w-auto object-contain" />
            <span style={{ width: '1px', height: '20px', background: 'var(--c-border-f)', display: 'inline-block', flexShrink: 0 }} />
            <img
              src="/logo-ffp-footer.png"
              alt="Fédération Française de Parachutisme"
              title="En partenariat avec la Fédération Française de Parachutisme"
              className="hidden md:block"
              style={{ height: '20px', width: 'auto', opacity: isDark ? 0.7 : 0.55 }}
            />
          </Link>

          {user && (
            <>
              {/* Desktop nav */}
              <nav className="hidden md:flex items-center flex-1">
                {navItems.map(({ to, label, accent, badge }) => {
                  const active = isActive(to);
                  const color = accent
                    ? active ? '#F97316' : 'rgba(249,115,22,0.75)'
                    : active ? 'var(--c-text)' : 'var(--c-muted)';
                  const demoAllowed = isDemoAccount ? getDemoAllowedRoutes(profile?.role) : null;
                  const isDemoBlocked = demoAllowed !== null && !demoAllowed.some((r) => to === r || to.startsWith(r + '/'));
                  return (
                    <Link
                      key={to}
                      to={to}
                      className="no-underline px-3 text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
                      style={{
                        color,
                        height: '56px',
                        fontSize: '14px',
                        borderBottom: active ? '2px solid #F97316' : '2px solid transparent',
                        ...(isDemoBlocked ? { opacity: 0.35, pointerEvents: 'none' } : {}),
                      }}
                      onMouseEnter={(e) => { if (!isDemoBlocked) (e.currentTarget as HTMLElement).style.color = accent ? '#FB923C' : 'var(--c-text)'; }}
                      onMouseLeave={(e) => { if (!isDemoBlocked) (e.currentTarget as HTMLElement).style.color = color; }}
                    >
                      {accent && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'inherit' }} />}
                      {label}
                      {badge != null && badge > 0 && (
                        <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Desktop right actions */}
              <div className="hidden md:flex items-center gap-1 ml-auto">
                {(profile?.role === 'parachutiste' || profile?.role === 'moniteur' || profile?.role === 'moniteur_delegue') && (
                  <>
                    <NavIconBtn to="/regles-ffp" title="Règles FFP"><BookOpen className="w-5 h-5" /></NavIconBtn>
                    <NavIconBtn to="/messages" title="Messages" badge={msgUnread}><MessageSquare className="w-5 h-5" /></NavIconBtn>
                  </>
                )}

                {/* Theme toggle */}
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => { setNotifOpen((o) => !o); setDropdownOpen(false); }}
                    className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
                    style={{ color: 'var(--c-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-muted)')}
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {(unreadCount + alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id)).length) > 0 && (
                      <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {Math.min(9, unreadCount + alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id)).length) === 9 ? '9+' : unreadCount + alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id)).length}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <NotifPanel
                      notifications={notifications}
                      unreadCount={unreadCount}
                      onMarkRead={markRead}
                      onDismiss={dismiss}
                      onMarkAllRead={markAllRead}
                      onClose={() => setNotifOpen(false)}
                      alertesCritiques={alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id))}
                      onAcquitter={acquitterAlertes}
                    />
                  )}
                </div>

                {/* Avatar + dropdown */}
                <div className="relative ml-2" ref={dropdownRef}>
                  <button
                    onClick={() => { setDropdownOpen((o) => !o); setNotifOpen(false); }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--c-text)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: '#F97316', border: '2px solid rgba(249,115,22,0.5)' }}
                    >
                      {initials}
                    </div>
                    <ChevronDown className="w-3 h-3" style={{ color: 'var(--c-muted)' }} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl z-50 overflow-hidden"
                      style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border-f)' }}>
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{profile?.prenom} {profile?.nom}</p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--c-muted)' }}>{profile?.role?.replace('_', ' ')}</p>
                      </div>
                      <div className="py-1">
                        <NavDropdownLink to="/profil" icon={<User className="w-4 h-4" />} onClick={() => setDropdownOpen(false)}>Mon Profil</NavDropdownLink>
                        {(profile?.role === 'parachutiste' || profile?.role === 'moniteur' || profile?.role === 'moniteur_delegue') && (
                          <NavDropdownLink to="/badges" icon={<Award className="w-4 h-4" />} onClick={() => setDropdownOpen(false)}>Mes Badges</NavDropdownLink>
                        )}
                        <NavDropdownLink to="/parametres" icon={<Settings className="w-4 h-4" />} onClick={() => setDropdownOpen(false)}>Paramètres</NavDropdownLink>
                      </div>
                      <div className="py-1" style={{ borderTop: '1px solid var(--c-border)' }}>
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                          style={{ color: '#F87171' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <LogOut className="w-4 h-4" />
                          Déconnexion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile right */}
              <div className="flex md:hidden items-center gap-1 ml-auto">
                {hasActiveDelegation && sautsEnAttente > 0 && (
                  <Link
                    to="/validations"
                    className="relative w-9 h-9 flex items-center justify-center no-underline"
                    style={{ color: '#F97316' }}
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {sautsEnAttente > 9 ? '9+' : sautsEnAttente}
                    </span>
                  </Link>
                )}
                {/* Mobile theme toggle */}
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen((o) => !o)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-lg"
                    style={{ color: 'var(--c-muted)' }}
                  >
                    <Bell className="w-5 h-5" />
                    {(unreadCount + alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id)).length) > 0 && (
                      <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {Math.min(9, unreadCount + alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id)).length) === 9 ? '9+' : unreadCount + alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id)).length}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <NotifPanel
                      notifications={notifications}
                      unreadCount={unreadCount}
                      onMarkRead={markRead}
                      onDismiss={dismiss}
                      onMarkAllRead={markAllRead}
                      onClose={() => setNotifOpen(false)}
                      alertesCritiques={alertesCtx.filter((a) => a.urgence === 'critique' && !acquittees.includes(a.id))}
                      onAcquitter={acquitterAlertes}
                    />
                  )}
                </div>
                <div
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: '#F97316', border: '2px solid rgba(249,115,22,0.5)' }}
                >
                  {initials}
                </div>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg ml-0.5"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Mobile Drawer ───────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div
            className="absolute right-0 top-0 bottom-0 w-72 flex flex-col"
            style={{ background: 'var(--c-nav)', borderLeft: '1px solid var(--c-border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: '1px solid var(--c-border)' }}
            >
              <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-7 w-auto object-contain" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--c-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className="px-4 py-4"
              style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: '#F97316', border: '2px solid rgba(249,115,22,0.4)' }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{profile?.prenom} {profile?.nom}</p>
                  <p className="text-xs capitalize" style={{ color: 'var(--c-muted)' }}>
                    {profile?.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map(({ to, label, accent, badge }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg no-underline transition-colors"
                    style={{
                      color: accent
                        ? active ? '#F97316' : 'rgba(249,115,22,0.85)'
                        : active ? 'var(--c-text)' : 'var(--c-muted)',
                      background: active ? 'rgba(249,115,22,0.08)' : 'transparent',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {accent && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                    {label}
                    {badge != null && badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              <div style={{ borderTop: '1px solid var(--c-border)', margin: '8px 0' }} />

              {(profile?.role === 'parachutiste' || profile?.role === 'moniteur' || profile?.role === 'moniteur_delegue') && (
                <>
                  <DrawerExtra to="/qr-code" onClick={() => setDrawerOpen(false)} active={isActive('/qr-code')}>
                    <QrCode className="w-4 h-4" /> Mon QR Code
                  </DrawerExtra>
                  <DrawerExtra to="/messages" onClick={() => setDrawerOpen(false)} active={isActive('/messages')}>
                    <MessageSquare className="w-4 h-4" /> Messages
                    {msgUnread > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{msgUnread}</span>
                    )}
                  </DrawerExtra>
                  <DrawerExtra to="/regles-ffp" onClick={() => setDrawerOpen(false)} active={isActive('/regles-ffp')}>
                    <BookOpen className="w-4 h-4" /> Règles FFP
                  </DrawerExtra>
                </>
              )}
              <DrawerExtra to="/profil" onClick={() => setDrawerOpen(false)} active={isActive('/profil')}>
                <User className="w-4 h-4" /> Mon Profil
              </DrawerExtra>
            </nav>

            <div className="px-3 py-4" style={{ borderTop: '1px solid var(--c-border)' }}>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-colors"
                style={{ color: '#F87171' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className={noPadding ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}>
        <DemoGate>{children}</DemoGate>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--c-nav)', borderTop: '1px solid var(--c-border-s)', padding: '16px 24px' }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 items-center gap-3 text-center" style={{ color: 'var(--c-muted)', fontSize: '11px' }}>
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-5 w-auto opacity-50" />
            <span>© 2026 ParaPass</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <a href="https://ffp.asso.fr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 no-underline hover:opacity-80 transition-opacity">
              <img src="/logo-ffp-footer.png" alt="FFP" style={{ height: '28px', width: 'auto', opacity: 0.6 }} />
            </a>
            <span className="hidden sm:inline">En partenariat avec la FFP</span>
          </div>
          <div className="flex items-center justify-center sm:justify-end">
            <span>Conforme DGAC · RGPD · Hébergé en France</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── ThemeToggle ───────────────────────────────────────────────────────────────

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
      style={{ color: 'var(--c-muted)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-text)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-muted)')}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function NavIconBtn({
  to, title, badge, children,
}: {
  to: string; title: string; badge?: number; children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      title={title}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors no-underline"
      style={{ color: 'var(--c-muted)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-text)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-muted)')}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

function DrawerExtra({
  to, onClick, active, children,
}: {
  to: string; onClick: () => void; active: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg no-underline transition-colors"
      style={{
        color: active ? 'var(--c-text)' : 'var(--c-muted)',
        background: active ? 'var(--c-hover)' : 'transparent',
      }}
    >
      {children}
    </Link>
  );
}

function NavDropdownLink({
  to, icon, onClick, children,
}: {
  to: string; icon: React.ReactNode; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm no-underline transition-colors"
      style={{ color: 'var(--c-text2)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: 'var(--c-muted)' }}>{icon}</span>
      {children}
    </Link>
  );
}

// ─── Keep legacy exports for backwards compat ──────────────────────────────────
export function DarkIconLink({
  to, title, badge, children,
}: {
  to: string; title: string; badge?: number; children: React.ReactNode;
}) {
  return <NavIconBtn to={to} title={title} badge={badge}>{children}</NavIconBtn>;
}

interface Notif {
  id: string;
  titre: string;
  message: string;
  lue: boolean;
  created_at: string;
  type?: string;
  lien?: string;
}

import type { Alerte } from '../lib/types';

function notifIcon(type: string | undefined): string {
  switch (type) {
    case 'creneau_ouvert':
    case 'creneau_modifie':
    case 'creneau_annule': return '📅';
    case 'saut_valide': return '✅';
    case 'saut_refuse': return '❌';
    case 'saut_a_valider':
    case 'validation_demandee': return '🪂';
    case 'nouveau_message': return '💬';
    case 'nouveau_abonne':
    case 'demande_suivi': return '👤';
    case 'delegation_accordee': return '🔑';
    case 'licence_expire':
    case 'medical_expire': return '⚠️';
    default: return '🔔';
  }
}

function notifRoute(type: string | undefined): string {
  switch (type) {
    case 'creneau_ouvert':
    case 'creneau_annule':
    case 'creneau_modifie': return '/dashboard';
    case 'saut_valide':
    case 'saut_refuse': return '/dashboard';
    case 'saut_a_valider':
    case 'validation_demandee': return '/validations';
    case 'nouveau_message': return '/messages';
    case 'nouveau_abonne':
    case 'demande_suivi': return '/communaute';
    case 'delegation_accordee': return '/validations';
    case 'licence_expire':
    case 'medical_expire': return '/passeport';
    default: return '';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${days}j`;
}

function NotifPanel({
  notifications, unreadCount, onMarkRead, onDismiss, onMarkAllRead, onClose, alertesCritiques = [], onAcquitter,
}: {
  notifications: Notif[];
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onClose: () => void;
  alertesCritiques?: Alerte[];
  onAcquitter?: (ids: string[]) => void;
}) {
  const navigate = useNavigate();

  const handleClick = async (notif: Notif) => {
    if (!notif.lue) await onMarkRead(notif.id);
    const route = notif.lien || notifRoute(notif.type);
    if (route) navigate(route);
    onClose();
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onMarkAllRead();
    setTimeout(onClose, 250);
  };

  // NotifPanel stays dark in both themes — it's a floating overlay
  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Notifications</span>
          {(unreadCount + alertesCritiques.length) > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
              {unreadCount + alertesCritiques.length}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-medium transition-colors"
            style={{ color: '#F59E0B' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FBBF24')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#F59E0B')}
          >
            Tout lire
          </button>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {/* Alertes critiques */}
        {alertesCritiques.length > 0 && (
          <div className="px-3 pt-3 pb-1 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: '#F87171' }}>Alertes critiques</p>
            {alertesCritiques.map((a) => {
              const enriched = enrichirAlerte(a);
              return (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-red-300">{a.titre}</p>
                    <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{a.message}</p>
                    <button
                      onClick={() => { navigate(enriched.lien); onClose(); }}
                      className="text-xs font-medium mt-1 hover:underline"
                      style={{ color: '#F87171' }}
                    >
                      {enriched.action} →
                    </button>
                  </div>
                  {onAcquitter && (
                    <button
                      onClick={() => onAcquitter([a.id])}
                      className="flex-shrink-0 p-0.5 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                      title="Acquitter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Standard notifications */}
        {notifications.length === 0 && alertesCritiques.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune notification</div>
        ) : notifications.length === 0 ? null : (
          <>
            {alertesCritiques.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-wider px-4 pt-3 pb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Historique</p>
            )}
            {notifications.slice(0, 20).map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: !notif.lue ? 'rgba(255,255,255,0.04)' : 'transparent',
                  opacity: notif.lue ? 0.55 : 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = !notif.lue ? 'rgba(255,255,255,0.04)' : 'transparent')}
              >
                <div className="flex-shrink-0 mt-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: !notif.lue ? '#F59E0B' : 'transparent' }} />
                </div>
                <span className="flex-shrink-0 text-base mt-0.5">{notifIcon(notif.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug" style={{ color: !notif.lue ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: !notif.lue ? 600 : 400 }}>
                    {notif.titre}
                  </p>
                  {notif.message && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {notif.message}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {timeAgo(notif.created_at)}
                  </p>
                </div>
                {!notif.lue && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(notif.id); }}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all mt-0.5"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
                    title="Acquitter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
