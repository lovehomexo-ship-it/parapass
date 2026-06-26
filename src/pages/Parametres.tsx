import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useDemo } from '../lib/useDemo';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, Palette, Bell, Shield, User, Trash2,
  Maximize2, Minimize2, RefreshCw, Moon, Sun, ChevronRight,
} from 'lucide-react';
import type { Licence, Brevet } from '../lib/types';
import { TYPE_BREVET_LABELS } from '../lib/types';

function cleanLicence(num: string | null | undefined): string {
  if (!num) return '—';
  return num.replace(/[°\s]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)' }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--c-border-s)' }}>
        <span style={{ color: '#F97316' }}>{icon}</span>
        <h2 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm" style={{ color: 'var(--c-text2)' }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? '#F97316' : 'var(--c-hover)', border: '1px solid var(--c-border-f)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </label>
  );
}

export function ParametresPage() {
  const { user, profile } = useAuth();
  const { blockIfDemo } = useDemo();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [licence, setLicence] = useState<Licence | null>(null);
  const [brevet, setBrevet] = useState<Brevet | null>(null);
  const [totalSauts, setTotalSauts] = useState<number>(0);

  // Notification prefs — stored in profile.preferences
  const prefs = (profile?.preferences ?? {}) as Record<string, boolean>;
  const [notifLicence, setNotifLicence] = useState<boolean>(prefs.notif_licence !== false);
  const [notifMedical, setNotifMedical] = useState<boolean>(prefs.notif_medical !== false);
  const [notifValidation, setNotifValidation] = useState<boolean>(prefs.notif_validation !== false);
  const [savingNotif, setSavingNotif] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('qr_tokens').select('token').eq('parachutiste_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setToken(data.token);
        else supabase.from('qr_tokens').insert({ parachutiste_id: user.id }).select('token').single()
          .then(({ data: d }) => { if (d) setToken(d.token); });
      });
    supabase.from('licences').select('*').eq('parachutiste_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setLicence(data as Licence | null));
    supabase.from('brevets').select('*').eq('parachutiste_id', user.id).order('date_obtention', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setBrevet(data as Brevet | null));
    supabase.from('sauts').select('id', { count: 'exact', head: true }).eq('parachutiste_id', user.id)
      .then(({ count }) => setTotalSauts(count ?? 0));
  }, [user]);

  const regenerateToken = async () => {
    if (!user || blockIfDemo()) return;
    await supabase.from('qr_tokens').delete().eq('parachutiste_id', user.id);
    const { data } = await supabase.from('qr_tokens').insert({ parachutiste_id: user.id }).select('token').single();
    if (data) setToken(data.token);
  };

  const saveNotifPref = async (key: string, val: boolean) => {
    if (!user || blockIfDemo()) return;
    setSavingNotif(true);
    await supabase.from('profiles').update({
      preferences: { ...(prefs ?? {}), [key]: val },
    }).eq('id', user.id);
    setSavingNotif(false);
  };

  const qrUrl = token ? `${window.location.origin}/verify/${token}` : '';
  const brevetLabel = brevet ? (TYPE_BREVET_LABELS[brevet.type_brevet] ?? brevet.type_brevet) : null;

  if (!profile) return null;

  // QR fullscreen overlay
  if (fullscreen && token) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6" style={{ background: '#001A4D' }}>
        <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <Minimize2 className="w-6 h-6" />
        </button>
        <div className="bg-white rounded-2xl p-8 max-w-xs w-full text-center shadow-2xl">
          <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-10 w-auto mx-auto mb-3" />
          <p className="font-bold text-[#001A4D] mb-1">{profile.prenom} {profile.nom}</p>
          <p className="text-xs text-gray-400 mb-4">{cleanLicence(profile.numero_licence)}</p>
          <div className="flex justify-center mb-4">
            <QRCodeSVG value={qrUrl} size={200} level="H" />
          </div>
          {brevetLabel && <p className="text-xs text-gray-500">Brevet {brevetLabel} · {totalSauts} sauts</p>}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>Paramètres</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>Gérez votre compte et vos préférences</p>
        </div>

        {/* QR Code */}
        <Section icon={<QrCode className="w-4 h-4" />} title="Mon QR Code">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              {token ? (
                <QRCodeSVG value={qrUrl} size={160} level="H" />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center" style={{ background: 'var(--c-hover)', borderRadius: 8 }}>
                  <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFullscreen(true)}
                disabled={!token}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
              >
                <Maximize2 className="w-4 h-4" /> Plein écran
              </button>
              <button
                onClick={regenerateToken}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
              >
                <RefreshCw className="w-4 h-4" /> Régénérer
              </button>
            </div>
            <div className="text-center text-sm space-y-0.5">
              <p className="font-semibold" style={{ color: 'var(--c-text)' }}>{profile.prenom} {profile.nom}</p>
              <p style={{ color: 'var(--c-muted)' }}>Licence {cleanLicence(profile.numero_licence)}{brevetLabel ? ` · Brevet ${brevetLabel}` : ''}</p>
              <p style={{ color: 'var(--c-dim)', fontSize: 12 }}>{totalSauts} saut{totalSauts !== 1 ? 's' : ''} · {licence?.statut === 'actif' ? 'ACTIF' : 'INACTIF'}</p>
            </div>
          </div>
          <p className="text-xs text-center" style={{ color: 'var(--c-dim)' }}>Présentez ce code lors des contrôles DGAC ou pour partager votre passeport.</p>
        </Section>

        {/* Apparence */}
        <Section icon={<Palette className="w-4 h-4" />} title="Apparence">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>Thème</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>{isDark ? 'Mode sombre activé' : 'Mode clair activé'}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
              {isDark ? 'Passer en clair' : 'Passer en sombre'}
            </button>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={<Bell className="w-4 h-4" />} title="Notifications">
          {savingNotif && <p className="text-xs" style={{ color: 'var(--c-dim)' }}>Enregistrement...</p>}
          <ToggleRow label="Rappel expiration licence (60j avant)" checked={notifLicence} onChange={v => { setNotifLicence(v); saveNotifPref('notif_licence', v); }} />
          <ToggleRow label="Rappel certificat médical (60j avant)" checked={notifMedical} onChange={v => { setNotifMedical(v); saveNotifPref('notif_medical', v); }} />
          <ToggleRow label="Saut validé par un moniteur" checked={notifValidation} onChange={v => { setNotifValidation(v); saveNotifPref('notif_validation', v); }} />
        </Section>

        {/* Sécurité */}
        <Section icon={<Shield className="w-4 h-4" />} title="Sécurité">
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-dim)' }}>Adresse email</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--c-text)' }}>{profile.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-1" style={{ borderTop: '1px solid var(--c-border-s)' }}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-dim)' }}>Mot de passe</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--c-text)' }}>••••••••</p>
            </div>
            <button
              onClick={() => alert('Fonctionnalité à venir — contactez support@parapass.fr pour changer votre mot de passe.')}
              className="text-sm font-medium transition"
              style={{ color: '#F97316' }}
            >
              Modifier →
            </button>
          </div>
        </Section>

        {/* Mon Profil */}
        <Section icon={<User className="w-4 h-4" />} title="Mon Profil">
          <button
            onClick={() => navigate('/profil')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-sm font-medium"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-surface)')}
          >
            Modifier mes informations personnelles
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--c-dim)' }} />
          </button>
        </Section>

        {/* Zone dangereuse */}
        <Section icon={<Trash2 className="w-4 h-4" />} title="Zone dangereuse">
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}
            >
              <Trash2 className="w-4 h-4" /> Supprimer mon compte
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--c-text)' }}>
                Cette action est <strong>irréversible</strong>. Toutes vos données (sauts, passeport, badges) seront définitivement supprimées.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2 rounded-xl text-sm transition" style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-muted)', background: 'transparent' }}>
                  Annuler
                </button>
                <button
                  onClick={() => alert('Pour supprimer votre compte, contactez support@parapass.fr')}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition"
                  style={{ background: '#EF4444' }}
                >
                  Confirmer la suppression
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
