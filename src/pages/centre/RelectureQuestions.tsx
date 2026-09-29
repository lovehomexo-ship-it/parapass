import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { THEMES_ACADEMIE, LIBELLE_THEME, useParametresAcademie } from '../../lib/academie';
import {
  Check, X, Plus, AlertTriangle, BookOpen, ChevronDown, ChevronUp, Trash2, ExternalLink,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// RELECTURE DES QUESTIONS D'ENTRAÎNEMENT
//
// Le garde-fou existait en base — statut, traçabilité, politiques — mais
// AUCUN ÉCRAN NE LE SERVAIT : seule la page d'administration globale de
// ParaPass permettait de valider, et elle est réservée à l'éditeur. Un DT ne
// pouvait donc rien relire, et les questions écrites restaient invisibles.
//
// Ce qui se joue ici n'est pas une saisie de contenu, c'est un ACTE DE
// SÉCURITÉ. Une réponse fausse sur une hauteur d'ouverture peut coûter une
// vie. L'écran est donc construit autour de la relecture, pas de la
// production :
//
//   • la bonne réponse est MISE EN ÉVIDENCE, on ne la cherche pas ;
//   • la source est affichée à côté de la question, pour recouper ;
//   • on peut CORRIGER avant de valider — relire sans pouvoir amender ne
//     laisse que deux options, tout accepter ou tout refuser ;
//   • valider est signé et daté automatiquement (déclencheur en base) ;
//   • refuser n'efface rien : la question repart en brouillon avec son motif.
//
// Les questions de la banque commune ParaPass apparaissent en lecture : un
// centre voit ce qu'on lui propose, mais ne réécrit pas le fonds commun.
// ═══════════════════════════════════════════════════════════════════════════

const NIVEAUX = ['PAC1', 'PAC2', 'PAC3', 'PAC4', 'A', 'B', 'B1', 'B2', 'B3', 'B4', 'B5', 'Bi4', 'Bi5', 'BPA', 'C', 'D'];
const CLES = ['a', 'b', 'c', 'd'];

interface Proposition { cle: string; texte: string }

interface Question {
  id: string;
  enonce: string;
  propositions: Proposition[];
  bonne_reponse: string;
  explication: string;
  reference_reglementaire: string | null;
  source_officielle: string | null;
  theme: string;
  niveau_brevet_mini: string | null;
  difficulte: number;
  statut: string;
  centre_id: string | null;
}

const VIDE = (centreId: string): Omit<Question, 'id'> => ({
  enonce: '', propositions: CLES.map(c => ({ cle: c, texte: '' })),
  bonne_reponse: 'a', explication: '', reference_reglementaire: '', source_officielle: '',
  theme: 'securite', niveau_brevet_mini: 'A', difficulte: 1,
  statut: 'en_attente_validation', centre_id: centreId,
});

const champ: React.CSSProperties = {
  background: 'var(--c-border)', border: '1px solid var(--c-border-f)', color: 'white',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%',
};

function Carte({ q, onFait }: { q: Question; onFait: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState<Question>(q);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { setBrouillon(q); }, [q]);

  const commune = q.centre_id === null;

  const ecrire = async (statut: string) => {
    setOccupe(true); setErreur(null);
    const { data, error } = await supabase.from('quiz_questions').update({
      enonce: brouillon.enonce.trim(),
      propositions: brouillon.propositions.filter(p => p.texte.trim()),
      bonne_reponse: brouillon.bonne_reponse,
      explication: brouillon.explication.trim(),
      reference_reglementaire: brouillon.reference_reglementaire?.trim() || null,
      theme: brouillon.theme,
      niveau_brevet_mini: brouillon.niveau_brevet_mini,
      difficulte: brouillon.difficulte,
      statut,
    }).eq('id', q.id).select('id');
    setOccupe(false);
    if (error || !data || data.length === 0) {
      console.error('Relecture question échouée :', error);
      setErreur(error?.message ?? 'Écriture refusée — la question n’a pas été modifiée.');
      return;
    }
    onFait();
  };

  const supprimer = async () => {
    setOccupe(true); setErreur(null);
    const { error } = await supabase.from('quiz_questions').delete().eq('id', q.id);
    setOccupe(false);
    if (error) { setErreur(error.message); return; }
    onFait();
  };

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{q.enonce || '(énoncé vide)'}</p>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#93C5FD' }}>
              {q.niveau_brevet_mini ?? 'tous niveaux'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--c-border)', color: 'var(--c-muted)' }}>
              {LIBELLE_THEME[q.theme] ?? q.theme}
            </span>
            {commune && (
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--c-muted)' }}>
                banque commune — lecture seule
              </span>
            )}
            {q.statut === 'refusee' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--sev-critique)' }}>refusée</span>
            )}
          </div>
        </div>
        <button onClick={() => setOuvert(o => !o)} className="p-1.5 rounded flex-shrink-0"
          style={{ color: 'var(--c-muted)', minHeight: 32, minWidth: 32 }}
          aria-label={ouvert ? 'Replier' : 'Relire la question'}>
          {ouvert ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
        </button>
      </div>

      {ouvert && (
        <div className="mt-3 flex flex-col gap-3">
          <textarea value={brouillon.enonce} disabled={commune} rows={2}
            onChange={e => setBrouillon(b => ({ ...b, enonce: e.target.value }))}
            placeholder="Énoncé de la question" style={champ} />

          {/* LA BONNE RÉPONSE EST DÉSIGNÉE, pas devinée : c'est ce qu'on relit. */}
          <div className="flex flex-col gap-1.5">
            {brouillon.propositions.map((p, i) => {
              const bonne = brouillon.bonne_reponse === p.cle;
              return (
                <div key={p.cle} className="flex items-center gap-2">
                  <button type="button" disabled={commune}
                    onClick={() => setBrouillon(b => ({ ...b, bonne_reponse: p.cle }))}
                    title="Désigner comme bonne réponse"
                    className="text-[11px] font-bold rounded-full flex-shrink-0 inline-flex items-center justify-center"
                    style={{
                      width: 28, height: 28,
                      background: bonne ? 'rgba(16,185,129,0.2)' : 'var(--c-border)',
                      color: bonne ? '#6EE7B7' : 'var(--c-muted)',
                      border: `1px solid ${bonne ? 'rgba(16,185,129,0.5)' : 'var(--c-border-f)'}`,
                    }}>
                    {bonne ? <Check className="w-3.5 h-3.5" aria-hidden /> : p.cle}
                  </button>
                  <input value={p.texte} disabled={commune}
                    onChange={e => setBrouillon(b => ({
                      ...b, propositions: b.propositions.map((x, j) => j === i ? { ...x, texte: e.target.value } : x),
                    }))}
                    placeholder={`Proposition ${p.cle}`} style={champ} />
                </div>
              );
            })}
          </div>

          <textarea value={brouillon.explication} disabled={commune} rows={2}
            onChange={e => setBrouillon(b => ({ ...b, explication: e.target.value }))}
            placeholder="Explication — pourquoi cette réponse, pas seulement laquelle" style={champ} />

          <input value={brouillon.reference_reglementaire ?? ''} disabled={commune}
            onChange={e => setBrouillon(b => ({ ...b, reference_reglementaire: e.target.value }))}
            placeholder="Référence (ex. DT n° 49, référentiel brevet B)" style={champ} />

          {q.source_officielle && (
            <p className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--c-dim)' }}>
              <BookOpen className="w-3 h-3 flex-shrink-0 mt-px" aria-hidden />
              {q.source_officielle}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            <select value={brouillon.niveau_brevet_mini ?? ''} disabled={commune}
              onChange={e => setBrouillon(b => ({ ...b, niveau_brevet_mini: e.target.value || null }))}
              style={{ ...champ, width: 'auto' }}>
              <option value="">Tous niveaux</option>
              {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={brouillon.theme} disabled={commune}
              onChange={e => setBrouillon(b => ({ ...b, theme: e.target.value }))}
              style={{ ...champ, width: 'auto' }}>
              {THEMES_ACADEMIE.map(t => <option key={t.cle} value={t.cle}>{t.libelle}</option>)}
            </select>
            <select value={brouillon.difficulte} disabled={commune}
              onChange={e => setBrouillon(b => ({ ...b, difficulte: Number(e.target.value) }))}
              style={{ ...champ, width: 'auto' }}>
              <option value={1}>Facile</option><option value={2}>Moyen</option><option value={3}>Difficile</option>
            </select>
          </div>

          {erreur && (
            <p role="alert" className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--sev-critique)' }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden /> {erreur}
            </p>
          )}

          {!commune && (
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => ecrire('validee')} disabled={occupe}
                className="flex items-center gap-1.5 text-xs font-bold px-3 rounded-lg text-white disabled:opacity-50"
                style={{ background: '#10B981', minHeight: 40 }}>
                <Check className="w-3.5 h-3.5" aria-hidden /> Valider et diffuser
              </button>
              <button onClick={() => ecrire('refusee')} disabled={occupe}
                className="flex items-center gap-1.5 text-xs font-bold px-3 rounded-lg text-white disabled:opacity-50"
                style={{ background: '#EF4444', minHeight: 40 }}>
                <X className="w-3.5 h-3.5" aria-hidden /> Refuser
              </button>
              <button onClick={() => ecrire('en_attente_validation')} disabled={occupe}
                className="text-xs font-semibold px-3 rounded-lg disabled:opacity-50"
                style={{ background: 'var(--c-border)', color: 'var(--c-text2)', minHeight: 40 }}>
                Enregistrer sans diffuser
              </button>
              <button onClick={supprimer} disabled={occupe}
                className="ml-auto p-2 rounded" style={{ color: 'var(--c-dim)' }}
                aria-label="Supprimer la question" title="Supprimer">
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Inner({ centreId }: { centreId: string }) {
  const parametres = useParametresAcademie();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [creation, setCreation] = useState(() => VIDE(centreId));
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await supabase.rpc('academie_questions_a_valider', { p_centre_id: centreId });
    setChargement(false);
    if (error) {
      console.error('File de relecture échouée :', error);
      // Aucune liste plutôt qu'une liste fausse : annoncer « rien à relire »
      // parce qu'une requête a échoué laisserait des questions en attente
      // indéfiniment.
      setErreur(error.message);
      return;
    }
    setErreur(null);
    setQuestions((data ?? []) as Question[]);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  const creer = async () => {
    setEnCours(true);
    const { error } = await supabase.from('quiz_questions').insert({
      ...creation,
      propositions: creation.propositions.filter(p => p.texte.trim()),
      centre_id: centreId,
      statut: 'en_attente_validation',
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setCreation(VIDE(centreId));
    setNouvelle(false);
    charger();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
          <BookOpen className="w-6 h-6" style={{ color: '#F97316' }} aria-hidden /> Questions à relire
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
          Une question n’est servie aux parachutistes qu’une fois validée par un moniteur ou le DT.
          Relisez, corrigez si besoin, puis validez — la validation est signée et datée.
        </p>
      </div>

      {/* La ligne que personne ne doit oublier, y compris côté centre. */}
      <div className="rounded-xl px-4 py-3 flex flex-col gap-2"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(96,165,250,0.3)' }}>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text2)' }}>
          {parametres.mentionEntrainement}
        </p>
        <a href={parametres.qcmOfficielUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs font-bold inline-flex items-center gap-1.5 no-underline" style={{ color: '#60A5FA' }}>
          QCM officiel de la FFP <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden />
        </a>
      </div>

      {erreur && (
        <div role="alert" className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--sev-critique)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden /> {erreur}
        </div>
      )}

      <button onClick={() => setNouvelle(n => !n)}
        className="flex items-center gap-1.5 text-xs font-bold px-4 rounded-lg text-white"
        style={{ background: '#F97316', minHeight: 40 }}>
        <Plus className="w-3.5 h-3.5" aria-hidden /> Écrire une question pour mon centre
      </button>

      {nouvelle && (
        <div className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--c-surface)', border: '1px dashed var(--c-border-f)' }}>
          <textarea value={creation.enonce} rows={2} placeholder="Énoncé de la question"
            onChange={e => setCreation(c => ({ ...c, enonce: e.target.value }))} style={champ} />
          {creation.propositions.map((p, i) => (
            <div key={p.cle} className="flex items-center gap-2">
              <button type="button" onClick={() => setCreation(c => ({ ...c, bonne_reponse: p.cle }))}
                title="Désigner comme bonne réponse"
                className="text-[11px] font-bold rounded-full flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: 28, height: 28,
                  background: creation.bonne_reponse === p.cle ? 'rgba(16,185,129,0.2)' : 'var(--c-border)',
                  color: creation.bonne_reponse === p.cle ? '#6EE7B7' : 'var(--c-muted)',
                  border: `1px solid ${creation.bonne_reponse === p.cle ? 'rgba(16,185,129,0.5)' : 'var(--c-border-f)'}`,
                }}>
                {creation.bonne_reponse === p.cle ? <Check className="w-3.5 h-3.5" aria-hidden /> : p.cle}
              </button>
              <input value={p.texte} placeholder={`Proposition ${p.cle}`} style={champ}
                onChange={e => setCreation(c => ({
                  ...c, propositions: c.propositions.map((x, j) => j === i ? { ...x, texte: e.target.value } : x),
                }))} />
            </div>
          ))}
          <textarea value={creation.explication} rows={2}
            placeholder="Explication — pourquoi cette réponse, pas seulement laquelle"
            onChange={e => setCreation(c => ({ ...c, explication: e.target.value }))} style={champ} />
          <input value={creation.reference_reglementaire ?? ''} placeholder="Référence (ex. DT n° 49)"
            onChange={e => setCreation(c => ({ ...c, reference_reglementaire: e.target.value }))} style={champ} />
          <div className="flex gap-2 flex-wrap">
            <select value={creation.niveau_brevet_mini ?? ''} style={{ ...champ, width: 'auto' }}
              onChange={e => setCreation(c => ({ ...c, niveau_brevet_mini: e.target.value || null }))}>
              <option value="">Tous niveaux</option>
              {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={creation.theme} style={{ ...champ, width: 'auto' }}
              onChange={e => setCreation(c => ({ ...c, theme: e.target.value }))}>
              {THEMES_ACADEMIE.map(t => <option key={t.cle} value={t.cle}>{t.libelle}</option>)}
            </select>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
            Elle sera créée « en attente de relecture » — y compris celles que vous écrivez vous-même.
          </p>
          <div className="flex gap-2">
            <button onClick={creer} disabled={enCours || !creation.enonce.trim()}
              className="text-xs font-bold px-4 rounded-lg text-white disabled:opacity-50"
              style={{ background: '#F97316', minHeight: 40 }}>
              {enCours ? 'Enregistrement…' : 'Créer'}
            </button>
            <button onClick={() => setNouvelle(false)} className="text-xs px-3 rounded-lg"
              style={{ background: 'var(--c-border)', color: 'var(--c-text2)', minHeight: 40 }}>Annuler</button>
          </div>
        </div>
      )}

      {chargement ? null : questions.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--c-dim)' }}>
          Aucune question en attente de relecture.
        </p>
      ) : (
        <div className="space-y-2">
          {questions.map(q => <Carte key={q.id} q={q} onFait={charger} />)}
        </div>
      )}
    </div>
  );
}

export function RelectureQuestions({ centreId }: { centreId: string }) {
  return <ErrorBoundary><Inner centreId={centreId} /></ErrorBoundary>;
}
