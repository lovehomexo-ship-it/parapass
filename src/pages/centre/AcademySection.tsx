import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GraduationCap, FileText, Trophy, Flame, AlertTriangle, Download } from 'lucide-react';

// ─── Academy — vue DT ─────────────────────────────────────────────────────────
// Assemble l'existant : moteur quiz (quiz_*) via la RPC academy_scores_centre,
// et documents officiels FFP (modèles paramétrables + archives horodatées).
// Aucune table quiz/progression créée ici.

// ── Sous-partie « Académie » : scores & classement du centre ──────────────────

interface ScoreRow {
  user_id: string;
  prenom: string | null;
  nom: string | null;
  xp_total: number;
  tentatives: number;
  correctes: number;
  streak_actuel: number;
  badges: number;
  derniere_activite: string | null;
  themes_faibles: string[];
}

export function AcademyScoresDZ({ centreId }: { centreId: string }) {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('academy_scores_centre', { p_centre_id: centreId }).then(({ data, error }) => {
      if (error) {
        console.error('Chargement scores Académie échoué :', error);
        setErreur('Impossible de charger les scores. Réessayez.');
      }
      setRows(((data as ScoreRow[] | null) ?? []).sort((a, b) => b.xp_total - a.xp_total));
      setLoading(false);
    });
  }, [centreId]);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (erreur) return (
    <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
      <AlertTriangle className="w-4 h-4" /> {erreur}
    </div>
  );

  const actifs = rows.filter(r => r.tentatives > 0);
  const jamais = rows.filter(r => r.tentatives === 0);

  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
        Scores du quiz sécurité de vos licenciés. Un score faible n'est jamais une sanction —
        c'est une occasion d'accompagner : proposez un brief, une révision, un moment d'échange.
      </p>

      {/* Classement */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2"><Trophy className="w-4 h-4" style={{ color: '#FBBF24' }} /> Classement du centre</h3>
        {actifs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucun licencié n'a encore joué au quiz. Parlez-en au prochain briefing !</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--c-dim)' }}>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Licencié</th>
                  <th className="py-2 pr-3">XP</th>
                  <th className="py-2 pr-3">Tentatives</th>
                  <th className="py-2 pr-3">Réussite</th>
                  <th className="py-2 pr-3">Série</th>
                  <th className="py-2 pr-3">Badges</th>
                  <th className="py-2">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {actifs.map((r, idx) => {
                  const taux = r.tentatives > 0 ? Math.round((r.correctes / r.tentatives) * 100) : 0;
                  return (
                    <tr key={r.user_id} style={{ borderTop: '1px solid var(--c-border)' }}>
                      <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>{idx + 1}</td>
                      <td className="py-2 pr-3 text-white font-medium">{r.prenom} {r.nom}</td>
                      <td className="py-2 pr-3 font-bold" style={{ color: '#FBBF24' }}>{r.xp_total}</td>
                      <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>{r.tentatives}</td>
                      <td className="py-2 pr-3" style={{ color: taux >= 70 ? '#34D399' : 'var(--c-text2)' }}>{taux} %</td>
                      <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>
                        {r.streak_actuel > 0 ? <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5" style={{ color: '#F97316' }} />{r.streak_actuel} j</span> : '—'}
                      </td>
                      <td className="py-2 pr-3" style={{ color: 'var(--c-dim)' }}>{r.badges}</td>
                      <td className="py-2 text-xs" style={{ color: 'var(--c-dim)' }}>
                        {r.derniere_activite ? new Date(r.derniere_activite).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Accompagnement — présenté avec tact */}
      {actifs.some(r => r.themes_faibles.length > 0) && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <h3 className="font-semibold text-white text-sm mb-1">Thèmes à réviser ensemble</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--c-dim)' }}>
            Thèmes où certains licenciés gagneraient à être accompagnés (réussite &lt; 50 % sur au moins 3 questions vues).
            Une info pour orienter vos briefs — pas un tableau d'affichage.
          </p>
          <ul className="space-y-1.5">
            {actifs.filter(r => r.themes_faibles.length > 0).map(r => (
              <li key={r.user_id} className="text-sm" style={{ color: 'var(--c-text2)' }}>
                <span className="text-white font-medium">{r.prenom} {r.nom}</span>
                <span style={{ color: 'var(--c-dim)' }}> — {r.themes_faibles.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {jamais.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
          {jamais.length} licencié{jamais.length > 1 ? 's' : ''} n'{jamais.length > 1 ? 'ont' : 'a'} pas encore essayé le quiz.
        </p>
      )}
    </div>
  );
}

// ── Sous-partie « Documents officiels FFP » ───────────────────────────────────

interface Modele {
  code: string;
  titre: string;
  description: string | null;
  brevet_code: string | null;
  champs: string[];
  a_valider_ffp: boolean;
}

interface Archive {
  id: string;
  eleve_id: string;
  modele_code: string;
  titre: string;
  contenu: Record<string, unknown>;
  created_at: string;
  eleve?: string;
}

export function DocumentsFFPDZ({ centreId, dtId }: { centreId: string; dtId: string | undefined }) {
  const [modeles, setModeles] = useState<Modele[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [membres, setMembres] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selModele, setSelModele] = useState('');
  const [selEleve, setSelEleve] = useState('');
  const [generating, setGenerating] = useState(false);
  const [apercu, setApercu] = useState<Archive | null>(null);

  const load = useCallback(async () => {
    const [{ data: mods, error: e1 }, { data: arch, error: e2 }, { data: lics, error: e3 }] = await Promise.all([
      supabase.from('documents_modeles').select('code, titre, description, brevet_code, champs, a_valider_ffp').eq('actif', true).order('code'),
      supabase.from('documents_archives').select('id, eleve_id, modele_code, titre, contenu, created_at').eq('centre_id', centreId).order('created_at', { ascending: false }).limit(100),
      supabase.from('licencies_centres').select('parachutiste_id').eq('centre_id', centreId).eq('statut', 'actif'),
    ]);
    if (e1 || e2 || e3) {
      console.error('Chargement documents FFP échoué :', e1 ?? e2 ?? e3);
      setErreur('Impossible de charger les documents.');
    }
    setModeles((mods as Modele[] | null) ?? []);
    const archList = (arch as Archive[] | null) ?? [];
    const ids = [...new Set([...archList.map(a => a.eleve_id), ...((lics ?? []).map(l => l.parachutiste_id as string))])];
    if (ids.length) {
      const { data: profs, error: e4 } = await supabase.from('profiles').select('id, prenom, nom').in('id', ids);
      if (e4) console.error('Chargement profils échoué :', e4);
      const byId = new Map((profs ?? []).map(p => [p.id as string, `${p.prenom ?? ''} ${p.nom ?? ''}`.trim()]));
      archList.forEach(a => { a.eleve = byId.get(a.eleve_id) ?? '—'; });
      setMembres(((lics ?? []).map(l => ({ id: l.parachutiste_id as string, nom: byId.get(l.parachutiste_id as string) ?? '—' }))).sort((a, b) => a.nom.localeCompare(b.nom)));
    } else {
      setMembres([]);
    }
    setArchives(archList);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Génère la fiche pré-remplie depuis les données existantes (identité, épreuves validées, signataire)
  const generer = async () => {
    const modele = modeles.find(m => m.code === selModele);
    if (!modele || !selEleve || !dtId) return;
    setGenerating(true); setErreur(null); setInfo(null);

    const { data: prof, error: ep } = await supabase.from('profiles').select('prenom, nom, numero_licence').eq('id', selEleve).maybeSingle();
    if (ep) console.error('Profil élève :', ep);

    // épreuves validées du brevet concerné (moteur de progression — relié, pas dupliqué)
    let epreuvesValidees: { libelle: string; valide_at: string | null; valide_par: string | null }[] = [];
    if (modele.brevet_code) {
      const { data: brevetRef } = await supabase.from('brevets_referentiel').select('id').eq('code', modele.brevet_code).maybeSingle();
      if (brevetRef) {
        const { data: eps } = await supabase.from('epreuves').select('id, libelle').eq('brevet_id', brevetRef.id);
        const epIds = (eps ?? []).map(e => e.id);
        if (epIds.length) {
          const { data: prog, error: eg } = await supabase
            .from('progression_epreuves')
            .select('epreuve_id, statut, valide_at, valide_par')
            .eq('user_id', selEleve).in('epreuve_id', epIds).eq('statut', 'validee');
          if (eg) console.error('Progression élève :', eg);
          const libelles = new Map((eps ?? []).map(e => [e.id, e.libelle as string]));
          epreuvesValidees = (prog ?? []).map(p => ({
            libelle: libelles.get(p.epreuve_id) ?? p.epreuve_id,
            valide_at: p.valide_at, valide_par: p.valide_par,
          }));
        }
      }
    }

    const contenu = {
      modele: modele.code,
      genere_le: new Date().toISOString(),
      identite_eleve: `${prof?.prenom ?? ''} ${prof?.nom ?? ''}`.trim(),
      numero_licence: prof?.numero_licence ?? '',
      epreuves_validees: epreuvesValidees,
      moniteur_signataire_id: dtId,
      mention: 'Format de fiche À VALIDER AVEC LA FFP — contenu généré depuis la progression ParaPass, conservation 3 ans.',
    };

    const { data, error } = await supabase
      .from('documents_archives')
      .insert({ centre_id: centreId, eleve_id: selEleve, modele_code: modele.code, titre: modele.titre, contenu, genere_par: dtId })
      .select();
    setGenerating(false);
    if (error || !data?.length) {
      console.error('Génération fiche échouée :', error);
      setErreur('Génération impossible. Réessayez.');
      return;
    }
    setInfo('Fiche générée et archivée (horodatée).');
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
        Fiches réglementaires FFP (annexe 3, annexe 4…) générées depuis la progression et archivées horodatées —
        l'obligation de conservation 3 ans, sans papier. Formats exacts <strong>à valider avec la FFP</strong>.
      </p>

      {erreur && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>⚠️ {erreur}</div>}
      {info && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#86EFAC' }}>{info}</div>}

      {/* Génération */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <h3 className="font-semibold text-white text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Générer une fiche</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <select value={selModele} onChange={e => setSelModele(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm text-white" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', minHeight: 44 }}>
            <option value="">Modèle de document…</option>
            {modeles.map(m => <option key={m.code} value={m.code}>{m.titre}{m.a_valider_ffp ? ' (à valider FFP)' : ''}</option>)}
          </select>
          <select value={selEleve} onChange={e => setSelEleve(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm text-white" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', minHeight: 44 }}>
            <option value="">Élève…</option>
            {membres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>
        <button onClick={generer} disabled={!selModele || !selEleve || generating}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#2563EB', minHeight: 44 }}>
          {generating ? 'Génération…' : 'Générer la fiche pré-remplie'}
        </button>
      </div>

      {/* Archives */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <h3 className="font-semibold text-white text-sm mb-3">Fiches archivées ({archives.length})</h3>
        {archives.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--c-dim)' }}>Aucune fiche archivée pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {archives.map(a => (
              <li key={a.id} className="rounded-xl p-3 flex flex-wrap items-center gap-2" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm text-white font-medium">{a.titre}</p>
                  <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
                    {a.eleve} · générée le {new Date(a.created_at).toLocaleDateString('fr-FR')} à {new Date(a.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => setApercu(apercu?.id === a.id ? null : a)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'rgba(37,99,235,0.12)', color: '#60A5FA', minHeight: 40 }}>
                  {apercu?.id === a.id ? 'Fermer' : 'Voir'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {apercu && (
          <div className="mt-3 rounded-xl p-4 text-xs" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-white text-sm">{apercu.titre}</p>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 text-xs" style={{ color: '#60A5FA' }}>
                <Download className="w-3.5 h-3.5" /> Imprimer / PDF
              </button>
            </div>
            <pre className="whitespace-pre-wrap" style={{ color: 'var(--c-text2)', overflowX: 'auto' }}>
              {JSON.stringify(apercu.contenu, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icône réutilisée par la nav ───────────────────────────────────────────────
export const AcademyIcon = GraduationCap;
