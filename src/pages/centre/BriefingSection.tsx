import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BriefingScene } from '../../components/BriefingScene';
import {
  useBriefingDuJour, useDzCircuits, dzMapPublicUrl, sensAtterrissageDerive, compressImageFond,
  type DzCircuit, type DzSettings, type Point, type ZonePolygone,
} from '../../lib/briefing';
import { Upload, Megaphone, MapPin, Route, Shapes, Ban, Trash2, Undo2, AlertTriangle, Plus, Pencil, Wind as WindIcon, ExternalLink } from 'lucide-react';
import { BriefingSuiviDuJour, BriefingArchive } from './BriefingSuivi';

type EditTool = 'aucun' | 'trace' | 'lz' | 'zone_evolution' | 'sock' | 'obstacle' | 'nofly';

const inputStyle: React.CSSProperties = {
  background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
};

/** Écran DT : configuration des circuits (tracés fixes) + publication du briefing du jour. */
export function BriefingSection({ centreId }: { centreId: string }) {
  const { settings: savedSettings, briefing, refresh } = useBriefingDuJour(centreId);
  const { circuits, save: saveCircuit, remove: removeCircuit, refresh: refreshCircuits } = useDzCircuits(centreId);

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
  // Objet sélectionné par tap sur la carte (surbrillance + bouton Supprimer hors carte)
  const [selectedObject, setSelectedObject] = useState<{ kind: 'nofly' | 'obstacle' | 'evolution' | 'sock'; index: number } | null>(null);

  // ── Briefing du jour ──
  const [ventDir, setVentDir] = useState(270);
  const [ventVitesse, setVentVitesse] = useState('');
  const [circuitActifId, setCircuitActifId] = useState<string | null>(null);
  const [consignes, setConsignes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [ongletActif, setOngletActif] = useState<'reglage' | 'suivi' | 'archive'>('reglage');
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
    // Compression côté client (WebP ~1600 px, < 400 Ko) : indispensable pour
    // que le fond charge sur mobile en réseau faible.
    let compressed: Awaited<ReturnType<typeof compressImageFond>>;
    try {
      compressed = await compressImageFond(file);
    } catch (err) {
      console.error('Compression image de fond échouée :', err);
      setError('Image illisible — choisissez un fichier image (JPEG, PNG…).');
      return;
    }
    // Nom stable : {dz_id}/fond.{ext} — le remplacement écrase, le cache est invalidé via ?v=
    const path = `${centreId}/fond.${compressed.ext}`;
    const { error: upErr } = await supabase.storage.from('dz-maps')
      .upload(path, compressed.blob, { upsert: true, cacheControl: '31536000', contentType: compressed.blob.type });
    if (upErr) {
      console.error('Upload image de fond échoué :', upErr);
      setError(`Upload échoué : ${upErr.message}`);
      return;
    }
    const next = {
      ...draftSettings,
      image_fond_path: path,
      image_fond_largeur: compressed.width,
      image_fond_hauteur: compressed.height,
    };
    setDraftSettings(next);
    setImgVersion(String(Date.now()));
    const ok = await persistSettings(next);
    if (ok) {
      setOkMsg(`Photo compressée (${Math.round(compressed.blob.size / 1024)} Ko) et enregistrée.`);
      setTimeout(() => setOkMsg(null), 4000);
    }
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

  // ── Sélection / suppression d'objets sur la carte ──

  const pointInPolygon = (x: number, y: number, poly: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  /** Hit-test au tap (outil « aucun ») : du dessus vers le dessous —
   *  manche à air, zone d'évolution, obstacles, zones interdites. */
  const hitTest = (x: number, y: number): typeof selectedObject => {
    if (draftSettings.sock_x != null && draftSettings.sock_y != null
      && Math.hypot(draftSettings.sock_x - x, draftSettings.sock_y - y) < 5) {
      return { kind: 'sock', index: 0 };
    }
    if (draftCircuit?.zone_evolution && pointInPolygon(x, y, draftCircuit.zone_evolution)) {
      return { kind: 'evolution', index: 0 };
    }
    for (let i = draftSettings.obstacles.length - 1; i >= 0; i--) {
      if (pointInPolygon(x, y, draftSettings.obstacles[i].points)) return { kind: 'obstacle', index: i };
    }
    for (let i = draftSettings.no_fly_zones.length - 1; i >= 0; i--) {
      if (pointInPolygon(x, y, draftSettings.no_fly_zones[i].points)) return { kind: 'nofly', index: i };
    }
    return null;
  };

  /** Suppressions — état local immédiat, écriture derrière avec erreur explicite. */
  const deleteObstacle = async (i: number) => {
    const next = { ...draftSettings, obstacles: draftSettings.obstacles.filter((_, j) => j !== i) };
    setDraftSettings(next);
    await persistSettings(next);
  };
  const deleteNoFly = async (i: number) => {
    const next = { ...draftSettings, no_fly_zones: draftSettings.no_fly_zones.filter((_, j) => j !== i) };
    setDraftSettings(next);
    await persistSettings(next);
  };
  const deleteSock = async () => {
    const next = { ...draftSettings, sock_x: null, sock_y: null };
    setDraftSettings(next);
    await persistSettings(next);
  };
  const deleteZoneEvolution = async () => {
    if (!draftCircuit) return;
    const updated = { ...draftCircuit, zone_evolution: null };
    setDraftCircuit(updated);
    const err = await saveCircuit(updated); // enregistrement immédiat, pas d'état fantôme
    if (err) setError(err);
  };
  const deleteSelected = async () => {
    if (!selectedObject) return;
    if (selectedObject.kind === 'sock') await deleteSock();
    else if (selectedObject.kind === 'evolution') await deleteZoneEvolution();
    else if (selectedObject.kind === 'obstacle') await deleteObstacle(selectedObject.index);
    else await deleteNoFly(selectedObject.index);
    setSelectedObject(null);
  };
  const selectedLabel = selectedObject
    ? selectedObject.kind === 'sock' ? 'la manche à air'
    : selectedObject.kind === 'evolution' ? 'la zone d\'évolution'
    : selectedObject.kind === 'obstacle' ? `l'obstacle « ${draftSettings.obstacles[selectedObject.index]?.nom ?? '?'} »`
    : `la zone « ${draftSettings.no_fly_zones[selectedObject.index]?.nom ?? '?'} »`
    : null;

  // ── Interactions scène ──
  const handleCanvasTap = (x: number, y: number) => {
    if (tool === 'aucun') {
      setSelectedObject(hitTest(x, y));
      return;
    }
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
  // Le circuit publié est TOUJOURS circuitActifId (cartes « Circuit qui sera
  // publié aujourd'hui ») — jamais editCircuitId (sélecteur d'édition).
  const publish = async () => {
    if (!circuitActifId) { setError('Sélectionnez le circuit qui sera publié aujourd\'hui.'); return; }
    const circuitPublie = circuits.find(c => c.id === circuitActifId);
    if (!circuitPublie) { setError('Circuit introuvable — resélectionnez le circuit à publier.'); return; }
    // Confirmation : le DT valide en connaissance de cause ce qui part réellement
    const recap = `Vous publiez le circuit « ${circuitPublie.nom} », vent ${ventDir}°${ventVitesse.trim() ? ` · ${ventVitesse} kt` : ''}${consignes.trim() ? ', avec consignes' : ', sans consigne'}. Confirmer ?`;
    if (!window.confirm(recap)) return;
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
    setOkMsg(`Briefing publié à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — circuit « ${circuitPublie.nom} ».`);
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

      {/* Onglets : réglage / suivi / archive */}
      <div className="flex rounded-xl overflow-hidden w-fit" style={{ border: '1px solid var(--c-border-f)' }}>
        {([
          { key: 'reglage' as const, label: 'Réglage & publication' },
          { key: 'suivi' as const, label: 'Suivi du jour' },
          { key: 'archive' as const, label: 'Archive' },
        ]).map(t => (
          <button key={t.key} onClick={() => setOngletActif(t.key)}
            className="px-4 py-2.5 text-sm font-semibold transition"
            style={{ background: ongletActif === t.key ? '#2563EB' : 'transparent', color: ongletActif === t.key ? 'white' : 'var(--c-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {ongletActif === 'suivi' && <BriefingSuiviDuJour centreId={centreId} />}
      {ongletActif === 'archive' && <BriefingArchive centreId={centreId} circuits={circuits} />}

      {ongletActif === 'reglage' && (
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

            {/* Sélecteur du circuit à ÉDITER (≠ du circuit publié, choisi à droite) */}
            <span className="text-xs ml-2 font-semibold" style={{ color: 'var(--c-text2)' }}>✏️ Circuit en cours d'édition :</span>
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
            selectedObject={selectedObject}
          />

          {/* Objet sélectionné au tap : suppression directe (hors carte, insensible aux superpositions) */}
          {selectedObject && selectedLabel && (
            <div className="flex items-center gap-2 mt-2 rounded-xl px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span className="text-xs text-white flex-1">Sélection : {selectedLabel}</span>
              <button onClick={deleteSelected}
                className="flex items-center gap-1.5 text-xs font-bold px-3 rounded-lg text-white"
                style={{ background: '#EF4444', minHeight: 40 }}>
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
              <button onClick={() => setSelectedObject(null)} className="text-xs px-2" style={{ color: 'var(--c-muted)', minHeight: 40 }}>
                Annuler
              </button>
            </div>
          )}

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

          {/* Objets de la carte — une pastille par objet, toutes supprimables de la
              même manière (insensible aux superpositions sur la carte) */}
          <div className="flex flex-wrap gap-2 mt-3">
            {draftCircuit?.zone_evolution && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(167,139,250,0.1)', color: '#C4B5FD', border: '1px solid rgba(167,139,250,0.3)' }}>
                Zone d'évolution ({draftCircuit.nom})
                <button onClick={deleteZoneEvolution} aria-label="Supprimer la zone d'évolution" style={{ minWidth: 24, minHeight: 24 }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            )}
            {draftSettings.sock_x != null && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(226,232,240,0.08)', color: '#E2E8F0', border: '1px solid rgba(226,232,240,0.25)' }}>
                Manche à air
                <button onClick={deleteSock} aria-label="Supprimer la manche à air" style={{ minWidth: 24, minHeight: 24 }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            )}
            {draftSettings.obstacles.map((z, i) => (
              <span key={`o${i}`} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(56,189,248,0.1)', color: '#7DD3FC', border: '1px solid rgba(56,189,248,0.3)' }}>
                Obstacle : {z.nom}
                <button onClick={() => deleteObstacle(i)} aria-label={`Supprimer ${z.nom}`} style={{ minWidth: 24, minHeight: 24 }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
            {draftSettings.no_fly_zones.map((z, i) => (
              <span key={`n${i}`} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                ⛔ {z.nom}
                <button onClick={() => deleteNoFly(i)} aria-label={`Supprimer ${z.nom}`} style={{ minWidth: 24, minHeight: 24 }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
            {/* Circuits : coûteux à refaire → confirmation avant suppression */}
            {circuits.map(c => (
              <span key={c.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(251,191,36,0.08)', color: '#FDE68A', border: '1px solid rgba(251,191,36,0.3)' }}>
                Circuit : {c.nom}
                <button
                  onClick={async () => {
                    if (!window.confirm(`Supprimer le circuit « ${c.nom} » et son tracé (${c.trace.length} points) ? Cette action est définitive.`)) return;
                    const err = await removeCircuit(c.id);
                    if (err) { setError(err); return; }
                    if (editCircuitId === c.id) setEditCircuitId(null);
                    if (circuitActifId === c.id) setCircuitActifId(null);
                  }}
                  aria-label={`Supprimer le circuit ${c.nom}`}
                  style={{ minWidth: 24, minHeight: 24 }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
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
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: '#F97316' }}>
              Circuit qui sera publié aujourd'hui
            </label>
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

          <button onClick={publish} disabled={saving || !circuitActifId}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: '#F97316', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
            {saving
              ? 'Publication…'
              : circuitActif
              ? `Publier le briefing — circuit ${circuitActif.nom}`
              : 'Publier le briefing'}
          </button>
          {briefing && (
            <p className="text-[11px] text-center" style={{ color: 'var(--c-dim)' }}>
              Dernière publication : {new Date(briefing.published_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {' — '}{circuits.find(c => c.id === briefing.circuit_id)?.nom ?? 'circuit inconnu'}
            </p>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
