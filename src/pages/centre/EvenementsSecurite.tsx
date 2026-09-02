import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ShieldAlert, Plus, Download, Filter } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// P6 — ÉVÈNEMENTS SÉCURITÉ : le registre qui protège le directeur technique.
//
// La déclaration doit tenir en moins d'une minute, sur un téléphone, juste
// après l'évènement — sinon elle n'est jamais faite. D'où quatre champs
// obligatoires seulement (catégorie, gravité, phase, récit) ; mesures et
// suites se complètent plus tard, à froid.
//
// Les conditions météo sont figées côté serveur à la déclaration : dans six
// mois, la prévision du jour n'existera plus nulle part.
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  ['poser_hors_zone', 'Poser hors zone'],
  ['atterrissage_dur', 'Atterrissage dur'],
  ['ouverture_basse', 'Ouverture basse'],
  ['liberation_voile', 'Libération de la voile principale'],
  ['incident_materiel', 'Incident matériel'],
  ['incident_avion', 'Incident avion'],
  ['quasi_collision', 'Quasi-collision sous voile'],
  ['autre', 'Autre'],
] as const;

const GRAVITES = [
  ['sans_consequence', 'Sans conséquence', '#34D399'],
  ['degat_materiel', 'Dégât matériel', '#FBBF24'],
  ['blessure_legere', 'Blessure légère', '#FB923C'],
  ['blessure_grave', 'Blessure grave', '#F87171'],
] as const;

const PHASES = [
  ['embarquement', 'Embarquement'], ['montee', 'Montée'], ['sortie', 'Sortie'],
  ['chute', 'Chute'], ['ouverture', 'Ouverture'], ['sous_voile', 'Sous voile'],
  ['atterrissage', 'Atterrissage'], ['au_sol', 'Au sol'], ['autre', 'Autre'],
] as const;

interface Evenement {
  id: string;
  date_jour: string;
  declarant_nom: string;
  categorie: string;
  gravite: string;
  phase: string | null;
  recit: string;
  statut: string;
  conditions: Record<string, unknown>;
}

const libelle = (liste: readonly (readonly [string, string, ...unknown[]])[], cle: string) =>
  liste.find(([c]) => c === cle)?.[1] ?? cle;

