import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Check, Building2, Users, BookOpen } from 'lucide-react';
import { ParaPassLogo } from '../components/ParaPassLogo';

export function InscriptionCentrePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successCentre, setSuccessCentre] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    nom_centre: '',
    numero_agrement_ffp: '',
    ville: '',
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            nom: form.nom.trim().toUpperCase(),
            prenom: form.prenom.trim(),
            role: 'admin_centre',
          },
        },
      });

      if (authError || !authData.user) {
        if (authError?.message.toLowerCase().includes('already')) {
          setError('Cette adresse email est déjà utilisée. Connectez-vous plutôt.');
        } else {
          setError(authError?.message ?? 'Erreur lors de la création du compte.');
        }
        return;
      }

      // 2. Confirm email and sign in (handle projects with email confirmation enabled)
      await supabase.rpc('confirm_user_email', { user_email: form.email.trim().toLowerCase() });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (signInError) {
        setError('Compte créé mais connexion impossible : ' + signInError.message);
        return;
      }

      // 3. Upsert profile
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: form.email.trim().toLowerCase(),
        nom: form.nom.trim().toUpperCase(),
        prenom: form.prenom.trim(),
        role: 'admin_centre',
        numero_licence: '',
        type_pratiquant: 'directeur_technique',
      }, { onConflict: 'id' });

      // 4. Create centre
      const slug = form.nom_centre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: centreData, error: centreError } = await supabase
        .from('centres')
        .insert({
          nom: form.nom_centre.trim(),
          numero_agrement_ffp: form.numero_agrement_ffp.trim(),
          ville: form.ville.trim(),
          dt_nom: form.nom.trim().toUpperCase(),
          dt_prenom: form.prenom.trim(),
          statut: 'en_attente',
          plan: 'essai',
          slug,
        })
        .select('id')
        .single();

      if (centreError || !centreData) {
        setError('Erreur lors de la création du centre : ' + (centreError?.message ?? 'inconnue'));
        return;
      }

      // 5. Link profile to centre
      await supabase.from('profiles').update({ admin_centre_id: centreData.id }).eq('id', authData.user.id);

      // 6. Insert admin_centres membership
      await supabase.from('admin_centres').insert({
        centre_id: centreData.id,
        profile_id: authData.user.id,
        role: 'admin',
      });

      setSuccessCentre(form.nom_centre.trim());
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-[#001540] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all';

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-[#001540] mb-2">Centre créé !</h2>
          <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
            <span className="font-semibold text-[#001540]">{successCentre}</span> a été enregistré.
            Votre compte est actif — accédez à votre tableau de bord pour commencer.
          </p>

          <div className="space-y-2 text-left mb-7">
            {[
              { icon: Check, label: 'Centre créé', done: true },
              { icon: Users, label: 'Ajouter mes moniteurs', done: false },
              { icon: BookOpen, label: 'Inviter mes licenciés', done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                  {item.done ? <Check className="w-3.5 h-3.5 text-white" /> : <span className="text-gray-400 text-xs font-bold">{i + 1}</span>}
                </div>
                <span className={`text-sm ${item.done ? 'text-green-700 font-medium' : 'text-gray-700'}`}>{item.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/centre-dashboard')}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: '#2563EB' }}
          >
            Accéder à mon tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block no-underline">
            <ParaPassLogo />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#001540]">Inscrire mon centre</h1>
              <p className="text-xs text-[#64748B] mt-0.5">Compte Directeur Technique — Gratuit 30 jours</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Prénom DT <span className="text-red-500">*</span></label>
                <input type="text" value={form.prenom} onChange={(e) => update('prenom', e.target.value)} required className={inputCls} placeholder="Jean" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Nom DT <span className="text-red-500">*</span></label>
                <input type="text" value={form.nom} onChange={(e) => update('nom', e.target.value)} required className={inputCls} placeholder="DUPONT" />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Email <span className="text-red-500">*</span></label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required autoComplete="email" className={inputCls} placeholder="dt@moncentre.fr" />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Mot de passe <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} required autoComplete="new-password" className={`${inputCls} pr-10`} placeholder="Minimum 6 caractères" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-1 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Informations du centre</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Nom du centre <span className="text-red-500">*</span></label>
                  <input type="text" value={form.nom_centre} onChange={(e) => update('nom_centre', e.target.value)} required className={inputCls} placeholder="Ex : BigAir Rochefort" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">N° FFP <span className="text-red-500">*</span></label>
                    <input type="text" value={form.numero_agrement_ffp} onChange={(e) => update('numero_agrement_ffp', e.target.value)} required className={inputCls} placeholder="FFP-0916" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Ville <span className="text-red-500">*</span></label>
                    <input type="text" value={form.ville} onChange={(e) => update('ville', e.target.value)} required className={inputCls} placeholder="Rochefort" />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 mt-2"
              style={{ background: loading ? '#93C5FD' : '#2563EB' }}
            >
              {loading ? 'Création du compte...' : 'Créer le compte centre'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-[#64748B]">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700 no-underline">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
