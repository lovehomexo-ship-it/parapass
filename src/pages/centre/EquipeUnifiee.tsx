import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useComplianceRules } from '../../lib/compliance';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Shield, Package, CheckSquare, Plus, X, AlertTriangle } from 'lucide-react';

// ─── Mon équipe : une personne = une carte ────────────────────────────────────
// Rassemble par user_id les qualifications (moniteurs_qualifications), la
// délégation de validation (delegations_validation) et l'habilitation plieur
// (plieurs_valides). Réorganisation d'affichage : aucune donnée supprimée.

interface Qualif { id: string; qualification_code: string; numero: string | null; date_obtention: string | null; date_expiration: string | null; actif: boolean; }
interface Delegation { id: string; date_delegation: string | null; date_expiration: string | null; actif: boolean; }
interface Plieur { id: string; numero_qualif: string | null; date_habilitation: string | null; date_expiration: string | null; actif: boolean; }
interface Profil { id: string; nom: string; prenom: string; avatar_url: string | null; numero_licence: string | null; role: string | null; }
interface Membre extends Profil { qualifs: Qualif[]; delegation: Delegation | null; plieur: Plieur | null; }

type Etat = 'valide' | 'bientot' | 'expire' | 'permanent' | 'inactif';

function etatDate(exp: string | null, actif: boolean, seuilJours: number): Etat {
  if (!actif) return 'inactif';
  if (!exp) return 'permanent';
  const j = Math.floor((new Date(exp).getTime() - Date.now()) / 86_400_000);
  if (j < 0) return 'expire';
  if (j <= seuilJours) return 'bientot';
  return 'valide';
}

const COULEURS: Record<Etat, { bg: string; fg: string; bd: string }> = {
  valide: { bg: 'rgba(16,185,129,0.12)', fg: '#34D399', bd: 'rgba(16,185,129,0.35)' },
  permanent: { bg: 'rgba(16,185,129,0.12)', fg: '#34D399', bd: 'rgba(16,185,129,0.35)' },
  bientot: { bg: 'rgba(245,158,11,0.12)', fg: '#FCD34D', bd: 'rgba(245,158,11,0.35)' },
  expire: { bg: 'rgba(239,68,68,0.12)', fg: '#FCA5A5', bd: 'rgba(239,68,68,0.35)' },
  inactif: { bg: 'rgba(148,163,184,0.1)', fg: '#94A3B8', bd: 'rgba(148,163,184,0.3)' },
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');
const AVATAR_PALETTE = ['#003082', '#10B981', '#F97316', '#EF4444', '#8B5CF6', '#06B6D4'];
function avatarColor(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]; }

function Avatar({ m }: { m: Profil }) {
  const initiales = `${m.prenom?.[0] ?? ''}${m.nom?.[0] ?? ''}`.toUpperCase();
  const [broken, setBroken] = useState(false);
  if (m.avatar_url && !broken) {
    return <img src={m.avatar_url} alt={initiales} onError={() => setBroken(true)} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: avatarColor(m.nom + m.prenom) }}>
      {initiales || '?'}
    </div>
  );
}

type Filtre = 'tous' | 'moniteurs' | 'plieurs' | 'delegues';