function SecuriteInner({ centreId }: { centreId: string }) {
  const [evts, setEvts] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [filtreGravite, setFiltreGravite] = useState<string>('tous');

  const [categorie, setCategorie] = useState<string>('poser_hors_zone');
  const [gravite, setGravite] = useState<string>('sans_consequence');
  const [phase, setPhase] = useState<string>('atterrissage');
  const [recit, setRecit] = useState('');
  const [mesures, setMesures] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    const { data, error } = await supabase.from('evenements_securite')
      .select('id, date_jour, declarant_nom, categorie, gravite, phase, recit, statut, conditions')
      .eq('centre_id', centreId).order('survenu_a', { ascending: false }).limit(200);
    if (error) {
      console.error('Registre sécurité — chargement échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message); setChargement(false); return;
    }
    setEvts((data ?? []) as Evenement[]);
    setChargement(false);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  const declarer = async () => {
    if (!recit.trim()) return;
    setEnvoi(true); setErreur(null);
    const { error } = await supabase.rpc('declarer_evenement_securite', {
      p_centre_id: centreId, p_categorie: categorie, p_gravite: gravite,
      p_recit: recit.trim(), p_phase: phase, p_mesures: mesures.trim() || null,
    });
    setEnvoi(false);
    if (error) {
      console.error('Déclaration d’évènement — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message);
      return;
    }
    setRecit(''); setMesures(''); setFormOuvert(false);
    charger();
  };

  const exporterCsv = () => {
    const lignes = [
      ['Date', 'Déclarant', 'Catégorie', 'Gravité', 'Phase', 'Statut', 'Récit'].join(';'),
      ...evts.map(e => [
        e.date_jour, e.declarant_nom, libelle(CATEGORIES, e.categorie),
        libelle(GRAVITES, e.gravite), e.phase ? libelle(PHASES, e.phase) : '',
        e.statut, `"${e.recit.replace(/"/g, '""')}"`,
      ].join(';')),
    ].join('\n');
    // BOM : sans lui, Excel massacre les accents.
    const blob = new Blob(['﻿' + lignes], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `evenements-securite-${new Date().getFullYear()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  const filtres = filtreGravite === 'tous' ? evts : evts.filter(e => e.gravite === filtreGravite);
  const parCategorie = CATEGORIES
    .map(([cle, lab]) => ({ lab, n: evts.filter(e => e.categorie === cle).length }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n);

  const champ = 'w-full rounded-xl px-3 text-sm';
  const styleChamp = { minHeight: 44, background: 'var(--c-bg)',
    border: '1px solid var(--c-border)', color: 'var(--c-text)' } as const;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
            <ShieldAlert className="w-5 h-5" style={{ color: '#FB923C' }} aria-hidden />
            Évènements sécurité
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--c-dim)' }}>
            Le registre du centre. Un moniteur peut déclarer ; vous êtes prévenu
            immédiatement, et chaque déclaration entre au journal de bord.
          </p>
        </div>
        <div className="flex gap-2">
          {evts.length > 0 && (
            <button onClick={exporterCsv}
              className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold"
              style={{ minHeight: 44, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
              <Download className="w-3.5 h-3.5" aria-hidden /> CSV
            </button>
          )}
          <button onClick={() => setFormOuvert(v => !v)}
            className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-bold"
            style={{ minHeight: 44, background: '#F97316', color: '#fff' }}>
            <Plus className="w-4 h-4" aria-hidden /> Déclarer
          </button>
        </div>
      </div>

      {erreur && (
        <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>{erreur}</div>
      )}

      {formOuvert && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
            Quatre champs suffisent. Les mesures et les suites se complètent plus tard,
            à froid — l’essentiel est de déclarer maintenant.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Catégorie *</span>
              <select value={categorie} onChange={e => setCategorie(e.target.value)}
                className={champ} style={styleChamp}>
                {CATEGORIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Phase du saut *</span>
              <select value={phase} onChange={e => setPhase(e.target.value)}
                className={champ} style={styleChamp}>
                {PHASES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Gravité *</span>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {GRAVITES.map(([c, l, couleur]) => (
                <button key={c} onClick={() => setGravite(c)}
                  className="px-3 rounded-full text-xs font-semibold"
                  style={{ minHeight: 40,
                    background: gravite === c ? couleur : 'var(--c-bg)',
                    color: gravite === c ? '#0F172A' : 'var(--c-muted)',
                    border: `1px solid ${gravite === c ? couleur : 'var(--c-border)'}` }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Que s’est-il passé ? *</span>
            <textarea rows={3} value={recit} onChange={e => setRecit(e.target.value)}
              placeholder="Quelques phrases suffisent."
              className="w-full rounded-xl px-3 py-2 text-sm mt-1"
              style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Mesures immédiates</span>
            <textarea rows={2} value={mesures} onChange={e => setMesures(e.target.value)}
              placeholder="Facultatif — complétable plus tard."
              className="w-full rounded-xl px-3 py-2 text-sm mt-1"
              style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
          </label>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setFormOuvert(false)} className="px-4 rounded-xl text-sm font-semibold"
              style={{ minHeight: 44, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>Annuler</button>
            <button onClick={declarer} disabled={!recit.trim() || envoi}
              className="px-4 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ minHeight: 44, background: '#F97316', color: '#fff' }}>
              {envoi ? 'Enregistrement…' : 'Déclarer'}
            </button>
          </div>
        </div>
      )}

      {/* Synthèse : le rapport annuel commence ici. */}
      {parCategorie.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-dim)' }}>
            Synthèse — {evts.length} évènement{evts.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {parCategorie.map(c => (
              <span key={c.lab} className="text-xs px-2 py-1 rounded-lg"
                style={{ background: 'var(--c-bg)', color: 'var(--c-text2)', border: '1px solid var(--c-border)' }}>
                {c.lab} <strong>{c.n}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {evts.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {(['tous', ...GRAVITES.map(g => g[0])] as string[]).map(g => (
            <button key={g} onClick={() => setFiltreGravite(g)}
              className="px-3 rounded-full text-xs font-semibold"
              style={{ minHeight: 36,
                background: filtreGravite === g ? '#2563EB' : 'var(--c-surface)',
                color: filtreGravite === g ? '#fff' : 'var(--c-muted)',
                border: `1px solid ${filtreGravite === g ? '#2563EB' : 'var(--c-border)'}` }}>
              <Filter className="w-3 h-3 inline mr-1" aria-hidden />
              {g === 'tous' ? `Tous (${evts.length})` : libelle(GRAVITES, g)}
            </button>
          ))}
        </div>
      )}

      {filtres.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--c-dim)' }}>
          {evts.length === 0
            ? 'Aucun évènement déclaré. C’est une bonne nouvelle — et le registre est prêt.'
            : 'Aucun évènement pour ce filtre.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtres.map(e => {
            const g = GRAVITES.find(([c]) => c === e.gravite);
            return (
              <li key={e.id} className="rounded-xl px-3 py-2.5"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono" style={{ color: 'var(--c-dim)' }}>
                    {new Date(e.date_jour).toLocaleDateString('fr-FR')}
                  </span>
                  <span className="text-[11px] font-semibold px-1.5 rounded-full"
                    style={{ background: `${g?.[2] ?? '#94A3B8'}22`, color: g?.[2] ?? '#94A3B8' }}>
                    {libelle(GRAVITES, e.gravite)}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>
                    {libelle(CATEGORIES, e.categorie)}
                  </span>
                  {e.phase && (
                    <span className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
                      · {libelle(PHASES, e.phase)}
                    </span>
                  )}
                  <span className="text-[11px] ml-auto" style={{ color: 'var(--c-dim)' }}>{e.declarant_nom}</span>
                </div>
                <p className="text-sm mt-1 break-words" style={{ color: 'var(--c-text2)' }}>{e.recit}</p>
                {typeof e.conditions?.vent_kt === 'number' && (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--c-dim)' }}>
                    Conditions au moment des faits : vent {String(e.conditions.vent_deg)}° ·{' '}
                    {String(e.conditions.vent_kt)} kt
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function EvenementsSecurite({ centreId }: { centreId: string }) {
  return <ErrorBoundary><SecuriteInner centreId={centreId} /></ErrorBoundary>;
}
