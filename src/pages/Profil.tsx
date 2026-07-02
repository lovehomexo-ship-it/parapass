import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, isDelegationActive } from '../lib/auth';
import { useDemo } from '../lib/useDemo';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Check, Upload, Globe, Users, Lock, Eye, Building2, Key, CheckCircle, AlertTriangle, Camera, PenLine, Trash2 } from 'lucide-react';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]';
const selectCls = inputCls;

function FormRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-7 h-7 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">{num}</span>
      </div>
      <p className="text-sm font-bold text-[#001A4D] uppercase tracking-wider">{title}</p>
    </div>
  );
}

function DelegationSection() {
  const { user, delegation } = useAuth();
  const hasActive = isDelegationActive(delegation);

  function fr(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (!user) return null;

  return (
    <div className="mt-6 space-y-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
          <Key className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-sm font-bold text-[#001A4D] uppercase tracking-wider">Mes accréditations</p>
      </div>

      {hasActive && delegation ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm font-bold text-green-800">Validateur accrédité</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-green-800">
            <div><span className="text-green-600">Centre</span><p className="font-semibold mt-0.5">{delegation.centre?.nom ?? '—'}</p></div>
            <div><span className="text-green-600">Accordé par</span><p className="font-semibold mt-0.5">{delegation.dt ? `${delegation.dt.prenom} ${delegation.dt.nom}` : '—'} (DT)</p></div>
            <div><span className="text-green-600">Depuis</span><p className="font-semibold mt-0.5">{fr(delegation.date_delegation)}</p></div>
            <div><span className="text-green-600">Expire</span><p className="font-semibold mt-0.5">{delegation.date_expiration ? fr(delegation.date_expiration) : 'Permanente'}</p></div>
          </div>
          <p className="text-xs text-green-700 border-t border-green-200 pt-3">
            Vous pouvez valider les sauts des licenciés de ce centre. L'onglet <strong>Validations</strong> est disponible dans votre menu.
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            Vous n'avez pas de délégation de validation active. Si vous êtes moniteur diplômé, contactez le Directeur Technique de votre centre pour qu'il vous accorde une délégation dans ParaPass.
          </p>
        </div>
      )}
    </div>
  );
}

export function ProfilPage() {
  const { user, profile } = useAuth();
  const { blockIfDemo } = useDemo();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    sexe: '',
    date_naissance: '',
    lieu_naissance: '',
    nationalite: 'Française',
    adresse: '',
    code_postal: '',
    ville: '',
    telephone: '',
    email_contact: '',
    date_ouverture_carnet: '',
    ecole_ouverture_nom: '',
    ecole_ouverture_dt_nom: '',
    photo_identite_url: '',
    signature_url: '',
  });
  const [privacy, setPrivacy] = useState({
    username: '',
    username_modifie: false,
    bio: '',
    niveau_profil: 'public' as 'public' | 'communaute' | 'prive',
    visibilite_sauts: true,
    visibilite_brevets: true,
    visibilite_badges: true,
    visibilite_centre: false,
    visibilite_activite: false,
    partage_carte_centre: true,
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [savedPrivacy, setSavedPrivacy] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [accessLogs, setAccessLogs] = useState<{ id: string; created_at: string; centre: { nom: string } | null }[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const p = profile as Record<string, unknown>;
    setForm({
      nom: profile.nom ?? '',
      prenom: profile.prenom ?? '',
      sexe: (p.sexe as string) ?? '',
      date_naissance: profile.date_naissance ?? '',
      lieu_naissance: profile.lieu_naissance ?? '',
      nationalite: profile.nationalite ?? 'Française',
      adresse: (p.adresse as string) ?? '',
      code_postal: (p.code_postal as string) ?? '',
      ville: (p.ville as string) ?? '',
      telephone: (p.telephone as string) ?? '',
      email_contact: (p.email_contact as string) ?? '',
      date_ouverture_carnet: (p.date_ouverture_carnet as string) ?? '',
      ecole_ouverture_nom: (p.ecole_ouverture_nom as string) ?? '',
      ecole_ouverture_dt_nom: (p.ecole_ouverture_dt_nom as string) ?? '',
      photo_identite_url: (p.photo_identite_url as string) ?? '',
      signature_url: profile.signature_url ?? '',
    });
    setPrivacy({
      username: (p.username as string) ?? '',
      username_modifie: (p.username_modifie as boolean) ?? false,
      bio: (p.bio as string) ?? '',
      niveau_profil: ((p.niveau_profil as string) || 'public') as 'public' | 'communaute' | 'prive',
      visibilite_sauts: (p.visibilite_sauts as boolean) ?? true,
      visibilite_brevets: (p.visibilite_brevets as boolean) ?? true,
      visibilite_badges: (p.visibilite_badges as boolean) ?? true,
      visibilite_centre: (p.visibilite_centre as boolean) ?? false,
      visibilite_activite: (p.visibilite_activite as boolean) ?? false,
      partage_carte_centre: (p.partage_carte_centre as boolean) ?? true,
    });
  }, [profile]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const setP = (patch: Partial<typeof privacy>) => setPrivacy((p) => ({ ...p, ...patch }));

  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    suivi_dgac: false,
  });

  useEffect(() => {
    if (!profile) return;
    const p = profile as Record<string, unknown>;
    const prefs = (p.preferences as Record<string, unknown>) ?? {};
    setPreferences({ suivi_dgac: !!(prefs.suivi_dgac) });
  }, [profile]);

  const togglePreference = (key: string) => {
    if (!user) return;
    const newVal = !preferences[key];
    const newPrefs = { ...preferences, [key]: newVal };
    setPreferences(newPrefs);
    supabase.from('profiles').update({ preferences: newPrefs }).eq('id', user.id);
  };

  const loadAccessLogs = async () => {
    if (!user) return;
    setLoadingLogs(true);
    const { data } = await supabase
      .from('journal_acces_cartes')
      .select('id, created_at, centre:centres!centre_id(nom)')
      .eq('parachutiste_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setAccessLogs((data ?? []) as typeof accessLogs);
    setLoadingLogs(false);
  };

  const savePrivacy = async () => {
    if (!user || blockIfDemo()) return;
    setUsernameError('');
    // Validate username if changed
    if (privacy.username) {
      const cleaned = privacy.username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (cleaned !== privacy.username) {
        setUsernameError('Uniquement lettres minuscules, chiffres, points et tirets');
        return;
      }
      // Check uniqueness if not already set or if changed
      const p = profile as Record<string, unknown>;
      const existingUsername = (p.username as string) ?? '';
      if (cleaned !== existingUsername) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleaned)
          .maybeSingle();
        if (existing) {
          setUsernameError('Ce nom d\'utilisateur est déjà pris');
          return;
        }
        if ((p.username_modifie as boolean) && existingUsername) {
          setUsernameError('Le nom d\'utilisateur ne peut être modifié qu\'une seule fois');
          return;
        }
      }
    }
    setSavingPrivacy(true);
    const p = profile as Record<string, unknown>;
    const existingUsername = (p.username as string) ?? '';
    const usernameChanged = privacy.username && privacy.username !== existingUsername;
    await supabase.from('profiles').update({
      bio: privacy.bio || null,
      niveau_profil: privacy.niveau_profil,
      visibilite_sauts: privacy.visibilite_sauts,
      visibilite_brevets: privacy.visibilite_brevets,
      visibilite_badges: privacy.visibilite_badges,
      visibilite_centre: privacy.visibilite_centre,
      visibilite_activite: privacy.visibilite_activite,
      partage_carte_centre: privacy.partage_carte_centre,
      ...(privacy.username ? { username: privacy.username } : {}),
      ...(usernameChanged ? { username_modifie: true } : {}),
    }).eq('id', user.id);
    setSavingPrivacy(false);
    setSavedPrivacy(true);
    setTimeout(() => setSavedPrivacy(false), 3000);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0] || blockIfDemo()) return;
    const file = e.target.files[0];
    setPhotoUploading(true);
    try {
      const resized = await resizeImageSquare(file, 400);
      const fileName = `photo-${user.id}.jpg`;
      const { error } = await supabase.storage.from('profile-photos').upload(fileName, resized, { upsert: true, contentType: 'image/jpeg' });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(fileName);
        const bust = `${publicUrl}?t=${Date.now()}`;
        set({ photo_identite_url: bust });
        await supabase.from('profiles').update({ photo_identite_url: bust, avatar_url: bust }).eq('id', user.id);
      }
    } finally {
      setPhotoUploading(false);
    }
  };

  function resizeImageSquare(file: File, size: number): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const x = (img.width - s) / 2;
        const y = (img.height - s) / 2;
        ctx.drawImage(img, x, y, s, s, 0, 0, size, size);
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  const saveSignature = useCallback(async () => {
    if (!user || !canvasRef.current || blockIfDemo()) return;
    setSignatureSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve) => canvasRef.current!.toBlob((b) => resolve(b!), 'image/png'));
      const fileName = `signature-${user.id}.png`;
      const { error } = await supabase.storage.from('signatures').upload(fileName, blob, { upsert: true, contentType: 'image/png' });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('signatures').getPublicUrl(fileName);
        const bust = `${publicUrl}?t=${Date.now()}`;
        set({ signature_url: bust });
        await supabase.from('profiles').update({ signature_url: bust }).eq('id', user.id);
        setSignatureSaved(true);
        setTimeout(() => setSignatureSaved(false), 3000);
      }
    } finally {
      setSignatureSaving(false);
    }
  }, [user]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPos('touches' in e ? e.touches[0] : e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const pos = getPos('touches' in e ? e.touches[0] : e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };
    const stop = () => { isDrawingRef.current = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stop);
  }, []);

  const save = async () => {
    if (!user || blockIfDemo()) return;
    setSaving(true);
    await supabase.from('profiles').update({
      nom: form.nom,
      prenom: form.prenom,
      sexe: form.sexe || null,
      date_naissance: form.date_naissance || null,
      lieu_naissance: form.lieu_naissance || null,
      nationalite: form.nationalite || null,
      adresse: form.adresse || null,
      code_postal: form.code_postal || null,
      ville: form.ville || null,
      telephone: form.telephone || null,
      email_contact: form.email_contact || null,
      date_ouverture_carnet: form.date_ouverture_carnet || null,
      ecole_ouverture_nom: form.ecole_ouverture_nom || null,
      ecole_ouverture_dt_nom: form.ecole_ouverture_dt_nom || null,
    }).eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!profile) return null;

  function timeAgo(dateStr: string): string {
    const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (secs < 60) return 'il y a quelques secondes';
    if (secs < 3600) return `il y a ${Math.floor(secs / 60)} min`;
    if (secs < 86400) return `il y a ${Math.floor(secs / 3600)}h`;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#001A4D]">Mon Profil</h1>
          <p className="text-sm text-gray-500">Page de garde — Carnet de sauts numérique FFP</p>
        </div>

        <div className="space-y-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

          {/* ── Section 1 : Identité ── */}
          <SectionHeader num="1" title="Identité du licencié" />

          {/* Zone photo */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="relative w-24 h-28 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center group">
                {form.photo_identite_url ? (
                  <img src={form.photo_identite_url} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400 text-center px-1">Photo d'identité</span>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-lg">
                  {photoUploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:underline">
                <Upload className="w-3 h-3" /> Modifier
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
              </label>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
              <FormRow label="Nom">
                <input className={inputCls} value={form.nom} onChange={(e) => set({ nom: e.target.value })} />
              </FormRow>
              <FormRow label="Prénom">
                <input className={inputCls} value={form.prenom} onChange={(e) => set({ prenom: e.target.value })} />
              </FormRow>
              <FormRow label="Sexe">
                <select className={selectCls} value={form.sexe} onChange={(e) => set({ sexe: e.target.value })}>
                  <option value="">—</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </FormRow>
              <FormRow label="Nationalité">
                <input className={inputCls} value={form.nationalite} onChange={(e) => set({ nationalite: e.target.value })} />
              </FormRow>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Date de naissance">
              <input type="date" className={inputCls} value={form.date_naissance} onChange={(e) => set({ date_naissance: e.target.value })} />
            </FormRow>
            <FormRow label="Lieu de naissance">
              <input className={inputCls} value={form.lieu_naissance} onChange={(e) => set({ lieu_naissance: e.target.value })} placeholder="Paris, France" />
            </FormRow>
          </div>

          {/* ── Section 2 : Coordonnées ── */}
          <div className="border-t border-gray-100 pt-4">
            <SectionHeader num="2" title="Coordonnées" />
          </div>

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
            <FormRow label="Téléphone">
              <input type="tel" className={inputCls} value={form.telephone} onChange={(e) => set({ telephone: e.target.value })} placeholder="06 12 34 56 78" />
            </FormRow>
            <FormRow label="Email de contact">
              <input type="email" className={inputCls} value={form.email_contact} onChange={(e) => set({ email_contact: e.target.value })} placeholder="vous@email.fr" />
            </FormRow>
          </div>

          {/* ── Section 3 : Ouverture du carnet ── */}
          <div className="border-t border-gray-100 pt-4">
            <SectionHeader num="3" title="Ouverture du carnet" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Date d'ouverture" hint="Date du premier saut ou d'émission du carnet">
              <input type="date" className={inputCls} value={form.date_ouverture_carnet} onChange={(e) => set({ date_ouverture_carnet: e.target.value })} />
            </FormRow>
            <FormRow label="École / DZ d'ouverture">
              <input className={inputCls} value={form.ecole_ouverture_nom} onChange={(e) => set({ ecole_ouverture_nom: e.target.value })} placeholder="Big'Air Parachutisme" />
            </FormRow>
          </div>

          <FormRow label="Nom du DT (Directeur Technique)">
            <input className={inputCls} value={form.ecole_ouverture_dt_nom} onChange={(e) => set({ ecole_ouverture_dt_nom: e.target.value })} placeholder="Prénom NOM" />
          </FormRow>

          {/* ── Section signature ── */}
          <div className="border-t border-gray-100 pt-4">
            <SectionHeader num="4" title="Ma signature" />
          </div>
          <p className="text-xs text-gray-500">Signez dans le cadre ci-dessous. Cette signature apparaîtra sur votre passeport numérique.</p>
          <div className="space-y-2">
            <canvas
              ref={initCanvas}
              width={400}
              height={120}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-white touch-none cursor-crosshair"
              style={{ maxHeight: 120 }}
            />
            {form.signature_url && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Actuelle :</span>
                <img src={form.signature_url} alt="Signature" className="h-8 object-contain border border-gray-200 rounded px-2 bg-white" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSignature}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Effacer
              </button>
              <button
                type="button"
                onClick={saveSignature}
                disabled={signatureSaving}
                className="flex items-center gap-1.5 text-xs text-white bg-[#001A4D] hover:bg-[#1E3A5F] px-3 py-1.5 rounded-lg transition disabled:opacity-60"
              >
                {signatureSaving ? (
                  <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enregistrement…</>
                ) : signatureSaved ? (
                  <><Check className="w-3.5 h-3.5" /> Enregistrée !</>
                ) : (
                  <><PenLine className="w-3.5 h-3.5" /> Enregistrer ma signature</>
                )}
              </button>
            </div>
          </div>

          {/* ── Save ── */}
          <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-[#001A4D] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <Check className="w-4 h-4" /> Profil mis à jour
              </span>
            )}
          </div>
        </div>

        {/* ── Section Confidentialité / Profil public ── */}
        <div className="mt-6 space-y-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader num="5" title="Profil communauté &amp; Confidentialité" />

          <FormRow label="Nom d'utilisateur (@username)" hint={privacy.username_modifie && privacy.username ? "Déjà modifié — non modifiable à nouveau" : "Généré automatiquement prenom.nom — modifiable une fois"}>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm font-mono">@</span>
              <input
                className={`${inputCls} font-mono`}
                value={privacy.username}
                onChange={(e) => setP({ username: e.target.value.toLowerCase() })}
                placeholder={`${(profile.prenom ?? '').toLowerCase()}.${(profile.nom ?? '').toLowerCase()}`}
                disabled={privacy.username_modifie && !!privacy.username}
              />
            </div>
            {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
          </FormRow>

          <FormRow label="Bio courte" hint="Visible publiquement sur votre profil">
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={privacy.bio}
              onChange={(e) => setP({ bio: e.target.value })}
              placeholder="Passionné de parachutisme depuis 2015..."
              maxLength={160}
            />
          </FormRow>

          <FormRow label="Niveau de visibilité du profil">
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'public', label: 'Public', desc: 'Visible par tous', icon: <Globe className="w-4 h-4" /> },
                { key: 'communaute', label: 'Communauté', desc: 'Abonnés seulement', icon: <Users className="w-4 h-4" /> },
                { key: 'prive', label: 'Privé', desc: 'Centres agréés', icon: <Lock className="w-4 h-4" /> },
              ] as const).map(({ key, label, desc, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setP({ niveau_profil: key })}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                    privacy.niveau_profil === key
                      ? 'border-[#001A4D] bg-[#001A4D]/5 text-[#001A4D]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {icon}
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] text-gray-400">{desc}</span>
                </button>
              ))}
            </div>
          </FormRow>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Éléments visibles publiquement</p>
            <div className="space-y-2">
              {([
                { key: 'visibilite_sauts', label: 'Nombre de sauts validés' },
                { key: 'visibilite_brevets', label: 'Brevets et qualifications' },
                { key: 'visibilite_badges', label: 'Badges obtenus' },
                { key: 'visibilite_centre', label: 'Centre(s) principal(aux)' },
                { key: 'visibilite_activite', label: 'Activité récente (derniers sauts)' },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${privacy[key] ? 'bg-[#001A4D]' : 'bg-gray-300'}`}
                    onClick={() => setP({ [key]: !privacy[key] })}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${privacy[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── Partage carte avec le centre ── */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Partage avec mon centre
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Votre centre agréé peut consulter votre carte passeport ParaPass pour vérifier votre conformité réglementaire. Cela inclut vos dates de validité de licence et de certificat médical.
            </p>
            <label className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 cursor-pointer">
              <span className="text-sm text-gray-700">Autoriser mon centre à consulter ma carte passeport</span>
              <div
                className={`relative w-10 h-5 rounded-full transition-colors ${privacy.partage_carte_centre ? 'bg-[#001A4D]' : 'bg-gray-300'}`}
                onClick={() => setP({ partage_carte_centre: !privacy.partage_carte_centre })}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${privacy.partage_carte_centre ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>

          <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
            <button
              onClick={savePrivacy}
              disabled={savingPrivacy}
              className="flex items-center gap-2 bg-[#001A4D] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {savingPrivacy ? 'Enregistrement...' : 'Enregistrer la confidentialité'}
            </button>
            {savedPrivacy && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <Check className="w-4 h-4" /> Paramètres mis à jour
              </span>
            )}
          </div>
        </div>

        {/* ── Section Accréditations (délégation) ── */}
        {(profile?.role === 'moniteur' || profile?.role === 'parachutiste') && (
          <DelegationSection />
        )}

        {/* ── Section Préférences ── */}
        <div className="mt-6 space-y-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">⚙</span>
            </div>
            <p className="text-sm font-bold text-[#001A4D] uppercase tracking-wider">Préférences</p>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Suivi seuil réglementaire DGAC</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Affiche une alerte si vous n'avez pas atteint 20 sauts sur 12 mois. Recommandé uniquement pour les parachutistes professionnels SNPP.
              </p>
            </div>
            <button
              type="button"
              onClick={() => togglePreference('suivi_dgac')}
              className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
              style={{ background: preferences.suivi_dgac ? '#2563EB' : '#D1D5DB' }}
              aria-checked={preferences.suivi_dgac}
              role="switch"
            >
              <span
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: preferences.suivi_dgac ? 'translateX(20px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
        </div>


        <div className="mt-6 space-y-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
                <Eye className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-sm font-bold text-[#001A4D] uppercase tracking-wider">Historique des consultations</p>
            </div>
            <button
              onClick={loadAccessLogs}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Charger
            </button>
          </div>
          <p className="text-xs text-gray-500">Consultez qui a accédé à votre carte passeport.</p>

          {loadingLogs ? (
            <div className="flex justify-center py-4"><div className="w-5 h-5 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin" /></div>
          ) : accessLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucune consultation enregistrée</p>
          ) : (
            <div className="space-y-2">
              {accessLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{log.centre?.nom ?? '—'}</span>
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
