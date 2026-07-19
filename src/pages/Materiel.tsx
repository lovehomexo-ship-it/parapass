import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { useDemo } from '../lib/useDemo';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { uploadDocument, getSignedUrl } from '../lib/usePassport';
import type { Materiel, Maintenance } from '../lib/types';
import { TYPE_MATERIEL_LABELS, TYPE_MAINTENANCE_LABELS } from '../lib/types';
import { Plus, Trash2, CreditCard as Edit3, Check, X, Upload, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { getComplianceStatus, useComplianceRules, getMaterielEcheance, type ComplianceRules } from '../lib/compliance';
import { ComplianceBadge } from '../components/ComplianceBadge';
import { ChargeAlaireCard } from '../components/ChargeAlaireCard';
import { AutoPliageBlock } from '../components/AutoPliage';
import { useDzMembre } from '../lib/briefing';

const darkInputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', width: '100%', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none' };

function ProgressStatus({ materiel, maintenances, rules }: { materiel: Materiel; maintenances: Maintenance[]; rules: ComplianceRules }) {
  const echeance = getMaterielEcheance(materiel, maintenances, rules);
  // Un secours ou un AAD sans aucune intervention connue : état inconnu (gris) — l'humain décide
  const status = getComplianceStatus(echeance, rules);
  return <ComplianceBadge status={status} echeance={echeance} />;
}

