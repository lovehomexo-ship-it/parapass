import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BellRing, Send, CheckCircle2, Eye, AlertTriangle } from 'lucide-react';

// ─── Relances documents (licence / certificat médical) ───────────────────────
// Détection côté serveur (relances_apercu), envoi via la messagerie interne.
// Le balayage automatique tourne chaque jour côté serveur (cron) — cet écran
// sert au réglage, au suivi et aux relances manuelles.

interface RelancesConfig {
  actif: boolean;
  paliers_licence: number[];
  paliers_medical: number[];
  ignorer_apres_jours: number;
}

interface ApercuItem {
  user_id: string;
  prenom: string | null;
  nom: string | null;
  type_document: 'licence' | 'medical';
  echeance_date: string;
  jours_restants: number;
  palier: number;
  deja_envoye: boolean;
  envoye_at: string | null;
  message_lu: boolean | null;
}

interface HistoRow {
  id: string;
  user_id: string;
  type_document: string;
  palier: number;
  echeance_date: string;
  mode: string;
  envoye_at: string;
  qui?: string;
}

const DEFAUT: RelancesConfig = { actif: false, paliers_licence: [30, 15, 7, 0, -7], paliers_medical: [30, 15, 7, 0, -7], ignorer_apres_jours: 365 };

function palierLabel(p: number): string {
  if (p > 0) return `J-${p}`;
  if (p === 0) return 'Jour J';
  return `J+${-p}`;
}

function docLabel(t: string): string {
  return t === 'licence' ? 'Licence FFP' : 'Certificat médical';
}

function parsePaliers(s: string): number[] | null {
  const vals = s.split(',').map(x => parseInt(x.trim(), 10));
  if (vals.length === 0 || vals.some(v => Number.isNaN(v))) return null;
  return [...new Set(vals)].sort((a, b) => b - a);
}

