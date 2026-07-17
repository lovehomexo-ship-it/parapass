import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BriefingScene } from '../../components/BriefingScene';
import {
  useBriefingDuJour, useDzCircuits, dzMapPublicUrl, sensAtterrissageDerive,
  type DzCircuit, type DzSettings, type Point, type ZonePolygone,
} from '../../lib/briefing';
import { Upload, Megaphone, MapPin, Route, Shapes, Ban, Trash2, Undo2, AlertTriangle, Plus, Pencil, Wind as WindIcon, ExternalLink } from 'lucide-react';

type EditTool = 'aucun' | 'trace' | 'lz' | 'zone_evolution' | 'sock' | 'obstacle' | 'nofly';

const inputStyle: React.CSSProperties = {
  background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
};

/** Écran DT : configuration des circuits (tracés fixes) + publication du briefing du jour. */
export function BriefingSection({ centreId }: { centreId: string }) {
  const { settings: savedSettings, briefing, refresh } = useBriefingDuJour(centreId);
  const { circuits, save: saveCircuit, refresh: refreshCircuits } = useDzCircuits(centreId);

  // ── Réglages DZ (brouillon) ──
  const [draftSettings, setDraftSettings] = useState<DzSettings>({
    dz_id: centreId, image_fond_path: null, image_fond_largeur: null, image_fond_hauteur: null,
    sock_x: null, sock_y: null, no_fly_zones: [], obstacles: [],
  });
  const [imgVersion, setImgVersion] = useState('');

  // ── Circuit en cours d'édition (brouillon) ──
  const [editCircuitId, setEditCircuitId] = useState<string | null>(null);
  const [draftCircuit, setDraftCircuit] = useState<DzCircuit | null>(null);

  const [tool, setTool] = useState<EditTool>('aucun');
  const [pendingPolygon, setPendingPolygon] = useState<Point[]>([]);

  // ── Briefing du jour ──
  const [ventDir, setVentDir] = useState(270);
  const [ventVitesse, setVentVitesse] = useState('');
  const [circuitActifId, setCircuitActifId] = useState<string | null>(null);
  const [consignes, setConsignes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydratation
  useEffect(() => { if (savedSettings) setDraftSettings(savedSettings); }, [savedSettings]);
  useEffect(() => {
    if (!briefing) return;
    setVentDir(briefing.vent_direction_deg);
    setVentVitesse(briefing.vent_vitesse_kt != null ? String(briefing.vent_vitesse_kt) : '');
    setConsignes(briefing.consignes ?? '');
    setCircuitActifId(briefing.circuit_id);
  }, [briefing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Sélection par défaut du premier circuit
    if (!editCircuitId && circuits.length > 0) setEditCircuitId(circuits[0].id);
    if (!circuitActifId && circuits.length > 0) setCircuitActifId(circuits.find(c => c.actif)?.id ?? circuits[0].id);
  }, [circuits]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = circuits.find(c => c.id === editCircuitId);
    setDraftCircuit(c ? { ...c, trace: [...c.trace], zone_evolution: c.zone_evolution ? [...c.zone_evolution] : null } : null);
    setPendingPolygon([]);
  }, [editCircuitId, circuits]);

  const backgroundUrl = draftSettings.image_fond_path
    ? dzMapPublicUrl(draftSettings.image_fond_path, imgVersion || undefined)
    : null;

  // ── Image de fond : upload une seule fois, bouton « Remplacer » ensuite ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    // Dimensions natives pour le ratio du viewBox
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    }).catch(() => null);
    const ext = file.name.split('.').pop() ?? 'jpg';
    // Nom stable : {dz_id}/fond.{ext} — le remplacement écrase, le cache est invalidé via ?v=
    const path = `${centreId}/fond.${ext}`;
    const { error: upErr } = await supabase.storage.from('dz-maps')
      .upload(path, file, { upsert: true, cacheControl: '31536000' });
    if (upErr) {
      console.error('Upload image de fond échoué :', upErr);
      setError(`Upload échoué : ${upErr.message}`);
      return;
    }
    const next = {
      ...draftSettings,
      image_fond_path: path,
      image_fond_largeur: dims?.w ?? draftSettings.image_fond_largeur,
      image_fond_hauteur: dims?.h ?? draftSettings.image_fond_hauteur,
    };
    setDraftSettings(next);
    setImgVersion(String(Date.now()));
    await persistSettings(next);
  };

  const persistSettings = async (s: DzSettings): Promise<boolean> => {
    const { data: written, error } = await supabase.from('dz_settings').upsert({
      dz_id: centreId,
      image_fond_path: s.image_fond_path,
      image_fond_largeur: s.image_fond_largeur,
      image_fond_hauteur: s.image_fond_hauteur,
      sock_x: s.sock_x, sock_y: s.sock_y,
      no_fly_zones: s.no_fly_zones,
      obstacles: s.obstacles,
      updated_at: new Date().toISOString(),
    }).select('dz_id');
    if (error || !written || written.length === 0) {
      console.error('Écriture dz_settings échouée :', error);
      setError(error?.message ?? 'Écriture des réglages refusée.');
      return false;
    }
    return true;
  };

  // ── Interactions scène ──
  const handleCanvasTap = (x: number, y: number) => {
    if (tool === 'trace' && draftCircuit) {
      setDraftCircuit({ ...draftCircuit, trace: [...draftCircuit.trace, [x, y]] });
    } else if (tool === 'lz' && draftCircuit) {
      setDraftCircuit({ ...draftCircuit, lz_x: x, lz_y: y });
    } else if (tool === 'zone_evolution' || tool === 'obstacle' || tool === 'nofly') {
      setPendingPolygon(p => [...p, [x, y]]);
    } else if (tool === 'sock') {
      const next = { ...draftSettings, sock_x: x, sock_y: y };
      setDraftSettings(next);
      persistSettings(next);
    }
  };

  const handleMovePoint = (kind: 'trace' | 'zone', index: number, x: number, y: number) => {
    if (!draftCircuit) return;
    if (kind === 'trace') {
      const trace = [...draftCircuit.trace];
      trace[index] = [x, y];
      setDraftCircuit({ ...draftCircuit, trace });
    } else if (draftCircuit.zone_evolution) {
      const zone = [...draftCircuit.zone_evolution];
      zone[index] = [x, y];
      setDraftCircuit({ ...draftCircuit, zone_evolution: zone });
    }
  };

  const handleRemovePoint = (kind: 'trace' | 'zone', index: number) => {
    if (!draftCircuit) return;
    if (kind === 'trace') {
      setDraftCircuit({ ...draftCircuit, trace: draftCircuit.trace.filter((_, i) => i !== index) });
    } else if (draftCircuit.zone_evolution) {
      const zone = draftCircuit.zone_evolution.filter((_, i) => i !== index);
      setDraftCircuit({ ...draftCircuit, zone_evolution: zone.length >= 3 ? zone : null });
    }
  };

  const closePolygon = async () => {
    if (pendingPolygon.length < 3) { setError('Un polygone nécessite au moins 3 points.'); return; }
    if (tool === 'zone_evolution' && draftCircuit) {
      setDraftCircuit({ ...draftCircuit, zone_evolution: pendingPolygon });
    } else if (tool === 'obstacle' || tool === 'nofly') {
      const nom = window.prompt(tool === 'obstacle' ? 'Nom de l\'obstacle (ex : étang)' : 'Nom de la zone (ex : base militaire — survol interdit)');
      if (nom) {
        const zone: ZonePolygone = { nom, points: pendingPolygon };
        const next = tool === 'obstacle'
          ? { ...draftSettings, obstacles: [...draftSettings.obstacles, zone] }
          : { ...draftSettings, no_fly_zones: [...draftSettings.no_fly_zones, zone] };
        setDraftSettings(next);
        await persistSettings(next);
      }
    }
    setPendingPolygon([]);
    setTool('aucun');
  };

  // ── Sauvegarde explicite du circuit ──
  const handleSaveCircuit = async () => {
    if (!draftCircuit) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const err = await saveCircuit(draftCircuit);
    setSaving(false);
    if (err) { setError(err); return; }
    setOkMsg(`Circuit « ${draftCircuit.nom} » enregistré.`);
    setTimeout(() => setOkMsg(null), 3000);
  };

  const handleNewCircuit = async () => {
    const nom = window.prompt('Nom du nouveau circuit', `Circuit ${circuits.length + 1}`);
    if (!nom) return;
    setError(null);
    const err = await saveCircuit({ dz_id: centreId, nom, sens: 'main_gauche', trace: [], altitude_debut_m: 300, actif: true });
    if (err) { setError(err); return; }
    refreshCircuits();
  };

  const handleRename = async () => {
    if (!draftCircuit) return;
    const nom = window.prompt('Nouveau nom du circuit', draftCircuit.nom);
    if (!nom) return;
    setDraftCircuit({ ...draftCircuit, nom });
  };

  // ── Publication (upsert : une ligne par jour) ──
  const publish = async () => {
    if (!circuitActifId) { setError('Sélectionnez le circuit actif du jour.'); return; }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const today = new Date().toISOString().substring(0, 10);
    const { data: written, error } = await supabase
      .from('dz_briefings')
      .upsert({
        dz_id: centreId,
        date_briefing: today,
        circuit_id: circuitActifId,
        vent_direction_deg: ventDir,
        vent_vitesse_kt: ventVitesse.trim() === '' ? null : parseFloat(ventVitesse.replace(',', '.')),
        consignes: consignes.trim() || null,
        published_at: new Date().toISOString(),
      }, { onConflict: 'dz_id,date_briefing' })
      .select('id');
    setSaving(false);
    if (error || !written || written.length === 0) {
      console.error('Publication briefing échouée :', error);
      setError(error?.message ?? 'Publication refusée — le briefing n\'a pas été enregistré.');
      return;
    }
    setOkMsg(`Briefing publié à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);
    refresh();
  };

  const circuitActif = circuits.find(c => c.id === circuitActifId) ?? null;
  const sensDerive = draftCircuit ? sensAtterrissageDerive(draftCircuit.trace) : null;

  const tools: { key: EditTool; label: string; icon: React.ReactNode }[] = [
    { key: 'trace', label: 'Tracer le circuit', icon: <Route className="w-3.5 h-3.5" /> },
    { key: 'lz', label: 'Zone de posé', icon: <MapPin className="w-3.5 h-3.5" /> },
    { key: 'zone_evolution', label: 'Zone d\'évolution', icon: <Shapes className="w-3.5 h-3.5" /> },
    { key: 'sock', label: 'Manche à air', icon: <WindIcon className="w-3.5 h-3.5" /> },
    { key: 'obstacle', label: 'Obstacle', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { key: 'nofly', label: 'Zone interdite', icon: <Ban className="w-3.5 h-3.5" /> },
  ];
  const isPolygonTool = tool === 'zone_evolution' || tool === 'obstacle' || tool === 'nofly';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone className="w-6 h-6" style={{ color: '#F97316' }} /> Briefing du jour
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
          Les circuits sont tracés une fois, à la main, selon le terrain. Le vent détermine seulement lequel est actif aujourd'hui.
          L'appli informe et trace, elle ne bloque jamais personne.
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          ⚠️ {error}
        </div>
      )}
      {okMsg && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6EE7B7' }}>
          ✅ {okMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* ── Colonne scène + édition ── */}
        <div>
          {/* Image de fond */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: 'var(--c-border)', color: 'var(--c-text2)', border: '1px solid var(--c-border-f)' }}>
              <Upload className="w-3.5 h-3.5" /> {draftSettings.image_fond_path ? 'Remplacer la photo' : 'Photo satellite'}
            </button>
            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
            <a
              href="https://www.geoportail.gouv.fr/carte"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs no-underline"
              style={{ color: '#60A5FA' }}
              title="Ouvrir Géoportail (IGN) — photographies aériennes"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Trouver ma DZ sur Géoportail
            </a>

            {/* Sélecteur du circuit à ÉDITER */}
            <span className="text-xs ml-2" style={{ color: 'var(--c-dim)' }}>Éditer :</span>
            <select
              value={editCircuitId ?? ''}
              onChange={e => setEditCircuitId(e.target.value || null)}
              className="text-xs rounded-lg px-2 py-2"
              style={{ background: 'var(--c-border)', color: 'white', border: '1px solid var(--c-border-f)' }}
            >
              {circuits.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <button onClick={handleNewCircuit} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg"
              style={{ background: 'var(--c-border)', color: 'var(--c-text2)', border: '1px solid var(--c-border-f)' }}>
              <Plus className="w-3.5 h-3.5" /> Nouveau circuit
            </button>
            {draftCircuit && (
              <button onClick={handleRename} className="flex items-center gap-1 text-xs px-2 py-2 rounded-lg"
                style={{ color: 'var(--c-muted)' }} title="Renommer">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Outils */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {tools.map(t => (
              <button key={t.key} onClick={() => { setTool(tool === t.key ? 'aucun' : t.key); setPendingPolygon([]); }}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg"
                style={{
                  background: tool === t.key ? 'rgba(249,115,22,0.15)' : 'var(--c-border)',
                  color: tool === t.key ? '#F97316' : 'var(--c-muted)',
                  border: `1px solid ${tool === t.key ? 'rgba(249,115,22,0.4)' : 'var(--c-border-f)'}`,
                }}>
                {t.icon} {t.label}
              </button>
            ))}
            {tool === 'trace' && draftCircuit && draftCircuit.trace.length > 0 && (
              <button onClick={() => setDraftCircuit({ ...draftCircuit, trace: draftCircuit.trace.slice(0, -1) })}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-2 rounded-lg text-white" style={{ background: '#475569' }}>
                <Undo2 className="w-3.5 h-3.5" /> Annuler le dernier point
              </button>
            )}
            {isPolygonTool && (
              <button onClick={closePolygon} className="text-xs font-bold px-2.5 py-2 rounded-lg text-white" style={{ background: '#7C3AED' }}>
                Fermer la zone ({pendingPolygon.length} pts)
              </button>
            )}
          </div>
          {tool === 'trace' && (
            <p className="text-[11px] mb-2" style={{ color: 'var(--c-dim)' }}>
              Chaque tap ajoute un point (du début de circuit vers la zone de posé). Glissez un point pour le déplacer, appui long pour le supprimer.
            </p>
          )}

          <BriefingScene
            settings={draftSettings}
            circuit={draftCircuit}
            vent={{ direction_deg: ventDir, vitesse_kt: ventVitesse.trim() === '' ? null : parseFloat(ventVitesse.replace(',', '.')) }}
            backgroundUrl={backgroundUrl}
            mode="edit"
            onCanvasTap={handleCanvasTap}
            onMovePoint={handleMovePoint}
            onRemovePoint={handleRemovePoint}
            pendingPolygon={pendingPolygon}
          />

          {/* Édition circuit : altitude + enregistrement explicite */}
          {draftCircuit && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <label className="text-xs flex items-center gap-2" style={{ color: 'var(--c-text2)' }}>
                Début de circuit (m)
                <input type="number" min={0} step={50} value={draftCircuit.altitude_debut_m}
                  onChange={e => setDraftCircuit({ ...draftCircuit, altitude_debut_m: parseInt(e.target.value, 10) || 0 })}
                  className="w-24 rounded-lg px-2.5 py-2 text-sm text-white text-center outline-none"
                  style={{ background: 'var(--c-border)', border: '1px solid var(--c-border-f)' }} />
              </label>
              <label className="text-xs flex items-center gap-2" style={{ color: 'var(--c-text2)' }}>
                Sens
                <select value={draftCircuit.sens}
                  onChange={e => setDraftCircuit({ ...draftCircuit, sens: e.target.value as DzCircuit['sens'] })}
                  className="rounded-lg px-2 py-2 text-sm"
                  style={{ background: 'var(--c-border)', color: 'white', border: '1px solid var(--c-border-f)' }}>
                  <option value="main_gauche">Main gauche</option>
                  <option value="main_droite">Main droite</option>
                </select>
              </label>
              <label className="text-xs flex items-center gap-2" style={{ color: 'var(--c-text2)' }}>
                <input type="checkbox" checked={draftCircuit.actif}
                  onChange={e => setDraftCircuit({ ...draftCircuit, actif: e.target.checked })} />
                Actif
              </label>
              <button onClick={handleSaveCircuit} disabled={saving}
                className="ml-auto px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: '#2563EB' }}>
                {saving ? 'Enregistrement…' : 'Enregistrer le circuit'}
              </button>
            </div>
          )}

          {/* Zones enregistrées */}
          {(draftSettings.no_fly_zones.length > 0 || draftSettings.obstacles.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {draftSettings.obstacles.map((z, i) => (
                <span key={`o${i}`} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(56,189,248,0.1)', color: '#7DD3FC', border: '1px solid rgba(56,189,248,0.3)' }}>
                  {z.nom}
                  <button onClick={() => { const next = { ...draftSettings, obstacles: draftSettings.obstacles.filter((_, j) => j !== i) }; setDraftSettings(next); persistSettings(next); }} aria-label={`Supprimer ${z.nom}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {draftSettings.no_fly_zones.map((z, i) => (
                <span key={`n${i}`} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                  ⛔ {z.nom}
                  <button onClick={() => { const next = { ...draftSettings, no_fly_zones: draftSettings.no_fly_zones.filter((_, j) => j !== i) }; setDraftSettings(next); persistSettings(next); }} aria-label={`Supprimer ${z.nom}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Panneau de droite : le briefing du jour ── */}
        <div className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>
              Vent : d'où il vient — {ventDir}°
            </label>
            <input type="range" min={0} max={359} value={ventDir}
              onChange={e => setVentDir(parseInt(e.target.value, 10))} className="w-full" style={{ height: 28 }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>Vitesse (kt, optionnel)</label>
            <input type="number" min={0} style={inputStyle} value={ventVitesse} onChange={e => setVentVitesse(e.target.value)} placeholder="ex : 12" />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--c-text2)' }}>Circuit actif du jour</label>
            <div className="flex flex-col gap-1.5">
              {circuits.filter(c => c.actif).map(c => (
                <button key={c.id} onClick={() => setCircuitActifId(c.id)}
                  className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold text-left transition"
                  style={{
                    background: circuitActifId === c.id ? '#2563EB' : 'var(--c-border)',
                    color: circuitActifId === c.id ? 'white' : 'var(--c-muted)',
                    border: `1px solid ${circuitActifId === c.id ? '#2563EB' : 'var(--c-border-f)'}`,
                  }}>
                  {c.nom}
                  <span className="block text-[10px] font-normal opacity-70">
                    {c.sens === 'main_gauche' ? 'main gauche' : 'main droite'} · début {c.altitude_debut_m} m
                  </span>
                </button>
              ))}
              {circuits.filter(c => c.actif).length === 0 && (
                <p className="text-xs" style={{ color: 'var(--c-dim)' }}>Aucun circuit actif — tracez-en un d'abord.</p>
              )}
            </div>
          </div>

          {/* Sens d'atterrissage dérivé, lecture seule */}
          <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--c-border)', border: '1px solid var(--c-border-f)' }}>
            <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>Sens d'atterrissage (dérivé du tracé, indicatif)</p>
            <p className="text-sm font-bold text-white">
              {circuitActif && sensAtterrissageDerive(circuitActif.trace) !== null
                ? `${sensAtterrissageDerive(circuitActif.trace)}°`
                : '— (tracé incomplet)'}
            </p>
            {editCircuitId === circuitActifId && sensDerive !== null && draftCircuit && (
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-dim)' }}>Brouillon en cours : {sensDerive}°</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--c-text2)' }}>Consignes du jour</label>
            <textarea rows={4} style={inputStyle} value={consignes} onChange={e => setConsignes(e.target.value)}
              placeholder="ex : trafic planeurs au nord, séparation 5 s mini…" />
          </div>

          <button onClick={publish} disabled={saving}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: '#F97316', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
            {saving ? 'Publication…' : 'Publier le briefing'}
          </button>
          {briefing && (
            <p className="text-[11px] text-center" style={{ color: 'var(--c-dim)' }}>
              Dernière publication : {new Date(briefing.published_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