export function MaterielPage() {
  const { user } = useAuth();
  const { blockIfDemo } = useDemo();
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [maintenancesMap, setMaintenancesMap] = useState<Record<string, Maintenance[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showMaterielForm, setShowMaterielForm] = useState(false);
  const [editingMateriel, setEditingMateriel] = useState<string | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyMat = {
    type: 'parachute_principal' as Materiel['type'],
    marque: '', modele: '', numero_serie: '', date_fabrication: '', date_acquisition: '',
    statut: 'actif' as Materiel['statut'], notes: '', photo_url: null as string | null,
    taille_voile_ft2: '' as string,
  };
  const [matForm, setMatForm] = useState(emptyMat);
  const [matErrors, setMatErrors] = useState<{ marque?: string; modele?: string }>({});

  const emptyMaint = {
    type_maintenance: 'pliage_secours' as Maintenance['type_maintenance'],
    date_maintenance: '', prochain_echeance: '', technicien: '', centre: '', notes: '',
    document_url: null as string | null,
  };
  const [maintForm, setMaintForm] = useState(emptyMaint);
  const { rules } = useComplianceRules();
  const [writeError, setWriteError] = useState<string | null>(null);
  const mesDzs = useDzMembre(user?.id);

  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('materiels').select('*').eq('parachutiste_id', user.id).eq('statut', 'actif').order('created_at', { ascending: false });
    setMateriels(data ?? []);

    if (data && data.length > 0) {
      const ids = data.map((m) => m.id);
      const { data: maints } = await supabase.from('maintenances').select('*').in('materiel_id', ids).order('date_maintenance', { ascending: false });
      const map: Record<string, Maintenance[]> = {};
      for (const m of maints ?? []) {
        if (!map[m.materiel_id]) map[m.materiel_id] = [];
        map[m.materiel_id].push(m);
      }
      setMaintenancesMap(map);
    }
  };

  useEffect(() => { load(); }, [user]);

  const saveMateriel = async () => {
    if (!user || blockIfDemo()) return;
    const errs: { marque?: string; modele?: string } = {};
    if (!matForm.marque.trim()) errs.marque = 'La marque est obligatoire';
    if (!matForm.modele.trim()) errs.modele = 'Le modèle est obligatoire';
    setMatErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    const payload = {
      ...matForm,
      numero_serie: matForm.numero_serie || null,
      date_fabrication: matForm.date_fabrication || null,
      date_acquisition: matForm.date_acquisition || null,
      notes: matForm.notes || null,
      taille_voile_ft2: matForm.taille_voile_ft2 ? parseFloat(matForm.taille_voile_ft2) : null,
    };
    setWriteError(null);
    // .select() indispensable : sans lui, un blocage RLS renvoie error:null (écriture silencieuse)
    const { data: written, error } = editingMateriel
      ? await supabase.from('materiels').update(payload).eq('id', editingMateriel).select('id')
      : await supabase.from('materiels').insert({ ...payload, parachutiste_id: user.id }).select('id');
    setSaving(false);
    if (error || !written || written.length === 0) {
      console.error('Écriture matériel échouée :', error);
      setWriteError(error?.message ?? 'Écriture refusée — le matériel n\'a pas été enregistré.');
      return;
    }
    setShowMaterielForm(false);
    setEditingMateriel(null);
    setMatForm(emptyMat);
    load();
  };

  const deleteMateriel = async (id: string) => {
    if (blockIfDemo()) return;
    setWriteError(null);
    const { data: written, error } = await supabase.from('materiels').update({ statut: 'hors_service' }).eq('id', id).select('id');
    if (error || !written || written.length === 0) {
      console.error('Suppression matériel échouée :', error);
      setWriteError(error?.message ?? 'Suppression refusée.');
      return;
    }
    load();
  };

  const saveMaintenance = async (materielId: string) => {
    if (!user || blockIfDemo()) return;
    setSaving(true);
    setWriteError(null);
    const { data: written, error } = await supabase.from('maintenances').insert({
      ...maintForm,
      materiel_id: materielId,
      prochain_echeance: maintForm.prochain_echeance || null,
      centre: maintForm.centre || null,
      notes: maintForm.notes || null,
    }).select('id');
    setSaving(false);
    if (error || !written || written.length === 0) {
      console.error('Écriture maintenance échouée :', error);
      setWriteError(error?.message ?? 'Écriture refusée — la maintenance n\'a pas été enregistrée.');
      return;
    }
    setShowMaintenanceForm(null);
    setMaintForm(emptyMaint);
    load();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0] || blockIfDemo()) return;
    const path = await uploadDocument(user.id, e.target.files[0], 'materiels');
    if (path) setMatForm((f) => ({ ...f, photo_url: path }));
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0] || blockIfDemo()) return;
    const path = await uploadDocument(user.id, e.target.files[0], 'maintenances');
    if (path) setMaintForm((f) => ({ ...f, document_url: path }));
  };

  const viewDoc = async (url: string) => {
    const signed = await getSignedUrl(url);
    if (signed) window.open(signed, '_blank');
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6" style={{ background: '#001A4D', minHeight: '100vh' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>Mon Matériel</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Gérez vos équipements et maintenances</p>
          </div>
          <button
            onClick={() => { setShowMaterielForm(true); setEditingMateriel(null); setMatForm(emptyMat); }}
            className="flex items-center gap-2 bg-[#001A4D] text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>

        {/* Erreur d'écriture (toast inline) */}
        {writeError && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-3"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
            <span>⚠️ {writeError}</span>
            <button onClick={() => setWriteError(null)} style={{ color: '#FCA5A5' }}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Formulaire matériel */}
        {showMaterielForm && (
          <div className="rounded-xl p-5 border mb-4 space-y-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{editingMateriel ? 'Modifier' : 'Ajouter un équipement'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Type</label>
                <select style={darkInputStyle} value={matForm.type} onChange={(e) => setMatForm({ ...matForm, type: e.target.value as Materiel['type'] })}>
                  {Object.entries(TYPE_MATERIEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: matErrors.marque ? '#FCA5A5' : 'rgba(255,255,255,0.5)' }}>Marque *</label>
                <input style={{ ...darkInputStyle, ...(matErrors.marque ? { borderColor: '#EF4444' } : {}) }} value={matForm.marque} onChange={(e) => { setMatForm({ ...matForm, marque: e.target.value }); if (matErrors.marque) setMatErrors((er) => ({ ...er, marque: undefined })); }} />
                {matErrors.marque && <p className="text-red-400 text-xs mt-1">{matErrors.marque}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: matErrors.modele ? '#FCA5A5' : 'rgba(255,255,255,0.5)' }}>Modèle *</label>
                <input style={{ ...darkInputStyle, ...(matErrors.modele ? { borderColor: '#EF4444' } : {}) }} value={matForm.modele} onChange={(e) => { setMatForm({ ...matForm, modele: e.target.value }); if (matErrors.modele) setMatErrors((er) => ({ ...er, modele: undefined })); }} />
                {matErrors.modele && <p className="text-red-400 text-xs mt-1">{matErrors.modele}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>N° de série</label>
                <input style={darkInputStyle} value={matForm.numero_serie} onChange={(e) => setMatForm({ ...matForm, numero_serie: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Date fabrication</label>
                <input type="date" style={darkInputStyle} value={matForm.date_fabrication} onChange={(e) => setMatForm({ ...matForm, date_fabrication: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Date acquisition</label>
                <input type="date" style={darkInputStyle} value={matForm.date_acquisition} onChange={(e) => setMatForm({ ...matForm, date_acquisition: e.target.value })} />
              </div>
              {matForm.type === 'parachute_principal' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Surface voile (ft²)</label>
                  <input type="number" min="0" step="1" style={darkInputStyle} placeholder="ex : 170"
                    value={matForm.taille_voile_ft2} onChange={(e) => setMatForm({ ...matForm, taille_voile_ft2: e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Notes</label>
              <textarea style={darkInputStyle} rows={2} value={matForm.notes} onChange={(e) => setMatForm({ ...matForm, notes: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Photo (optionnel)</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF' }}>
                  <Upload className="w-4 h-4" /> Téléverser
                </button>
                {matForm.photo_url && <span className="text-xs flex items-center gap-1" style={{ color: '#4ADE80' }}><Check className="w-3 h-3" /> Photo jointe</span>}
                <input type="file" ref={photoRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveMateriel} disabled={saving} className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#001A4D' }}>
                <Check className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowMaterielForm(false)} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF' }}>
                <X className="w-4 h-4" /> Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste matériels */}
        <div className="space-y-3">
          {materiels.map((mat) => {
            const maints = maintenancesMap[mat.id] ?? [];
            const isExpanded = expanded === mat.id;
            return (
              <div key={mat.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}>
                          {TYPE_MATERIEL_LABELS[mat.type] || mat.type}
                        </span>
                      </div>
                      <div className="font-semibold" style={{ color: '#FFFFFF' }}>{mat.marque} {mat.modele}</div>
                      {mat.numero_serie && <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>N° {mat.numero_serie}</div>}
                      <div className="mt-2">
                        <ProgressStatus materiel={mat} maintenances={maints} rules={rules} />
                      </div>
                      {mat.type === 'parachute_secours' && (() => {
                        const lastPliage = maints
                          .filter(m => m.type_maintenance === 'pliage_secours')
                          .sort((a, b) => b.date_maintenance.localeCompare(a.date_maintenance))[0];
                        const echeanceIso = getMaterielEcheance(mat, maints, rules);
                        const isDepassee = echeanceIso ? new Date(echeanceIso) < new Date() : false;
                        return (
                          <div className="mt-1.5 space-y-0.5">
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                              Dernier pliage : <span style={{ color: lastPliage ? 'rgba(255,255,255,0.75)' : '#F87171' }}>{lastPliage ? new Date(lastPliage.date_maintenance).toLocaleDateString('fr-FR') : 'Non renseigné'}</span>
                            </div>
                            {echeanceIso && (
                              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                Prochaine échéance : <span style={{ color: isDepassee ? '#F87171' : '#4ADE80', fontWeight: 600 }}>{new Date(echeanceIso).toLocaleDateString('fr-FR')}{isDepassee ? ' ⚠️ dépassée' : ''}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {/* Charge alaire — consultatif, uniquement sur la voile principale */}
                      {mat.type === 'parachute_principal' && (
                        <>
                          <ChargeAlaireCard userId={user?.id} tailleVoileFt2={mat.taille_voile_ft2 ?? null} />
                          {/* État de pliage + déclaration d'auto-pliage */}
                          <AutoPliageBlock materielId={mat.id} userId={user?.id} centreId={mesDzs[0]?.id} />
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => { setEditingMateriel(mat.id); setMatForm({ type: mat.type, marque: mat.marque, modele: mat.modele, numero_serie: mat.numero_serie ?? '', date_fabrication: mat.date_fabrication ?? '', date_acquisition: mat.date_acquisition ?? '', statut: mat.statut, notes: mat.notes ?? '', photo_url: mat.photo_url, taille_voile_ft2: mat.taille_voile_ft2 != null ? String(mat.taille_voile_ft2) : '' }); setShowMaterielForm(true); }}
                        className="p-1.5 rounded transition" style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => setExpanded(isExpanded ? null : mat.id)}
                        className="p-1.5 rounded transition" style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteMateriel(mat.id)} className="p-1.5 rounded transition" style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Historique maintenance</h3>
                      <button
                        onClick={() => { setShowMaintenanceForm(mat.id); setMaintForm(emptyMaint); }}
                        className="flex items-center gap-1 text-xs text-white px-2.5 py-1 rounded-lg font-medium" style={{ background: '#EA580C' }}>
                        <Plus className="w-3 h-3" /> Ajouter
                      </button>
                    </div>

                    {/* Formulaire maintenance */}
                    {showMaintenanceForm === mat.id && (
                      <div className="rounded-lg p-3 mb-3 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Type</label>
                            <select style={darkInputStyle} value={maintForm.type_maintenance} onChange={(e) => setMaintForm({ ...maintForm, type_maintenance: e.target.value as Maintenance['type_maintenance'] })}>
                              {Object.entries(TYPE_MAINTENANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Technicien</label>
                            <input style={darkInputStyle} value={maintForm.technicien} onChange={(e) => setMaintForm({ ...maintForm, technicien: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Date intervention</label>
                            <input type="date" style={darkInputStyle} value={maintForm.date_maintenance} onChange={(e) => setMaintForm({ ...maintForm, date_maintenance: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Prochaine échéance</label>
                            <input type="date" style={darkInputStyle} value={maintForm.prochain_echeance} onChange={(e) => setMaintForm({ ...maintForm, prochain_echeance: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Centre</label>
                            <input style={darkInputStyle} value={maintForm.centre} onChange={(e) => setMaintForm({ ...maintForm, centre: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Certificat (PDF/image)</label>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => docRef.current?.click()}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF' }}>
                              <Upload className="w-3 h-3" /> Joindre
                            </button>
                            {maintForm.document_url && <span className="text-xs" style={{ color: '#4ADE80' }}>Fichier joint</span>}
                            <input type="file" ref={docRef} className="hidden" accept=".pdf,image/*" onChange={handleDocUpload} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveMaintenance(mat.id)} disabled={saving}
                            className="flex items-center gap-1 text-white px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#001A4D' }}>
                            <Check className="w-3 h-3" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                          <button onClick={() => setShowMaintenanceForm(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF' }}>
                            <X className="w-3 h-3" /> Annuler
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {maints.length > 0 ? (
                      <div className="relative pl-4 space-y-3">
                        <div className="absolute left-1.5 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        {maints.map((m) => (
                          <div key={m.id} className="relative">
                            <div className="absolute -left-[11px] top-1.5 w-2 h-2 rounded-full" style={{ background: '#EA580C' }} />
                            <div className="text-xs">
                              <div className="font-medium" style={{ color: '#FFFFFF' }}>{TYPE_MAINTENANCE_LABELS[m.type_maintenance] || m.type_maintenance}</div>
                              <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                                {new Date(m.date_maintenance).toLocaleDateString('fr-FR')} — {m.technicien}
                                {m.centre && ` — ${m.centre}`}
                              </div>
                              {m.prochain_echeance && (
                                <div style={{ color: 'rgba(255,255,255,0.4)' }}>Prochain : {new Date(m.prochain_echeance).toLocaleDateString('fr-FR')}</div>
                              )}
                              {m.document_url && (
                                <button onClick={() => viewDoc(m.document_url!)}
                                  className="flex items-center gap-1 mt-0.5" style={{ color: '#60A5FA' }}>
                                  <ExternalLink className="w-3 h-3" /> Certificat
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-center py-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune maintenance enregistrée</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {materiels.length === 0 && !showMaterielForm && (
            <div className="text-center py-12 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <p className="mb-2">Aucun équipement enregistré</p>
              <p className="text-xs">Ajoutez votre parachute, AAD, altimètre...</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
