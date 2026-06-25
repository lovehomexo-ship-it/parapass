import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Check, Rocket, ChevronLeft } from 'lucide-react';

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] bg-white text-gray-900';

function FormRow({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function isProfileIncomplete(profile: { nom?: string | null; prenom?: string | null; date_naissance?: string | null } | null): boolean {
  if (!profile) return false;
  return !profile.nom?.trim() || !profile.prenom?.trim() || !profile.date_naissance;
}

export function CompleteProfileModal({ onComplete }: { onComplete: () => void }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nom: (profile?.nom ?? '').trim() === '' ? '' : (profile?.nom ?? ''),
    prenom: (profile?.prenom ?? '').trim() === '' ? '' : (profile?.prenom ?? ''),
    date_naissance: profile?.date_naissance ?? '',
    sexe: '',
    lieu_naissance: '',
    nationalite: 'Française',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    date_ouverture_carnet: '',
    ecole_ouverture_nom: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleBackToLogin = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const isValid = form.nom.trim() !== '' && form.prenom.trim() !== '' && form.date_naissance !== '';

  const handleSave = async () => {
    if (!user || !isValid) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('profiles').update({
      nom: form.nom.trim().toUpperCase(),
      prenom: form.prenom.trim(),
      date_naissance: form.date_naissance,
      sexe: form.sexe || null,
      lieu_naissance: form.lieu_naissance || null,
      nationalite: form.nationalite || null,
      telephone: form.telephone || null,
      adresse: form.adresse || null,
      code_postal: form.code_postal || null,
      ville: form.ville || null,
      date_ouverture_carnet: form.date_ouverture_carnet || null,
      ecole_ouverture_nom: form.ecole_ouverture_nom || null,
    }).eq('id', user.id);

    if (err) {
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
      setSaving(false);
      return;
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,26,77,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl bg-white">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 pt-5 pb-4 rounded-t-2xl">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="flex items-center gap-1 mb-3 transition-colors"
            style={{ color: '#94A3B8', fontSize: '13px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#64748B')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Retour à la connexion
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#001A4D] flex items-center justify-center flex-shrink-0">
              <Rocket className="w-4.5 h-4.5 text-white w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#001A4D]">Complétez votre profil</h2>
              <p className="text-xs text-gray-500">Quelques informations pour ouvrir votre carnet de sauts</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  background: '#001A4D',
                  width: `${Math.round(
                    ([form.nom, form.prenom, form.date_naissance, form.sexe, form.nationalite, form.telephone, form.ville].filter(Boolean).length / 7) * 100
                  )}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {[form.nom, form.prenom, form.date_naissance].filter((v) => v.trim() !== '').length}/3 obligatoires
            </span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
          )}

          {/* Section 1 — Identité */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">1</span>
              </div>
              <p className="text-sm font-bold text-[#001A4D] uppercase tracking-wider">Identité du licencié</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Nom" required>
                  <input
                    className={inputCls}
                    value={form.nom}
                    onChange={(e) => set({ nom: e.target.value })}
                    placeholder="DUPONT"
                    style={!form.nom.trim() ? { borderColor: '#FCA5A5' } : {}}
                  />
                </FormRow>
                <FormRow label="Prénom" required>
                  <input
                    className={inputCls}
                    value={form.prenom}
                    onChange={(e) => set({ prenom: e.target.value })}
                    placeholder="Jean"
                    style={!form.prenom.trim() ? { borderColor: '#FCA5A5' } : {}}
                  />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Date de naissance" required>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.date_naissance}
                    onChange={(e) => set({ date_naissance: e.target.value })}
                    style={!form.date_naissance ? { borderColor: '#FCA5A5' } : {}}
                  />
                </FormRow>
                <FormRow label="Sexe">
                  <select className={inputCls} value={form.sexe} onChange={(e) => set({ sexe: e.target.value })}>
                    <option value="">—</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Lieu de naissance">
                  <input className={inputCls} value={form.lieu_naissance} onChange={(e) => set({ lieu_naissance: e.target.value })} placeholder="Paris" />
                </FormRow>
                <FormRow label="Nationalité">
                  <input className={inputCls} value={form.nationalite} onChange={(e) => set({ nationalite: e.target.value })} />
                </FormRow>
              </div>
            </div>
          </div>

          {/* Section 2 — Coordonnées */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">2</span>
              </div>
              <p className="text-sm font-bold text-[#001A4D] uppercase tracking-wider">Coordonnées</p>
              <span className="text-xs text-gray-400 font-normal normal-case tracking-normal">(optionnel)</span>
            </div>
            <div className="space-y-3">
              <FormRow label="Adresse">
                <input className={inputCls} value={form.adresse} onChange={(e) => set({ adresse: e.target.value })} placeholder="12 rue de la Paix" />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Code postal">
                  <input className={inputCls} value={form.code_postal} onChange={(e) => set({ code_postal: e.target.value })} placeholder="75001" />
                </FormRow>
                <FormRow label="Ville">
                  <input className={inputCls} value={form.ville} onChange={(e) => set({ ville: e.target.value })} placeholder="Paris" />
                </FormRow>
              </div>
              <FormRow label="Téléphone">
                <input type="tel" className={inputCls} value={form.telephone} onChange={(e) => set({ telephone: e.target.value })} placeholder="06 12 34 56 78" />
              </FormRow>
            </div>
          </div>

          {/* Section 3 — Ouverture du carnet */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">3</span>
              </div>
              <p className="text-sm font-bold text-[#001A4D] uppercase tracking-wider">Ouverture du carnet</p>
              <span className="text-xs text-gray-400 font-normal normal-case tracking-normal">(optionnel)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Date d'ouverture" hint="Date du premier saut">
                <input type="date" className={inputCls} value={form.date_ouverture_carnet} onChange={(e) => set({ date_ouverture_carnet: e.target.value })} />
              </FormRow>
              <FormRow label="École / DZ d'ouverture">
                <input className={inputCls} value={form.ecole_ouverture_nom} onChange={(e) => set({ ecole_ouverture_nom: e.target.value })} placeholder="Big'Air Parachutisme" />
              </FormRow>
            </div>
          </div>

          {/* Required fields note */}
          <p className="text-xs text-gray-400">
            <span className="text-red-400">*</span> Champs obligatoires — Nom, Prénom et Date de naissance sont requis pour continuer.
          </p>

          {/* CTA */}
          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
              style={
                isValid && !saving
                  ? { background: '#001A4D', color: '#fff' }
                  : { background: '#E2E8F0', color: '#94A3B8', cursor: 'not-allowed' }
              }
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</>
              ) : (
                <><Check className="w-4 h-4" /> Enregistrer et accéder à ParaPass</>
              )}
            </button>
            {!isValid && (
              <p className="text-center text-xs text-gray-400 mt-2">
                Renseignez Nom, Prénom et Date de naissance pour continuer
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