function EquipeUnifieeInner({ centreId }: { centreId: string }) {
  const { rules } = useComplianceRules();
  const seuil = rules.qualif_expiration_alerte_jours ?? 60;

  const [membres, setMembres] = useState<Membre[]>([]);
  const [membresCentre, setMembresCentre] = useState<{ id: string; nom: string }[]>([]);
  const [qualifsRef, setQualifsRef] = useState<{ code: string; libelle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [formOuvert, setFormOuvert] = useState(false);
  const [form, setForm] = useState({ user_id: '', code: '', numero: '', obtention: '', expiration: '' });

  const load = useCallback(async () => {
    setError(null);
    const [q, d, p, lic, qr] = await Promise.all([
      supabase.from('moniteurs_qualifications').select('*').eq('centre_id', centreId),
      supabase.from('delegations_validation').select('*').eq('centre_id', centreId).eq('actif', true),
      supabase.from('plieurs_valides').select('*').eq('centre_id', centreId).eq('actif', true),
      supabase.from('licencies_centres').select('parachutiste_id').eq('centre_id', centreId).eq('statut', 'actif'),
      supabase.from('qualifications_ref').select('code, libelle').eq('actif', true),
    ]);
    for (const r of [q, d, p, lic, qr]) if (r.error) console.error('Chargement équipe échoué :', r.error);
    if (q.error || d.error || p.error) { setError('Impossible de charger l\'équipe. Réessayez.'); setLoading(false); return; }

    const quals = (q.data ?? []) as (Qualif & { user_id: string })[];
    const delegs = (d.data ?? []) as (Delegation & { moniteur_id: string })[];
    const plieurs = (p.data ?? []) as (Plieur & { plieur_id: string })[];
    setQualifsRef((qr.data ?? []) as { code: string; libelle: string }[]);

    // tous les user_id ayant au moins une casquette
    const ids = new Set<string>([
      ...quals.map(x => x.user_id), ...delegs.map(x => x.moniteur_id), ...plieurs.map(x => x.plieur_id),
    ]);
    const licIds = (lic.data ?? []).map(l => l.parachutiste_id as string);
    const tousIds = [...new Set([...ids, ...licIds])];

    let profils: Record<string, Profil> = {};
    if (tousIds.length) {
      const { data: pr, error: pe } = await supabase.from('profiles').select('id, nom, prenom, avatar_url, numero_licence, role').in('id', tousIds);
      if (pe) console.error('Chargement profils échoué :', pe);
      profils = Object.fromEntries((pr ?? []).map(x => [x.id as string, x as Profil]));
    }

    // dropdown « ajouter » = membres actifs du centre
    setMembresCentre(licIds.map(id => ({ id, nom: `${profils[id]?.prenom ?? ''} ${profils[id]?.nom ?? ''}`.trim() || '—' })).sort((a, b) => a.nom.localeCompare(b.nom)));

    // une carte par personne ayant une casquette
    const cartes: Membre[] = [...ids].map(id => ({
      id,
      nom: profils[id]?.nom ?? '?', prenom: profils[id]?.prenom ?? '',
      avatar_url: profils[id]?.avatar_url ?? null, numero_licence: profils[id]?.numero_licence ?? null, role: profils[id]?.role ?? null,
      qualifs: quals.filter(x => x.user_id === id).sort((a, b) => a.qualification_code.localeCompare(b.qualification_code)),
      delegation: delegs.find(x => x.moniteur_id === id) ?? null,
      plieur: plieurs.find(x => x.plieur_id === id) ?? null,
    })).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));

    setMembres(cartes);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // doublons de NOM (user_id différents) → signalés, jamais fusionnés
  const nomsMultiples = useMemo(() => {
    const c = new Map<string, number>();
    membres.forEach(m => { const k = `${m.prenom} ${m.nom}`.toLowerCase().trim(); c.set(k, (c.get(k) ?? 0) + 1); });
    return c;
  }, [membres]);

  // ── Actions (mise à jour optimiste via reload) ──
  const ajouterQualif = async () => {
    if (!form.user_id || !form.code) { setError('Choisissez une personne et une qualification.'); return; }
    setError(null);
    const { data, error } = await supabase.from('moniteurs_qualifications').insert({
      user_id: form.user_id, centre_id: centreId, qualification_code: form.code,
      numero: form.numero.trim() || null, date_obtention: form.obtention || null, date_expiration: form.expiration || null,
    }).select('id');
    if (error || !data?.length) { console.error('Ajout qualif échoué :', error); setError(error?.message ?? 'Ajout impossible.'); return; }
    setForm({ user_id: '', code: '', numero: '', obtention: '', expiration: '' });
    setFormOuvert(false);
    load();
  };

  const retirerQualif = async (id: string) => {
    setError(null);
    const { data, error } = await supabase.from('moniteurs_qualifications').update({ actif: false }).eq('id', id).select('id');
    if (error || !data?.length) { console.error('Retrait qualif échoué :', error); setError('Modification refusée.'); return; }
    load();
  };

  const retirerPlieur = async (id: string) => {
    setError(null);
    const { data, error } = await supabase.from('plieurs_valides').update({ actif: false, date_expiration: new Date().toISOString() }).eq('id', id).select('id');
    if (error || !data?.length) { console.error('Retrait plieur échoué :', error); setError('Modification refusée.'); return; }
    load();
  };

  // révocation délégation : même logique sûre que « Mes licenciés »
  const revoquerDelegation = async (m: Membre) => {
    if (!confirm(`Révoquer la délégation de validation de ${m.prenom} ${m.nom} ?\n\nIl ne pourra plus valider de sauts. Son carnet reste intact.`)) return;
    setError(null);
    const { error: e1 } = await supabase.from('delegations_validation')
      .update({ actif: false, date_expiration: new Date().toISOString() }).eq('moniteur_id', m.id).eq('centre_id', centreId);
    if (e1) { console.error('Révocation échouée :', e1); setError('Révocation impossible.'); return; }
    // rétrograder le rôle seulement s'il n'a plus aucune délégation active ailleurs
    const { data: autres } = await supabase.from('delegations_validation').select('id').eq('moniteur_id', m.id).eq('actif', true);
    if (!autres?.length) await supabase.from('profiles').update({ role: 'parachutiste' }).eq('id', m.id);
    load();
  };

  const membresFiltres = membres.filter(m => {
    if (filtre === 'moniteurs') return m.qualifs.some(q => q.actif);
    if (filtre === 'plieurs') return !!m.plieur;
    if (filtre === 'delegues') return !!m.delegation;
    return true;
  });

  // bandeau : qualifs + plieurs expirés ou proches (tous types)
  const alertes = membres.flatMap(m => {
    const items: { nom: string; label: string; etat: Etat; date: string | null }[] = [];
    m.qualifs.forEach(q => { const e = etatDate(q.date_expiration, q.actif, seuil); if (e === 'expire' || e === 'bientot') items.push({ nom: `${m.prenom} ${m.nom}`, label: q.qualification_code, etat: e, date: q.date_expiration }); });
    if (m.plieur) { const e = etatDate(m.plieur.date_expiration, m.plieur.actif, seuil); if (e === 'expire' || e === 'bientot') items.push({ nom: `${m.prenom} ${m.nom}`, label: 'Plieur', etat: e, date: m.plieur.date_expiration }); }
    return items;
  });

  const inputStyle: React.CSSProperties = { background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'white', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%', minHeight: 44 };
  const chip = (actif: boolean) => ({ background: actif ? '#2563EB' : 'var(--c-surface)', color: actif ? 'white' : 'var(--c-muted)', border: `1px solid ${actif ? '#2563EB' : 'var(--c-border)'}`, minHeight: 40 });

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* Bandeau qualifs à renouveler (moniteurs + plieurs) */}
      {alertes.length > 0 && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="text-xs font-bold mb-1.5" style={{ color: '#FCD34D' }}>À renouveler (seuil {seuil} j, paramétrable)</p>
          <ul className="text-xs space-y-1" style={{ color: 'var(--c-text2)' }}>
            {alertes.map((a, i) => (
              <li key={i} className="leading-snug">
                <span className="text-white font-medium">{a.nom}</span> — {a.label}{' '}
                <span style={{ color: a.etat === 'expire' ? '#F87171' : '#FCD34D' }}>
                  {a.etat === 'expire' ? 'expirée' : 'expire'} {a.date ? `le ${fmt(a.date)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtres + ajout */}
      <div className="flex flex-wrap items-center gap-2">
        {([['tous', 'Tous'], ['moniteurs', 'Moniteurs'], ['plieurs', 'Plieurs'], ['delegues', 'Validation']] as [Filtre, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setFiltre(k)} className="text-xs font-semibold px-3 rounded-full transition" style={chip(filtre === k)}>{label}</button>
        ))}
        <button onClick={() => setFormOuvert(o => !o)} className="text-xs font-bold px-3 rounded-full text-white inline-flex items-center gap-1 ml-auto" style={{ background: '#F97316', minHeight: 40 }}>
          <Plus className="w-3.5 h-3.5" /> Qualification
        </button>
      </div>

      {/* Formulaire ajout — colonne unique sur mobile */}
      {formOuvert && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <p className="text-sm font-bold text-white">Ajouter une qualification</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} style={inputStyle}>
              <option value="">Personne (membre du centre)…</option>
              {membresCentre.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
            <select value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={inputStyle}>
              <option value="">Qualification…</option>
              {qualifsRef.map(q => <option key={q.code} value={q.code}>{q.libelle}</option>)}
            </select>
            <input placeholder="N° diplôme/qualif (optionnel)" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} style={inputStyle} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="date" title="Date d'obtention" value={form.obtention} onChange={e => setForm(f => ({ ...f, obtention: e.target.value }))} style={inputStyle} />
              <input type="date" title="Expiration (vide = permanente)" value={form.expiration} onChange={e => setForm(f => ({ ...f, expiration: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={ajouterQualif} className="text-sm font-bold px-4 rounded-lg text-white" style={{ background: '#2563EB', minHeight: 44 }}>Ajouter</button>
            <button onClick={() => setFormOuvert(false)} className="text-sm font-semibold px-4 rounded-lg" style={{ background: 'var(--c-border)', color: 'var(--c-text)', minHeight: 44 }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Cartes — 1 colonne mobile, 2 colonnes desktop */}
      {membresFiltres.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>Aucun membre du staff pour ce filtre.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {membresFiltres.map(m => {
            const estMoniteur = m.qualifs.some(q => q.actif);
            const doublon = (nomsMultiples.get(`${m.prenom} ${m.nom}`.toLowerCase().trim()) ?? 0) > 1;
            return (
              <div key={m.id} className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                {/* Identité + rôles */}
                <div className="flex items-start gap-3">
                  <Avatar m={m} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{m.prenom} {m.nom}</p>
                    {m.numero_licence && <p className="text-[11px] truncate" style={{ color: 'var(--c-dim)' }}>Licence {m.numero_licence}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {m.role === 'admin_centre' && <RolePill icon={<Shield className="w-3 h-3" />} label="DT" color="#8B5CF6" />}
                      {estMoniteur && <RolePill icon={<Shield className="w-3 h-3" />} label="Moniteur" color="#2563EB" />}
                      {m.delegation && <RolePill icon={<CheckSquare className="w-3 h-3" />} label="Validation" color="#10B981" />}
                      {m.plieur && <RolePill icon={<Package className="w-3 h-3" />} label="Plieur" color="#F97316" />}
                    </div>
                    {doublon && <p className="text-[10px] mt-1" style={{ color: '#FCD34D' }}>⚠️ Doublon possible — même nom, comptes distincts à réconcilier</p>}
                  </div>
                </div>

                {/* Qualifications (pastilles repliables) */}
                {m.qualifs.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--c-dim)' }}>Qualifications</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.qualifs.map(q => {
                        const e = etatDate(q.date_expiration, q.actif, seuil);
                        const c = COULEURS[e];
                        return (
                          <span key={q.id} className="text-[11px] px-2.5 py-1 rounded-full inline-flex items-center gap-1.5" style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}>
                            <span className="font-semibold">{q.qualification_code}</span>
                            {q.numero && <span className="opacity-80">n°{q.numero}</span>}
                            {q.date_expiration
                              ? <span>{e === 'expire' ? 'expirée' : 'valide →'} {fmt(q.date_expiration)}</span>
                              : <span>permanente</span>}
                            {!q.actif && <span>· retirée</span>}
                            {q.actif && (
                              <button onClick={() => retirerQualif(q.id)} title="Retirer" aria-label="Retirer la qualification" className="ml-0.5 -mr-1 p-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Délégation */}
                {m.delegation && (
                  <div className="mt-3 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2" style={{ background: COULEURS[etatDate(m.delegation.date_expiration, true, seuil)].bg, border: `1px solid ${COULEURS[etatDate(m.delegation.date_expiration, true, seuil)].bd}` }}>
                    <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: '#34D399' }} />
                    <span className="text-xs" style={{ color: 'var(--c-text2)' }}>
                      Peut valider les sauts{m.delegation.date_delegation && ` · depuis le ${fmt(m.delegation.date_delegation)}`}{m.delegation.date_expiration && ` · exp. ${fmt(m.delegation.date_expiration)}`}
                    </span>
                    <button onClick={() => revoquerDelegation(m)} className="ml-auto text-xs font-semibold px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)', minHeight: 40 }}>
                      Révoquer
                    </button>
                  </div>
                )}

                {/* Plieur */}
                {m.plieur && (
                  <div className="mt-3 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2" style={{ background: COULEURS[etatDate(m.plieur.date_expiration, m.plieur.actif, seuil)].bg, border: `1px solid ${COULEURS[etatDate(m.plieur.date_expiration, m.plieur.actif, seuil)].bd}` }}>
                    <Package className="w-4 h-4 flex-shrink-0" style={{ color: '#F97316' }} />
                    <span className="text-xs" style={{ color: 'var(--c-text2)' }}>
                      Plieur habilité{m.plieur.numero_qualif && ` · n°${m.plieur.numero_qualif}`}{m.plieur.date_expiration ? ` · ${etatDate(m.plieur.date_expiration, true, seuil) === 'expire' ? 'expirée' : 'valide →'} ${fmt(m.plieur.date_expiration)}` : ' · permanente'}
                    </span>
                    <button onClick={() => retirerPlieur(m.plieur!.id)} className="ml-auto text-xs font-semibold px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)', minHeight: 40 }}>
                      Retirer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RolePill({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {icon}{label}
    </span>
  );
}

export function EquipeUnifiee({ centreId }: { centreId: string }) {
  return <ErrorBoundary><EquipeUnifieeInner centreId={centreId} /></ErrorBoundary>;
}
