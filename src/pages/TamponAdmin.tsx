import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { TamponDZ, exportTamponPNG } from '../components/TamponDZ';
import type { TamponConfig } from '../components/TamponDZ';
import { Upload, Save, Download, Stamp } from 'lucide-react';

interface CentreTampon {
  id: string;
  nom: string;
  ville: string;
  tampon_logo_url: string | null;
  tampon_svg_url: string | null;
  tampon_couleur_primaire: string;
  tampon_couleur_texte: string;
  tampon_nom_officiel: string | null;
  tampon_numero_agrement: string | null;
}

const DEMO_CONFIG: TamponConfig = {
  nomDZ: "BIG'AIR SKYDIVING",
  numeroAgrement: 'FFP-DEMO',
  couleurPrimaire: '#F59E0B',
  couleurTexte: '#000000',
  logoUrl: '/big-air-logo-sans-fond.png',
};

export function TamponAdminPage() {
  const { user, profile } = useAuth();
  const [centre, setCentre] = useState<CentreTampon | null>(null);
  const [config, setConfig] = useState<TamponConfig>(DEMO_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile?.centre_id) return;
    supabase
      .from('centres')
      .select('id, nom, ville, tampon_logo_url, tampon_svg_url, tampon_couleur_primaire, tampon_couleur_texte, tampon_nom_officiel, tampon_numero_agrement')
      .eq('id', profile.centre_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const c = data as CentreTampon;
        setCentre(c);
        const signedLogo = c.tampon_logo_url
          ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${c.tampon_logo_url}`
          : null;
        setConfig({
          nomDZ: c.tampon_nom_officiel ?? c.nom,
          numeroAgrement: c.tampon_numero_agrement ?? '',
          couleurPrimaire: c.tampon_couleur_primaire,
          couleurTexte: c.tampon_couleur_texte,
          logoUrl: signedLogo,
        });
        if (signedLogo) setLogoPreviewUrl(signedLogo);
      });
  }, [profile]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const preview = URL.createObjectURL(file);
    setLogoPreviewUrl(preview);
    setConfig((c) => ({ ...c, logoUrl: preview }));

    const ext = file.name.split('.').pop();
    const path = `logos/${user.id}-${Date.now()}.${ext}`;
    await supabase.storage.from('parapass-docs').upload(path, file, { upsert: true });
    setConfig((c) => ({ ...c, logoUrl: preview }));
    setCentre((prev) => prev ? { ...prev, tampon_logo_url: path } : prev);
  };

  const save = async () => {
    if (!profile?.centre_id || !centre) return;
    setSaving(true);

    // Save tampon as PNG data url in storage
    exportTamponPNG(config, config.logoUrl, async (dataUrl) => {
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File([blob], 'tampon.png', { type: 'image/png' });
      const path = `tampons/${centre.id}-${Date.now()}.png`;
      await supabase.storage.from('parapass-docs').upload(path, file, { upsert: true });

      const logoPath = centre.tampon_logo_url ?? null;
      await supabase.from('centres').update({
        tampon_nom_officiel: config.nomDZ,
        tampon_numero_agrement: config.numeroAgrement,
        tampon_couleur_primaire: config.couleurPrimaire,
        tampon_couleur_texte: config.couleurTexte,
        tampon_logo_url: logoPath,
        tampon_svg_url: path,
      }).eq('id', centre.id);

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  };

  const downloadPNG = () => {
    exportTamponPNG(config, config.logoUrl, (dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `tampon-${config.nomDZ.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    });
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#001A4D' }}>
            <Stamp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#001A4D]">Mon Tampon Officiel DZ</h1>
            <p className="text-sm text-gray-500">Créez et personnalisez le tampon numérique de votre dropzone</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Config panel */}
          <div className="space-y-5">

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-semibold text-[#001A4D] uppercase tracking-wider">Identité de la DZ</h2>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom officiel (arc supérieur)</label>
                <input className={inputCls} value={config.nomDZ}
                  onChange={(e) => setConfig((c) => ({ ...c, nomDZ: e.target.value.toUpperCase() }))}
                  placeholder="BIG'AIR SKYDIVING" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Numéro d'agrément FFP</label>
                <input className={inputCls} value={config.numeroAgrement}
                  onChange={(e) => setConfig((c) => ({ ...c, numeroAgrement: e.target.value }))}
                  placeholder="FFP-0916" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Logo DZ (PNG fond transparent recommandé)</label>
                <div className="flex items-center gap-3">
                  {logoPreviewUrl && (
                    <img src={logoPreviewUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                  )}
                  <button type="button" onClick={() => logoFileRef.current?.click()}
                    className="flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    <Upload className="w-4 h-4" />
                    {logoPreviewUrl ? 'Changer le logo' : 'Téléverser un logo'}
                  </button>
                  <input ref={logoFileRef} type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-semibold text-[#001A4D] uppercase tracking-wider">Couleurs</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Couleur primaire</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.couleurPrimaire}
                      onChange={(e) => setConfig((c) => ({ ...c, couleurPrimaire: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                    <input className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono"
                      value={config.couleurPrimaire}
                      onChange={(e) => setConfig((c) => ({ ...c, couleurPrimaire: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Couleur texte</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.couleurTexte}
                      onChange={(e) => setConfig((c) => ({ ...c, couleurTexte: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                    <input className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono"
                      value={config.couleurTexte}
                      onChange={(e) => setConfig((c) => ({ ...c, couleurTexte: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Préréglages rapides</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "Big'Air", p: '#F59E0B', t: '#000000' },
                    { label: 'ParaPass', p: '#001A4D', t: '#FFFFFF' },
                    { label: 'Classique', p: '#1a2744', t: '#FFFFFF' },
                    { label: 'Rouge', p: '#DC2626', t: '#FFFFFF' },
                  ].map((preset) => (
                    <button key={preset.label} type="button"
                      onClick={() => setConfig((c) => ({ ...c, couleurPrimaire: preset.p, couleurTexte: preset.t }))}
                      className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs hover:bg-gray-50 transition-colors">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: preset.p }} />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 bg-[#001A4D] hover:bg-[#1E3A5F] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Valider et enregistrer'}
              </button>
              <button onClick={downloadPNG}
                className="flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" /> Exporter PNG
              </button>
            </div>
          </div>

          {/* Preview panel */}
          <div className="flex flex-col items-center gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full flex flex-col items-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">Prévisualisation en temps réel</p>

              {/* Normal */}
              <div className="mb-2">
                <p className="text-[10px] text-gray-400 text-center mb-2">Tampon standard</p>
                <TamponDZ config={config} className="w-48 h-48" />
              </div>

              {/* Stamp effect */}
              <div className="mt-6">
                <p className="text-[10px] text-gray-400 text-center mb-2">Effet tampon encré (sur carnet PDF)</p>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <TamponDZ
                    config={{ ...config, rotation: -1.5, opacity: 0.92 }}
                    className="w-36 h-36"
                    stampEffect
                  />
                </div>
              </div>
            </div>

            {/* Demo Big'Air */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 w-full">
              <p className="text-xs font-semibold text-[#001A4D] uppercase tracking-wider mb-4">Tampon démo Big'Air Skydiving</p>
              <div className="flex items-center gap-4">
                <TamponDZ config={DEMO_CONFIG} className="w-28 h-28" stampEffect />
                <div className="text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-[#001A4D]">BIG'AIR SKYDIVING</p>
                  <p className="text-gray-500">Agrément : FFP-DEMO</p>
                  <p className="text-gray-500">Couleurs identité Big'Air</p>
                  <button type="button"
                    onClick={() => setConfig(DEMO_CONFIG)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline">
                    Charger ce modèle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
