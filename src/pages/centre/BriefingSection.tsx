import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { uploadDocument, getSignedUrl } from '../../lib/usePassport';
import { BriefingScene } from '../../components/BriefingScene';
import {
  useBriefingDuJour,
  type DzSettings, type Hazard, type NoFlyZone,
} from '../../lib/briefing';
import { Upload, Megaphone, MapPin, Wind as WindIcon, AlertTriangle, Ban, Trash2, ExternalLink } from 'lucide-react';

type EditTool = 'aucun' | 'lz' | 'sock' | 'hazard' | 'nofly';

const inputStyle: React.CSSProperties = {
  background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
};

/** Interface DT « Briefing du jour » — réglage, aperçu en direct, publication versionnée. */
export function BriefingSection({ centreId }: { centreId: string }) {
  const { user } = useAuth();
  const { settings, briefing, refresh } = useBriefingDuJour(centreId);

  // Brouillon des réglages DZ (positions) et du briefing
  const [draftSettings, setDraftSettings] = useState<DzSettings>({
    dz_id: centreId, image_fond_url: null, lz_x: null, lz_y: null, sock_x: null, sock_y: null, no_fly_zones: [],
  });
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [tool, setTool] = useState<EditTool>('aucun');
  const [pendingNoFly, setPendingNoFly] = useState<{ x: number; y: number }[]>([]);

  const [windDir, setWindDir] = useState(270);
  const [windSpeed, setWindSpeed] = useState('');
  const [sensDeg, setSensDeg] = useState(270);
  const [sensTouched, setSensTouched] = useState(false);
  const [side, setSide] = useState<'main_gauche' | 'main_droite'>('main_gauche');
  const [altitude, setAltitude] = useState(300);
  const [consignes, setConsignes] = useState('');
  const [hazards, setHazards] = useState<Hazard[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedMsg, setPublishedMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate depuis l'existant
  useEffect(() => {
    if (settings) setDraftSettings(settings);
  }, [settings]);
  useEffect(() => {
    if (!briefing) return;
    setWindDir(briefing.wind_direction_deg);
    setWindSpeed(briefing.wind_speed_kt != null ? String(briefing.wind_speed_kt) : '');
    setSensDeg(briefing.sens_atterrissage_deg);
    setSensTouched(briefing.sens_atterrissage_deg !== briefing.wind_direction_deg);
    setSide(briefing.circuit_side);
    setAltitude(briefing.altitude_debut_circuit_m);
    setConsignes(briefing.consignes ?? '');
    setHazards(briefing.hazards);
  }, [briefing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sens d'atterrissage pré-calculé face au vent tant que le DT n'y a pas touché
  useEffect(() => {
    if (!sensTouched) setSensDeg(windDir);
  }, [windDir, sensTouched]);

  // URL signée du fond
  useEffect(() => {
    if (!draftSettings.image_fond_url) { setBgUrl(null); return; }
    getSignedUrl(draftSettings.image_fond_url).then(setBgUrl);
  }, [draftSettings.image_fond_url]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setError(null);
    const path = await uploadDocument(user.id, file, 'briefing-fond');
    if (!path) {
      console.error('Upload image de fond échoué');
      setError('Upload de l\'image échoué.');
      return;
    }
    setDraftSettings(s => ({ ...s, image_fond_url: path }));
  };

  const handleCanvasClick = (x: number, y: number) => {
    if (tool === 'lz') setDraftSettings(s => ({ ...s, lz_x: x, lz_y: y }));
    else if (tool === 'sock') setDraftSettings(s => ({ ...s, sock_x: x, sock_y: y }));
    else if (tool === 'hazard') {
      const label = window.prompt('Libellé du danger (ex : ligne électrique)');
      if (label) setHazards(h => [...h, { label, x, y }]);
    } else if (tool === 'nofly') {
      setPendingNoFly(p => [...p, { x, y }]);
    }
  };

  const finishNoFly = () => {
    if (pendingNoFly.length < 3) { setError('Une zone interdite nécessite au moins 3 points.'); return; }
    const label = window.prompt('Libellé de la zone (ex : base militaire — survol interdit)');
    if (!label) { setPendingNoFly([]); return; }
    setDraftSettings(s => ({ ...s, no_fly_zones: [...s.no_fly_zones, { label, points: pendingNoFly } as NoFlyZone] }));
    setPendingNoFly([]);
    setTool('aucun');
  };

  const saveSettings = async (): Promise<boolean> => {
    const { data: written, error } = await supabase
      .from('dz_settings')
      .upsert({
        dz_id: centreId,
        image_fond_url: draftSettings.image_fond_url,
        lz_x: draftSettings.lz_x, lz_y: draftSettings.lz_y,
        sock_x: draftSettings.sock_x, sock_y: draftSettings.sock_y,
        no_fly_zones: draftSettings.no_fly_zones,
        updated_at: new Date().toISOString(),
      })
      .select('dz_id');
    if (error || !written || written.length === 0) {
      console.error('Écriture dz_settings échouée :', error);
      setError(error?.message ?? 'Écriture des réglages refusée.');
      return false;
    }
    return true;
  };

  const publish = async () => {
    if (!user) return;
    if (draftSettings.lz_x == null) { setError('Placez d\'abord la zone de posé sur l\'image.'); return; }
    setSaving(true);
    setError(null);
    setPublishedMsg(null);

    const okSettings = await saveSettings();
    if (!okSettings) { setSaving(false); return; }

    const today = new Date().toISOString().substring(0, 10);
    // Republication le même jour = version + 1 (les acquittements précédents restent en base)
    const { data: lastV, error: vErr } = await supabase
      .from('dz_briefings')
      .select('version')
      .eq('dz_id', centreId)
      .eq('briefing_date', today)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vErr) {
      console.error('Lecture version briefing échouée :', vErr);
      setError(vErr.message);
      setSaving(false);
      return;
    }
    const version = (lastV?.version ?? 0) + 1;

    const { data: written, error } = await supabase
      .from('dz_briefings')
      .insert({
        dz_id: centreId,
        briefing_date: today,
        version,
        wind_direction_deg: windDir,
        wind_speed_kt: windSpeed.trim() === '' ? null : parseFloat(windSpeed.replace(',', '.')),
        sens_atterrissage_deg: sensDeg,
        circuit_side: side,
        altitude_debut_circuit_m: altitude,
        consignes: consignes.trim() || null,
        hazards,
        published_by: user.id,
      })
      .select('id');
    setSaving(false);
    if (error || !written || written.length === 0) {
      console.error('Publication briefing échouée :', error);
      setError(error?.message ?? 'Publication refusée — le briefing n\'a pas été enregistré.');
      return;
    }
    setPublishedMsg(`Briefing v${version} publié à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${version > 1 ? ' — les licenciés devront le relire' : ''}.`);
    refresh();
  };

  const previewBriefing = {
    wind_direction_deg: windDir,
    wind_speed_kt: windSpeed.trim() === '' ? null : parseFloat(windSpeed.replace(',', '.')),
    sens_atterrissage_deg: sensDeg,
    circuit_side: side,
    altitude_debut_circuit_m: altitude,
    hazards,
  };

  const tools: { key: EditTool; label: string; icon: React.ReactNode }[] = [
    { key: 'lz', label: 'Zone de posé', icon: <MapPin className="w-3.5 h-3.5" /> },
    { key: 'sock', label: 'Manche à air', icon: <WindIcon className="w-3.5 h-3.5" /> },
    { key: 'hazard', label: 'Danger', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { key: 'nofly', label: 'Zone interdite', icon: <Ban className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Megaphone className="w-6 h-6" style={{ color: '#F97316' }} /> Briefing du jour</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
            L'appli propose (vent, circuit) — vous confirmez et publiez. Elle informe et trace, elle ne bloque jamais personne.
          </p>
        </div>
        <a href={`/briefing/tv/${centreId}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg no-underline"
          style={{ background: 'var(--c-border)', color: 'var(--c-text2)', border: '1px solid var(--c-border-f)' }}>
          <ExternalLink className="w-3.5 h-3.5" /> Mode TV
        </a>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          ⚠️ {error}
        </div>
      )}
      {publishedMsg && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6EE7B7' }}>
          ✅ {publishedMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Scène (aperçu en direct, mode edit) */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--c-border)', color: 'var(--c-text2)', border: '1px solid var(--c-border-f)' }}>
              <Upload className="w-3.5 h-3.5" /> Photo satellite
            </button>
            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
            <span className="text-xs mr-1" style={{ color: 'var(--c-dim)' }}>Placer :</span>
            {tools.map(t => (
              <button key={t.key} onClick={() => setTool(tool === t.key ? 'aucun' : t.key)}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                style={{
                  background: tool === t.key ? 'rgba(249,115,22,0.15)' : 'var(--c-border)',
                  color: tool === t.key ? '#F97316' : 'var(--c-muted)',
                  border: `1px solid ${tool === t.key ? 'rgba(249,115,22,0.4)' : 'var(--c-border-f)'}`,
                }}>
                {t.icon} {t.label}
              </button>
            ))}
            {tool === 'nofly' && (
              <button onClick={finishNoFly} className="text-xs font-bold px-2.5 py-1.5 rounded-lg text-white" style={{ background: '#EF4444' }}>
                Terminer la zone ({pendingNoFly.length} pts)
              </button>
            )}
          </div>

          <BriefingScene
            briefing={previewBriefing}
            settings={{
              ...draftSettings,
              // Aperçu du polygone en cours de tracé
              no_fly_zones: pendingNoFly.length >= 3
                ? [...draftSettings.no_fly_zones, { label: '(en cours)', points: pendingNoFly }]
                : draftSettings.no_fly_zones,
            }}
            backgroundUrl={bgUrl}
            mode="edit"
            onCanvasClick={handleCanvasClick}
          />
          {draftSettings.no_fly_zones.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {draftSettings.no_fly_zones.map((z, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                  ⛔ {z.label}
                  <button onClick={() => setDraftSettings(s => ({ ...s, no_fly_zones: s.no_fly_zones.filter((_, j) => j !== i) }))} aria-label={`Supprimer ${z.label}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {hazards.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {hazards.map((h, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' }}>
                  ⚠ {h.label}
                  <button onClick={() => setHazards(hs => hs.filter((_, j) => j !== i))} aria-label={`Supprimer ${h.label}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Panneau de réglage */}
        <div className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>
              Vent : d'où il vient — {windDir}°
            </label>
            <input type="range" min={0} max={359} value={windDir}
              onChange={e => setWindDir(parseInt(e.target.value, 10))} className="w-full" />
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-dim)' }}>
              À confirmer manuellement — la météo du planning n'est qu'une indication.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>Vitesse (kt, optionnel)</label>
            <input type="number" min={0} style={inputStyle} value={windSpeed} onChange={e => setWindSpeed(e.target.value)} placeholder="ex : 12" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>
              Sens d'atterrissage — {sensDeg}° {sensTouched ? '(modifié)' : '(face au vent)'}
            </label>
            <input type="range" min={0} max={359} value={sensDeg}
              onChange={e => { setSensDeg(parseInt(e.target.value, 10)); setSensTouched(true); }} className="w-full" />
            {sensTouched && (
              <button className="text-[11px] underline mt-0.5" style={{ color: '#60A5FA' }}
                onClick={() => { setSensTouched(false); setSensDeg(windDir); }}>
                Revenir face au vent
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--c-text2)' }}>Circuit</label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border-f)' }}>
              {(['main_gauche', 'main_droite'] as const).map(s => (
                <button key={s} onClick={() => setSide(s)}
                  className="flex-1 py-2 text-xs font-semibold transition"
                  style={{ background: side === s ? '#2563EB' : 'transparent', color: side === s ? 'white' : 'var(--c-muted)' }}>
                  {s === 'main_gauche' ? 'Main gauche' : 'Main droite'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>Début de circuit (m)</label>
            <input type="number" min={100} step={50} style={inputStyle} value={altitude}
              onChange={e => setAltitude(parseInt(e.target.value, 10) || 300)} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>Consignes du jour</label>
            <textarea rows={4} style={inputStyle} value={consignes} onChange={e => setConsignes(e.target.value)}
              placeholder="ex : trafic planeurs au nord, séparation 5 s mini…" />
          </div>
          <button onClick={publish} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: '#F97316', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
            {saving ? 'Publication…' : briefing ? `Republier (v${briefing.version + 1})` : 'Publier le briefing'}
          </button>
          {briefing && (
            <p className="text-[11px] text-center" style={{ color: 'var(--c-dim)' }}>
              Dernière publication : v{briefing.version} à {new Date(briefing.published_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
