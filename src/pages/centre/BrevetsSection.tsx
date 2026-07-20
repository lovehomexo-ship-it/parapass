import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import {
  useReferentielBrevets, useValidationStaff, epreuvesBrevetCompletes,
  TYPE_EPREUVE_LABELS, type Epreuve, type ProgressionEpreuve,
} from '../../lib/brevetsProgression';
import { GraduationCap, Check, X, Plus, Award } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
};

/** Module brevets côté moniteur/DT : file de validation, avancement des élèves,
 *  délivrance explicite, et saisie du référentiel (contenu officiel FFP). */
export function BrevetsSection({ centreId }: { centreId: string }) {
  const { profile } = useAuth();
  const referentiel = useReferentielBrevets();
  const staff = useValidationStaff(centreId);
  const [onglet, setOnglet] = useState<'file' | 'eleves' | 'referentiel'>('file');
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const enAttente = staff.rows.filter(r => r.statut === 'pret');

  const agir = async (row: typeof enAttente[0], action: 'valider' | 'echec') => {
    if (!profile) return;
    setError(null);
    const note = notes[row.id] ?? '';
    const err = action === 'valider'
      ? await staff.valider(row, note, profile.id)
      : await staff.marquerEchec(row, note, profile.id);
    if (err) setError(err);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GraduationCap className="w-6 h-6" style={{ color: '#F97316' }} /> Progression brevets
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
          L'élève se déclare prêt, le moniteur agréé valide, le DT supervise. Aucune validation automatique — l'humain acte, tout est tracé.
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="flex rounded-xl overflow-hidden w-fit" style={{ border: '1px solid var(--c-border-f)' }}>
        {([
          { key: 'file' as const, label: `File de validation${enAttente.length ? ` (${enAttente.length})` : ''}` },
          { key: 'eleves' as const, label: 'Élèves' },
          { key: 'referentiel' as const, label: 'Référentiel' },
        ]).map(t => (
          <button key={t.key} onClick={() => setOnglet(t.key)}
            className="px-4 py-2.5 text-sm font-semibold transition"
            style={{ background: onglet === t.key ? '#2563EB' : 'transparent', color: onglet === t.key ? 'white' : 'var(--c-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {!referentiel.renseigne && onglet !== 'referentiel' && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)', color: '#CBD5E1' }}>
          Référentiel en attente de la FFP — saisissez le contenu officiel des brevets dans l'onglet « Référentiel » dès qu'il est fourni. Rien n'est inventé d'ici là.
        </div>
      )}

      {/* ── File de validation : les élèves déclarés prêts ── */}
      {onglet === 'file' && (
        enAttente.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--c-dim)' }}>Aucun élève en attente de validation.</p>
        ) : (
          <div className="space-y-2">
            {enAttente.map(row => (
              <div key={row.id} className="rounded-xl p-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-sm font-bold text-white">{row.prenom} {row.nom}</span>
                  <span className="text-xs" style={{ color: '#FBBF24' }}>
                    {row.brevetCode ? `Brevet ${row.brevetCode} — ` : ''}{row.epreuve?.libelle ?? 'épreuve supprimée'}
                    {row.epreuve && row.epreuve.quantite_requise > 1 && ` (${row.quantite_faite}/${row.epreuve.quantite_requise})`}
                  </span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--c-dim)' }}>
                    prêt depuis le {row.declare_pret_at ? new Date(row.declare_pret_at).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input placeholder="Note du moniteur (optionnelle)" value={notes[row.id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [row.id]: e.target.value }))}
                    style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
                  <button onClick={() => agir(row, 'valider')}
                    className="flex items-center gap-1 text-xs font-bold px-3 rounded-lg text-white" style={{ background: '#10B981', minHeight: 40 }}>
                    <Check className="w-3.5 h-3.5" /> Valider
                  </button>
                  <button onClick={() => agir(row, 'echec')}
                    className="flex items-center gap-1 text-xs font-bold px-3 rounded-lg text-white" style={{ background: '#EF4444', minHeight: 40 }}>
                    <X className="w-3.5 h-3.5" /> Échec
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Avancement des élèves + délivrance ── */}
      {onglet === 'eleves' && (
        <ElevesAvancement centreId={centreId} referentiel={referentiel}
          onDelivrer={async (userId, brevetId, numero) => {
            if (!profile) return;
            setError(null);
            const err = await staff.delivrerBrevet(userId, brevetId, profile.id, numero);
            if (err) setError(err);
          }} />
      )}

      {/* ── Référentiel — c'est ici qu'entrera le contenu officiel FFP ── */}
      {onglet === 'referentiel' && <ReferentielEditor referentiel={referentiel} />}
    </div>
  );
}

// ─── Avancement des élèves + délivrance explicite ─────────────────────────────

function ElevesAvancement({ centreId, referentiel, onDelivrer }: {
  centreId: string;
  referentiel: ReturnType<typeof useReferentielBrevets>;
  onDelivrer: (userId: string, brevetId: string, numero: string | null) => Promise<void>;
}) {
  const [parEleve, setParEleve] = useState<Record<string, { nom: string; progressions: Record<string, ProgressionEpreuve> }>>({});
  const [delivres, setDelivres] = useState<Set<string>>(new Set()); // `${user}:${brevet}`
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: prog, error: pErr }, { data: valid, error: vErr }] = await Promise.all([
      supabase.from('progression_epreuves').select('*').eq('centre_id', centreId),
      supabase.from('validations_brevet').select('user_id, brevet_id').eq('centre_id', centreId),
    ]);
    if (pErr) { console.error('Chargement avancement échoué :', pErr); setLoading(false); return; }
    if (vErr) console.error('Chargement délivrances échoué :', vErr);
    const list = (prog ?? []) as ProgressionEpreuve[];
    const userIds = [...new Set(list.map(p => p.user_id))];
    let noms: Record<string, string> = {};
    if (userIds.length) {
      const { data: pr } = await supabase.from('profiles').select('id, nom, prenom').in('id', userIds);
      noms = Object.fromEntries((pr ?? []).map(p => [p.id, `${p.prenom} ${p.nom}`]));
    }
    const map: typeof parEleve = {};
    for (const p of list) {
      (map[p.user_id] ??= { nom: noms[p.user_id] ?? '?', progressions: {} }).progressions[p.epreuve_id] = p;
    }
    setParEleve(map);
    setDelivres(new Set((valid ?? []).map(v => `${v.user_id}:${v.brevet_id}`)));
    setLoading(false);
  };
  useEffect(() => { load(); }, [centreId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;
  const eleves = Object.entries(parEleve);
  if (eleves.length === 0) return <p className="text-sm py-6 text-center" style={{ color: 'var(--c-dim)' }}>Aucun élève engagé dans une progression.</p>;

  return (
    <div className="space-y-2">
      {eleves.map(([userId, { nom, progressions }]) => (
        <div key={userId} className="rounded-xl p-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <p className="text-sm font-bold text-white mb-1.5">{nom}</p>
          <div className="flex flex-wrap gap-2">
            {referentiel.brevets.map(b => {
              const eps = referentiel.epreuvesDe(b.id);
              if (eps.length === 0) return null;
              const validees = eps.filter(e => progressions[e.id]?.statut === 'validee').length;
              const dejaDelivre = delivres.has(`${userId}:${b.id}`);
              // Côté staff : signal sur les épreuves ; les conditions calculées
              // (sauts, âge, brevets requis) sont vérifiées par l'humain avant de délivrer
              const pret = !dejaDelivre && epreuvesBrevetCompletes(b, referentiel.epreuves, progressions);
              return (
                <span key={b.id} className="text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${pret ? 'rgba(251,191,36,0.4)' : 'var(--c-border)'}`, color: 'var(--c-text2)' }}>
                  {b.code} : {validees}/{eps.length}
                  {dejaDelivre && <span style={{ color: '#34D399' }}>délivré ✓</span>}
                  {pret && (
                    <button
                      onClick={() => {
                        const numero = window.prompt('Numéro officiel FFP (optionnel — À DÉFINIR AVEC LA FFP)') || null;
                        onDelivrer(userId, b.id, numero).then(load);
                      }}
                      className="font-bold px-2 py-0.5 rounded text-white inline-flex items-center gap-1"
                      style={{ background: '#F97316' }}>
                      <Award className="w-3 h-3" /> Délivrer
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Éditeur de référentiel — le contenu FFP est de la donnée, pas du code ────

function ReferentielEditor({ referentiel }: { referentiel: ReturnType<typeof useReferentielBrevets> }) {
  const [brevetSel, setBrevetSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ libelle: '', type: 'saut' as Epreuve['type'], quantite: '1', obligatoire: true, prerequis: '', description: '' });

  useEffect(() => {
    if (!brevetSel && referentiel.brevets.length > 0) setBrevetSel(referentiel.brevets[0].id);
  }, [referentiel.brevets, brevetSel]);

  const eps = brevetSel ? referentiel.epreuvesDe(brevetSel) : [];

  const ajouter = async () => {
    if (!brevetSel || !form.libelle.trim()) { setError('Libellé de l\'épreuve requis.'); return; }
    setError(null);
    const { data: written, error } = await supabase.from('epreuves').insert({
      brevet_id: brevetSel,
      libelle: form.libelle.trim(),
      type: form.type,
      obligatoire: form.obligatoire,
      quantite_requise: parseInt(form.quantite, 10) || 1,
      ordre: eps.length + 1,
      prerequis_epreuve_id: form.prerequis || null,
      description: form.description.trim() || null,
    }).select('id');
    if (error || !written || written.length === 0) {
      console.error('Ajout épreuve échoué :', error);
      setError(error?.message ?? 'L\'épreuve n\'a pas pu être ajoutée.');
      return;
    }
    setForm({ libelle: '', type: 'saut', quantite: '1', obligatoire: true, prerequis: '', description: '' });
    referentiel.refresh();
  };

  const supprimer = async (id: string) => {
    if (!window.confirm('Supprimer cette épreuve du référentiel ? Les progressions associées seront supprimées.')) return;
    const { data: written, error } = await supabase.from('epreuves').delete().eq('id', id).select('id');
    if (error || !written || written.length === 0) {
      console.error('Suppression épreuve échouée :', error);
      setError(error?.message ?? 'Suppression refusée.');
      return;
    }
    referentiel.refresh();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
        Saisissez ici le contenu officiel des brevets tel que défini par la FFP — épreuves, types, quantités, prérequis.
        Les valeurs inconnues restent « À DÉFINIR AVEC LA FFP » : n'inventez rien.
      </p>
      {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>}

      <div className="flex gap-1.5 flex-wrap">
        {referentiel.brevets.map(b => (
          <button key={b.id} onClick={() => setBrevetSel(b.id)}
            className="text-sm font-bold px-4 py-2 rounded-lg"
            style={{ background: brevetSel === b.id ? '#F97316' : 'var(--c-border)', color: brevetSel === b.id ? 'white' : 'var(--c-muted)' }}>
            {b.code}
          </button>
        ))}
      </div>

      {/* Règles de prérequis du brevet (l'arbre FFP : brevets requis, seuils, âge…) */}
      {brevetSel && referentiel.reglesDe(brevetSel).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {referentiel.reglesDe(brevetSel).map(r => (
            <span key={r.id} className="text-[11px] px-2.5 py-1 rounded-full" title={r.source ?? undefined}
              style={{ background: 'rgba(167,139,250,0.1)', color: '#C4B5FD', border: '1px solid rgba(167,139,250,0.3)' }}>
              {r.description ?? r.type_regle}
            </span>
          ))}
        </div>
      )}

      {eps.length === 0 ? (
        <p className="text-sm py-3" style={{ color: '#FBBF24' }}>Épreuves de ce brevet : À DÉFINIR AVEC LA FFP.</p>
      ) : (
        <div className="space-y-1.5">
          {eps.map(e => (
            <div key={e.id} className="flex items-center gap-2 flex-wrap rounded-lg px-3 py-2" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              <span className="text-sm font-semibold text-white">{e.libelle}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA' }}>{TYPE_EPREUVE_LABELS[e.type]}</span>
              {e.quantite_requise > 1 && <span className="text-xs" style={{ color: 'var(--c-text2)' }}>× {e.quantite_requise}</span>}
              {!e.obligatoire && <span className="text-xs" style={{ color: 'var(--c-dim)' }}>optionnelle</span>}
              {e.prerequis_epreuve_id && (
                <span className="text-xs" style={{ color: 'var(--c-dim)' }}>
                  après « {referentiel.epreuves.find(x => x.id === e.prerequis_epreuve_id)?.libelle ?? '?'} »
                </span>
              )}
              <button onClick={() => supprimer(e.id)} className="ml-auto text-xs" style={{ color: 'var(--c-dim)' }} aria-label={`Supprimer ${e.libelle}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ajout d'une épreuve */}
      <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <p className="text-xs font-bold text-white flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Ajouter une épreuve</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <input placeholder="Libellé officiel (ex : Précision d'atterrissage)" value={form.libelle}
            onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} style={inputStyle} />
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Epreuve['type'] }))} style={inputStyle}>
            {Object.entries(TYPE_EPREUVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" min={1} placeholder="Quantité requise" value={form.quantite}
            onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} style={inputStyle} />
          <select value={form.prerequis} onChange={e => setForm(f => ({ ...f, prerequis: e.target.value }))} style={inputStyle}>
            <option value="">Sans prérequis d'épreuve</option>
            {eps.map(e => <option key={e.id} value={e.id}>Après : {e.libelle}</option>)}
          </select>
        </div>
        <textarea placeholder="Consigne officielle FFP (description)" rows={2} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
        <label className="text-xs flex items-center gap-2" style={{ color: 'var(--c-text2)' }}>
          <input type="checkbox" checked={form.obligatoire} onChange={e => setForm(f => ({ ...f, obligatoire: e.target.checked }))} />
          Obligatoire pour l'obtention du brevet
        </label>
        <button onClick={ajouter} className="text-sm font-bold px-4 py-2.5 rounded-lg text-white" style={{ background: '#2563EB' }}>
          Ajouter au référentiel
        </button>
      </div>
    </div>
  );
}
