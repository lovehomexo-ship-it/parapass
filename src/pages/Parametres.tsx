import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useDemo } from '../lib/useDemo';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { PushNotifCard } from '../components/PushNotifCard';
import { Bell, Shield, User, Trash2, ChevronRight } from 'lucide-react';

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
  const navigate = useNavigate();

  // Notification prefs — stored in profile.preferences
  const prefs = (profile?.preferences ?? {}) as Record<string, boolean>;
  const [notifLicence, setNotifLicence] = useState<boolean>(prefs.notif_licence !== false);
  const [notifMedical, setNotifMedical] = useState<boolean>(prefs.notif_medical !== false);
  const [notifValidation, setNotifValidation] = useState<boolean>(prefs.notif_validation !== false);
  const [savingNotif, setSavingNotif] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const saveNotifPref = async (key: string, val: boolean) => {
    if (!user || blockIfDemo()) return;
    setSavingNotif(true);
    await supabase.from('profiles').update({
      preferences: { ...(prefs ?? {}), [key]: val },
    }).eq('id', user.id);
    setSavingNotif(false);
  };


  if (!profile) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>Réglages</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>Gérez votre compte et vos préférences</p>
        </div>

        {/* Le QR code et l'apparence vivent ailleurs, une fois : le QR dans
            « Passeport » (cette page en générait un second, à un autre jeton),
            l'apparence dans « Moi », avec « Comme le téléphone ». */}

        {/* Notifications */}
        <Section icon={<Bell className="w-4 h-4" />} title="Notifications">
          {/* Push natives (téléphone) — permission demandée au clic uniquement. */}
          <PushNotifCard userId={user?.id} />
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