export function RelancesSection({ centreId }: { centreId: string }) {
  const [config, setConfig] = useState<RelancesConfig>(DEFAUT);
  const [palLicStr, setPalLicStr] = useState('');
  const [palMedStr, setPalMedStr] = useState('');
  const [apercu, setApercu] = useState<ApercuItem[]>([]);
  const [histo, setHisto] = useState<HistoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sendingFor, setSendingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErreur(null);
    // config
    const { data: cfg, error: e1 } = await supabase
      .from('relances_config')
      .select('actif, paliers_licence, paliers_medical, ignorer_apres_jours')
      .eq('centre_id', centreId)
      .maybeSingle();
    if (e1) { console.error('Chargement config relances échoué :', e1); setErreur('Impossible de charger la configuration des relances.'); }
    const c = (cfg as RelancesConfig | null) ?? DEFAUT;
    setConfig(c);
    setPalLicStr(c.paliers_licence.join(', '));
    setPalMedStr(c.paliers_medical.join(', '));

    // échéances en cours (fonction serveur — même détection que le balayage)
    const { data: ap, error: e2 } = await supabase.rpc('relances_apercu', { p_centre_id: centreId });
    if (e2) { console.error('Chargement aperçu relances échoué :', e2); setErreur('Impossible de charger les échéances.'); }
    setApercu((ap as ApercuItem[] | null) ?? []);

    // historique des relances envoyées
    const { data: rows, error: e3 } = await supabase
      .from('relances_envoyees')
      .select('id, user_id, type_document, palier, echeance_date, mode, envoye_at')
      .eq('centre_id', centreId)
      .order('envoye_at', { ascending: false })
      .limit(200);
    if (e3) { console.error('Chargement historique relances échoué :', e3); setErreur('Impossible de charger l\'historique.'); }
    const list = (rows as HistoRow[] | null) ?? [];
    // noms en deux temps (FK profils — pas d'embed fiable)
    const ids = [...new Set(list.map(r => r.user_id))];
    if (ids.length > 0) {
      const { data: profs, error: e4 } = await supabase.from('profiles').select('id, prenom, nom').in('id', ids);
      if (e4) console.error('Chargement noms échoué :', e4);
      const byId = new Map((profs ?? []).map(p => [p.id as string, `${p.prenom ?? ''} ${p.nom ?? ''}`.trim()]));
      list.forEach(r => { r.qui = byId.get(r.user_id) ?? '—'; });
    }
    setHisto(list);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const saveConfig = async (patch: Partial<RelancesConfig>) => {
    setErreur(null); setInfo(null);
    const next = { ...config, ...patch };
    const { data, error } = await supabase
      .from('relances_config')
      .upsert({ centre_id: centreId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'centre_id' })
      .select();
    if (error || !data?.length) {
      console.error('Enregistrement config relances échoué :', error);
      setErreur('Enregistrement impossible. Réessayez.');
      return;
    }
    setConfig(next);
    setInfo('Réglages enregistrés.');
  };

  const savePaliers = async () => {
    const lic = parsePaliers(palLicStr);
    const med = parsePaliers(palMedStr);
    if (!lic || !med) { setErreur('Paliers invalides — nombres séparés par des virgules (négatif = après échéance, ex. 30, 15, 7, 0, -7).'); return; }
    await saveConfig({ paliers_licence: lic, paliers_medical: med });
    setPalLicStr(lic.join(', '));
    setPalMedStr(med.join(', '));
  };

  const relancer = async (userId: string, quiNom: string) => {
    setErreur(null); setInfo(null); setSendingFor(userId);
    const { data, error } = await supabase.rpc('relance_manuelle', { p_centre_id: centreId, p_user_id: userId });
    setSendingFor(null);
    if (error) {
      console.error('Relance manuelle échouée :', error);
      setErreur(`Relance impossible pour ${quiNom}. Réessayez.`);
      return;
    }
    setInfo(data === 1
      ? `Relance envoyée à ${quiNom} dans sa messagerie.`
      : `Rien à envoyer pour ${quiNom} — une relance a déjà été faite aujourd'hui.`);
    load();
  };

  // regrouper l'aperçu par licencié (un licencié = une ligne, docs en chips)
  const parUser = new Map<string, ApercuItem[]>();
  apercu.forEach(it => {
    const arr = parUser.get(it.user_id) ?? [];
    arr.push(it);
    parUser.set(it.user_id, arr);
  });

  const inputCls = 'w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none';
  const inputStyle = { background: 'var(--c-bg)', border: '1px solid var(--c-border)' } as const;

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><BellRing className="w-5 h-5" /> Relances documents</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--c-dim)' }}>
          Licence et certificat médical : chaque licencié concerné reçoit une relance dans sa messagerie ParaPass, au nom du centre.
          Le balayage tourne automatiquement une fois par jour.
        </p>
      </div>

      {erreur && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {erreur}
        </div>
      )}
      {info && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#86EFAC' }}>
          {info}
        </div>
      )}

      {/* Réglages */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white text-sm">Relances automatiques</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
              {config.actif ? 'Activées — un passage par jour, jamais deux fois le même palier.' : 'Désactivées — aucun message automatique ne part.'}
            </p>
          </div>
          <button
            onClick={() => saveConfig({ actif: !config.actif })}
            className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0"
            style={{ background: config.actif ? '#2563EB' : 'var(--c-border)', minWidth: 48 }}
            aria-label={config.actif ? 'Désactiver les relances automatiques' : 'Activer les relances automatiques'}
          >
            <span className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all" style={{ left: config.actif ? 24 : 4 }} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--c-dim)' }}>Paliers licence (jours avant échéance)</label>
            <input className={inputCls} style={inputStyle} value={palLicStr} onChange={e => setPalLicStr(e.target.value)} placeholder="30, 15, 7, 0, -7" />
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--c-dim)' }}>Paliers certificat médical</label>
            <input className={inputCls} style={inputStyle} value={palMedStr} onChange={e => setPalMedStr(e.target.value)} placeholder="30, 15, 7, 0, -7" />
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
          Un nombre négatif = relance après expiration (ex. -7 → J+7, dernière relance, puis plus rien).
          Les documents expirés depuis plus de {config.ignorer_apres_jours} jours sont ignorés.
        </p>
        <button onClick={savePaliers} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#2563EB', minHeight: 44 }}>
          Enregistrer les paliers
        </button>
      </div>

      {/* Échéances en cours */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <h3 className="font-semibold text-white text-sm mb-3">Échéances en cours ({parUser.size} licencié{parUser.size > 1 ? 's' : ''})</h3>
        {parUser.size === 0 ? (
          <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucune échéance atteinte selon les paliers réglés. Rien à relancer.</p>
        ) : (
          <div className="space-y-2">
            {[...parUser.entries()].map(([uid, items]) => {
              const qui = `${items[0].prenom ?? ''} ${items[0].nom ?? ''}`.trim() || '—';
              const toutEnvoye = items.every(i => i.deja_envoye);
              const lu = items.some(i => i.message_lu === true);
              return (
                <div key={uid} className="rounded-xl p-3 flex flex-wrap items-center gap-3" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold text-white text-sm">{qui}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {items.map(i => (
                        <span key={i.type_document + i.echeance_date} className="text-[11px] px-2 py-0.5 rounded-full" style={{
                          background: i.jours_restants < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: i.jours_restants < 0 ? '#FCA5A5' : '#FCD34D',
                        }}>
                          {docLabel(i.type_document)} · {i.jours_restants < 0 ? `expiré le ${new Date(i.echeance_date).toLocaleDateString('fr-FR')}` : `échéance ${new Date(i.echeance_date).toLocaleDateString('fr-FR')}`} · palier {palierLabel(i.palier)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {toutEnvoye && (
                      <span className="text-[11px] flex items-center gap-1" style={{ color: lu ? '#86EFAC' : 'var(--c-dim)' }}>
                        {lu ? <Eye className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {lu ? 'Relancé · lu' : 'Relancé · non lu'}
                      </span>
                    )}
                    <button
                      onClick={() => relancer(uid, qui)}
                      disabled={sendingFor === uid}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: '#2563EB', minHeight: 40 }}
                    >
                      <Send className="w-3.5 h-3.5" /> {sendingFor === uid ? 'Envoi…' : 'Relancer maintenant'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historique */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <h3 className="font-semibold text-white text-sm mb-3">Relances envoyées ({histo.length})</h3>
        {histo.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucune relance envoyée pour l'instant.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--c-dim)' }}>
                  <th className="py-2 pr-3">Licencié</th>
                  <th className="py-2 pr-3">Document</th>
                  <th className="py-2 pr-3">Palier</th>
                  <th className="py-2 pr-3">Échéance</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2">Envoyée le</th>
                </tr>
              </thead>
              <tbody>
                {histo.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--c-border)' }}>
                    <td className="py-2 pr-3 text-white">{r.qui}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>{docLabel(r.type_document)}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>{palierLabel(r.palier)}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>{new Date(r.echeance_date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>{r.mode === 'manuel' ? 'Manuelle' : 'Auto'}</td>
                    <td className="py-2" style={{ color: 'var(--c-dim)' }}>{new Date(r.envoye_at).toLocaleDateString('fr-FR')} {new Date(r.envoye_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
