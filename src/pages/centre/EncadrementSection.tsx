import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import {
  useEncadrement, verifierSeance, TYPE_SEANCE_LABELS,
  type SeanceJour, type MoniteurQualif,
} from '../../lib/encadrement';
import { useComplianceRules } from '../../lib/compliance';
import { ShieldCheck, CheckCircle, AlertTriangle, X, Plus, Users } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
};

/** « Encadrement du jour » : ai-je le droit d'ouvrir mes séances avec les gens
 *  présents ? L'outil signale (réglementaire / il manque X), le DT décide —
 *  aucune séance n'est verrouillée. Source des règles : Manuel FFP 2026 p.26-27. */
export function EncadrementSection({ centreId, vue }: { centreId: string; vue?: 'jour' | 'annuaire' }) {
  const { profile } = useAuth();
  const enc = useEncadrement(centreId);
  const { rules } = useComplianceRules();
  // `vue` fourni = sous-onglets gérés par le parent (Mon équipe) : vue forcée, barre interne masquée
  const [ongletLocal, setOngletLocal] = useState<'jour' | 'annuaire'>('jour');
  const onglet = vue ?? ongletLocal;

  if (enc.loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  const seuilJours = rules.qualif_expiration_alerte_jours ?? 60;
  const limite = new Date(Date.now() + seuilJours * 86_400_000);
  const aRenouveler = enc.moniteursQualifs.filter(q =>
    q.actif && q.date_expiration && new Date(q.date_expiration) <= limite);

  return (
    <div className="space-y-4">
      <div>
        {!vue && (
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" style={{ color: '#F97316' }} /> Encadrement du jour
          </h1>
        )}
        <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
          Présents × qualifications × règles FFP (Manuel 2026 p.26-27, paramétrables). L'outil signale, il n'interdit rien — vous restez seul décideur.
        </p>
      </div>

      {enc.error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          ⚠️ {enc.error}
        </div>
      )}

      {/* Qualifications à renouveler — anticipation, gain de temps pur */}
      {aRenouveler.length > 0 && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="text-xs font-bold mb-1" style={{ color: '#FCD34D' }}>Qualifications à renouveler (seuil {seuilJours} j, paramétrable)</p>
          <ul className="text-xs space-y-0.5" style={{ color: 'var(--c-text2)' }}>
            {aRenouveler.map(q => {
              const expiree = new Date(q.date_expiration!) < new Date();
              return (
                <li key={q.id}>
                  {enc.noms[q.user_id] ?? q.user_id} — {q.qualification_code}
                  <span style={{ color: expiree ? '#F87171' : '#FCD34D' }}>
                    {' '}{expiree ? 'expirée depuis le' : 'expire le'} {new Date(q.date_expiration!).toLocaleDateString('fr-FR')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!vue && (
        <div className="flex rounded-xl overflow-hidden w-fit" style={{ border: '1px solid var(--c-border-f)' }}>
          {([{ key: 'jour' as const, label: 'Séances du jour' }, { key: 'annuaire' as const, label: 'Annuaire moniteurs' }]).map(t => (
            <button key={t.key} onClick={() => setOngletLocal(t.key)}
              className="px-4 py-2.5 text-sm font-semibold transition"
              style={{ background: onglet === t.key ? '#2563EB' : 'transparent', color: onglet === t.key ? 'white' : 'var(--c-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {onglet === 'jour' && (
        <>
          {/* Ouvrir une séance — l'état se calcule aussitôt depuis les présents */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--c-dim)' }}>Ouvrir une séance :</span>
            {(['ecole', 'tandem', 'autonome'] as const).map(t => (
              <button key={t} onClick={() => profile && enc.ouvrirSeance(t, profile.id)}
                className="flex items-center gap-1 text-xs font-bold px-3 rounded-lg text-white"
                style={{ background: '#F97316', minHeight: 40 }}>
                <Plus className="w-3.5 h-3.5" /> {TYPE_SEANCE_LABELS[t]}
              </button>
            ))}
            <span className="text-xs ml-auto inline-flex items-center gap-1.5" style={{ color: 'var(--c-dim)' }}>
              <Users className="w-3.5 h-3.5" /> {enc.presents.length} présent{enc.presents.length > 1 ? 's' : ''} · recalcul en direct
            </span>
          </div>

          {enc.seances.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>Aucune séance ouverte aujourd'hui.</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-3">
              {enc.seances.map(seance => <CarteSeance key={seance.id} seance={seance} enc={enc} />)}
            </div>
          )}
        </>
      )}

      {onglet === 'annuaire' && <AnnuaireMoniteurs centreId={centreId} enc={enc} />}
    </div>
  );
}

// ─── Carte d'une séance : état global + détail des exigences ──────────────────

function CarteSeance({ seance, enc }: { seance: SeanceJour; enc: ReturnType<typeof useEncadrement> }) {
  const etats = verifierSeance(seance, enc.regles, enc.presents);
  const bloquantes = etats.filter(e => !e.regle.a_verifier);
  const complete = bloquantes.every(e => e.satisfaite);
  const manques = bloquantes.filter(e => !e.satisfaite);

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: `1.5px solid ${complete ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.45)'}` }}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h3 className="text-sm font-bold text-white">{TYPE_SEANCE_LABELS[seance.type_seance]}</h3>
        {complete ? (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>
            <CheckCircle className="w-3 h-3" /> Encadrement réglementaire
          </span>
        ) : (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.35)' }}>
            <AlertTriangle className="w-3 h-3" /> Encadrement incomplet : {manques.length} exigence{manques.length > 1 ? 's' : ''}
          </span>
        )}
        <button onClick={() => enc.fermerSeance(seance.id)} className="ml-auto p-1" title="Fermer la séance" aria-label="Fermer la séance"
          style={{ color: 'var(--c-dim)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5 mt-2">
        {etats.map(({ regle, satisfaite, rempliePar, expires }) => (
          <div key={regle.id} className="flex items-start gap-2 text-xs" title={regle.source_ref ?? undefined}>
            {regle.a_verifier
              ? <span className="flex-shrink-0 mt-0.5">👤</span>
              : satisfaite
              ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#34D399' }} />
              : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#FCD34D' }} />}
            <div className="min-w-0">
              <span style={{ color: 'var(--c-text2)' }}>{regle.libelle_exigence}</span>
              {satisfaite && rempliePar.length > 0 && (
                <span style={{ color: '#34D399' }}> — {rempliePar.slice(0, regle.quantite_min + 1).join(', ')}</span>
              )}
              {!satisfaite && !regle.a_verifier && (
                <span style={{ color: '#FCD34D' }}> — manque {Math.max(0, regle.quantite_min - rempliePar.length)} personne{regle.quantite_min - rempliePar.length > 1 ? 's' : ''}</span>
              )}
              {expires.length > 0 && (
                <span style={{ color: '#F87171' }}> · qualif expirée : {expires.join(', ')} (ne compte pas)</span>
              )}
              {regle.a_verifier && <span style={{ color: 'var(--c-dim)' }}> — à l'appréciation du DT</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Annuaire des moniteurs et de leurs qualifications ────────────────────────

function AnnuaireMoniteurs({ centreId, enc }: { centreId: string; enc: ReturnType<typeof useEncadrement> }) {
  const [membres, setMembres] = useState<{ id: string; nom: string }[]>([]);
  const [form, setForm] = useState({ user_id: '', code: '', numero: '', obtention: '', expiration: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('licencies_centres')
      .select('parachutiste_id, profiles!parachutiste_id(id, nom, prenom)')
      .eq('centre_id', centreId).eq('statut', 'actif')
      .then(({ data, error }) => {
        if (error) { console.error('Chargement membres échoué :', error); return; }
        const seen = new Set<string>();
        setMembres((data ?? [])
          .map((r: Record<string, unknown>) => r.profiles as { id: string; nom: string; prenom: string } | null)
          .filter((p): p is { id: string; nom: string; prenom: string } => !!p && !seen.has(p.id) && (seen.add(p.id), true))
          .map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}` })));
      });
  }, [centreId]);

  const ajouter = async () => {
    if (!form.user_id || !form.code) { setError('Choisissez un moniteur et une qualification.'); return; }
    setError(null);
    const { data: written, error } = await supabase.from('moniteurs_qualifications').insert({
      user_id: form.user_id,
      centre_id: centreId,
      qualification_code: form.code,
      numero: form.numero.trim() || null,
      date_obtention: form.obtention || null,
      date_expiration: form.expiration || null,
    }).select('id');
    if (error || !written || written.length === 0) {
      console.error('Ajout qualification échoué :', error);
      setError(error?.message ?? 'La qualification n\'a pas pu être ajoutée.');
      return;
    }
    setForm({ user_id: '', code: '', numero: '', obtention: '', expiration: '' });
    enc.refresh();
  };

  const desactiver = async (q: MoniteurQualif) => {
    setError(null);
    const { data: written, error } = await supabase
      .from('moniteurs_qualifications').update({ actif: !q.actif }).eq('id', q.id).select('id');
    if (error || !written || written.length === 0) {
      console.error('Modification qualification échouée :', error);
      setError(error?.message ?? 'Modification refusée.');
      return;
    }
    enc.refresh();
  };

  const parMoniteur = new Map<string, MoniteurQualif[]>();
  for (const q of enc.moniteursQualifs) (parMoniteur.get(q.user_id) ?? parMoniteur.set(q.user_id, []).get(q.user_id)!).push(q);

  return (
    <div className="space-y-4">
      {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>⚠️ {error}</p>}

      {[...parMoniteur.entries()].map(([userId, qs]) => (
        <div key={userId} className="rounded-xl p-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <p className="text-sm font-bold text-white mb-1.5">{enc.noms[userId] ?? userId}</p>
          <div className="flex flex-wrap gap-1.5">
            {qs.map(q => {
              const expiree = q.date_expiration && new Date(q.date_expiration) < new Date();
              return (
                <span key={q.id} className="text-[11px] px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
                  style={{
                    background: !q.actif ? 'rgba(148,163,184,0.1)' : expiree ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color: !q.actif ? '#94A3B8' : expiree ? '#FCA5A5' : '#34D399',
                    border: `1px solid ${!q.actif ? 'rgba(148,163,184,0.3)' : expiree ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  }}>
                  {q.qualification_code}
                  {q.numero && ` · n°${q.numero}`}
                  {q.date_expiration && ` · ${expiree ? 'expirée' : 'valide →'} ${new Date(q.date_expiration).toLocaleDateString('fr-FR')}`}
                  {!q.actif && ' · désactivée'}
                  <button onClick={() => desactiver(q)} title={q.actif ? 'Désactiver' : 'Réactiver'} aria-label="Basculer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {parMoniteur.size === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--c-dim)' }}>Aucune qualification enregistrée — ajoutez vos moniteurs ci-dessous.</p>
      )}

      <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <p className="text-xs font-bold text-white">Ajouter une qualification</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} style={inputStyle}>
            <option value="">Moniteur (membre du centre)…</option>
            {membres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={inputStyle}>
            <option value="">Qualification…</option>
            {enc.qualifsRef.map(q => <option key={q.code} value={q.code}>{q.libelle}</option>)}
          </select>
          <input placeholder="N° diplôme/qualif (optionnel)" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" title="Date d'obtention" value={form.obtention} onChange={e => setForm(f => ({ ...f, obtention: e.target.value }))} style={inputStyle} />
            <input type="date" title="Date d'expiration (vide = n'expire pas)" value={form.expiration} onChange={e => setForm(f => ({ ...f, expiration: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <button onClick={ajouter} className="text-sm font-bold px-4 py-2.5 rounded-lg text-white" style={{ background: '#2563EB' }}>
          Ajouter
        </button>
      </div>
    </div>
  );
}
