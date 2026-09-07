import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LecteurQr } from '../../components/LecteurQr';
import { ymdLocal } from '../../lib/datetime';
import { evaluerConformite, type Evaluation, type Verdict } from '../../lib/feuVert';
import { interpreterQr, comportement, motifRecevable, type Regime, type ActionEmbarquement } from '../../lib/embarquement';
import { messageErreur } from '../../lib/avionnage';
import { action, SEVERITE_COULEUR } from '../../lib/jetons';
import { ArrowLeft, Users } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// FEU VERT · P5 — /centre/embarquement. Le geste réel.
//
// Un téléphone tenu d'une main, en plein soleil, au pied de l'avion. Le chef
// de largage scanne, voit une couleur, avance. Tout ce qui est écrit ici
// vise la seconde du geste (P6) :
//   • la caméra occupe la moitié haute, le verdict au moins un tiers ;
//   • vert : rien à lire, rien à toucher, retour au scan tout seul ;
//   • aucun texte informatif sous 14 px ; aucun geste de précision ;
//   • le mot « bloqué » n'apparaît nulle part — en régime informatif, le
//     système n'empêche rien, il constate. L'écran le dit tel quel.
//
// CHAQUE scan écrit une évaluation ET une ligne d'embarquement, quel que
// soit le verdict. Le compteur en haut est ce qui rendra visible le
// contournement le plus probable : monter sans passer devant l'appareil.
// ═══════════════════════════════════════════════════════════════════════════

interface Personne { parachutiste_id: string; nom: string; prenom: string; photo_url: string | null; numero_licence: string | null }
interface Rotation { id: string; numero: number; heure_prevue: string | null; immat: string | null }

const COULEUR: Record<Verdict, string> = {
  vert: SEVERITE_COULEUR.conforme, orange: SEVERITE_COULEUR.vigilance,
  rouge: SEVERITE_COULEUR.critique, gris: 'var(--c-muted)',
};

function EmbarquementInner() {
  const navigate = useNavigate();
  const jour = ymdLocal(new Date());
  const [centreId, setCentreId] = useState<string | null>(null);
  const [regime, setRegime] = useState<Regime>('informatif');
  // Cacher un bouton ne ferme pas une porte : l'URL reste tapable. L'écran
  // vérifie donc lui-même le drapeau. 'inconnu' tant qu'on ne sait pas —
  // on n'ouvre pas par défaut.
  const [feuVert, setFeuVert] = useState<'inconnu' | 'actif' | 'inactif'>('inconnu');
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [rotation, setRotation] = useState<string>('');          // id, ou texte libre
  const [rotationLibre, setRotationLibre] = useState('');
  const [embarques, setEmbarques] = useState(0);

  const [personne, setPersonne] = useState<Personne | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [actionEnCours, setActionEnCours] = useState<ActionEmbarquement | null>(null);
  const [motif, setMotif] = useState('');
  const [signataire, setSignataire] = useState('');
  const retourRef = useRef<number | null>(null);

  const libelleRotation = rotation === '__libre__' ? rotationLibre.trim()
    : rotations.find(r => r.id === rotation) ? `rotation ${rotations.find(r => r.id === rotation)!.numero}` : '';
  const rotationId = rotations.some(r => r.id === rotation) ? rotation : null;

  // ── Contexte : le centre de l'admin, le régime, les rotations du jour ────
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: ac } = await supabase.from('admin_centres').select('centre_id')
        .eq('profile_id', u.user?.id ?? '').limit(1);
      const cid = ac?.[0]?.centre_id ?? null;
      setCentreId(cid);
      if (!cid) return;
      const [{ data: opt }, { data: rot }] = await Promise.all([
        supabase.from('centres_options').select('feu_vert_actif, feu_vert_bloquant').eq('centre_id', cid).maybeSingle(),
        supabase.from('rotations').select('id, numero, heure_prevue, aeronefs(immatriculation)')
          .eq('centre_id', cid).eq('date_jour', jour).neq('statut', 'annulee').order('numero'),
      ]);
      setRegime(opt?.feu_vert_bloquant ? 'bloquant' : 'informatif');
      setFeuVert(opt?.feu_vert_actif ? 'actif' : 'inactif');
      setRotations((rot ?? []).map(r => {
        const av = r.aeronefs as { immatriculation?: string } | { immatriculation?: string }[] | null;
        return { id: r.id, numero: r.numero, heure_prevue: r.heure_prevue,
                 immat: (Array.isArray(av) ? av[0]?.immatriculation : av?.immatriculation) ?? null };
      }));
    })();
  }, [jour]);

  // ── Le compteur : lu dans le journal, pas dans un état local ─────────────
  const compter = useCallback(async () => {
    if (!centreId || !libelleRotation) { setEmbarques(0); return; }
    const { data } = await supabase.from('journal_securite').select('charge_utile')
      .eq('centre_id', centreId).eq('type_evenement', 'embarquement_consigne')
      .gte('horodatage_serveur', `${jour}T00:00:00`);
    const n = (data ?? []).filter(e => {
      const c = e.charge_utile as { rotation?: string; decision?: string };
      return c.rotation === libelleRotation && c.decision !== 'refuse';
    }).length;
    setEmbarques(n);
  }, [centreId, libelleRotation, jour]);
  useEffect(() => { compter(); }, [compter]);

  const retourAuScan = useCallback(() => {
    if (retourRef.current) { clearTimeout(retourRef.current); retourRef.current = null; }
    setPersonne(null); setEvaluation(null); setEvaluationId(null);
    setActionEnCours(null); setMotif(''); setSignataire(''); setErreur(null);
  }, []);

  /**
   * Repli de saisie manuelle : un NUMÉRO DE LICENCE, lu sur la carte physique
   * quand la caméra est morte. Il n'identifie PAS de façon sûre — mesuré :
   * deux licenciés de BigAir partagent « 0964399 ». On refuse donc dès qu'il
   * y a plus d'un porteur, en nommant les personnes, plutôt que d'en choisir
   * une au hasard. Un homonyme embarqué à la place d'un autre serait pire
   * que pas de repli du tout.
   */
  const parNumeroLicence = useCallback(async (numero: string): Promise<{ id?: string; erreur?: string }> => {
    if (!centreId) return { erreur: 'Centre inconnu.' };
    const { data, error } = await supabase.from('licencies_centres')
      .select('parachutiste_id, profiles!parachutiste_id(id, nom, prenom, numero_licence)')
      .eq('centre_id', centreId).eq('statut', 'actif');
    if (error) return { erreur: messageErreur(error) };
    type Pr = { id: string; nom: string; prenom: string; numero_licence: string | null };
    const cible = numero.trim().toLowerCase();
    const trouves = ((data ?? []) as unknown as { profiles: Pr | Pr[] | null }[])
      .map(x => Array.isArray(x.profiles) ? x.profiles[0] : x.profiles)
      .filter((pr): pr is Pr => !!pr && (pr.numero_licence ?? '').trim().toLowerCase() === cible);
    if (trouves.length === 0) return { erreur: 'Aucun licencié actif de ce centre ne porte ce numéro.' };
    if (trouves.length > 1) {
      return { erreur: `Ce numéro est porté par ${trouves.length} personnes (${trouves.map(t => `${t.prenom} ${t.nom}`).join(', ')}). Scannez la carte, ou embarquez depuis l'Avionnage.` };
    }
    return { id: trouves[0].id };
  }, [centreId]);

  // ── Le scan : résoudre, évaluer, ÉCRIRE, montrer ─────────────────────────
  const scanner = useCallback(async (brut: string) => {
    if (!centreId || occupe || personne) return;
    const lu = interpreterQr(brut);
    if (!libelleRotation) { setErreur('Choisissez la rotation avant de scanner.'); return; }
    if (!lu && !brut.trim()) return;
    const cid = centreId;   // déjà garanti non nul ci-dessus ; capturé pour `suite`
    setOccupe(true); setErreur(null);
    try {
      // Un QR lisible passe par resoudre_scan. Sinon — ou si le jeton est
      // inconnu — on tente le numéro de licence, qui est ce que le DT a sous
      // les yeux quand la caméra ne répond pas.
      let valeur = lu?.valeur ?? null;
      if (valeur) {
        const { data: p, error: e1 } = await supabase.rpc('resoudre_scan', { p_centre_id: centreId, p_valeur: valeur });
        if (!e1 && p?.[0]) { await suite(p[0] as Personne); return; }
        if (e1 && (e1 as { code?: string }).code === '42501') { setErreur(messageErreur(e1)); return; }
        valeur = null;   // jeton inconnu : on retombe sur le numéro de licence
      }
      const par = await parNumeroLicence(brut);
      if (!par.id) { setErreur(par.erreur ?? 'Carte non reconnue.'); return; }
      const { data: p2, error: e2b } = await supabase.rpc('resoudre_scan', { p_centre_id: centreId, p_valeur: par.id });
      if (e2b || !p2?.[0]) { setErreur(e2b ? messageErreur(e2b) : 'Carte non reconnue.'); return; }
      await suite(p2[0] as Personne);
    } finally { setOccupe(false); }

    async function suite(pers: Personne) {
      const ev = await evaluerConformite(pers.parachutiste_id, cid, { date: jour, typeSaut: 'solo', rotationId: rotationId ?? undefined });

      // Chaque scan écrit une évaluation — quel que soit le résultat.
      const { data: ins, error: e2 } = await supabase.from('evaluations').insert({
        parachutiste_id: pers.parachutiste_id, centre_id: cid, rotation_id: rotationId,
        verdict: ev.verdict, motifs: ev.motifs, version_referentiel: ev.versionReferentiel, regime,
      }).select('id').single();
      if (e2) { setErreur('Évaluation non consignée : ' + messageErreur(e2)); return; }

      // …et une ligne d'embarquement. Un vert monte ; le reste attend une décision.
      await supabase.rpc('journaliser', {
        p_centre_id: cid, p_type: 'embarquement_consigne',
        p_charge: { rotation: libelleRotation, rotation_id: rotationId, parachutiste_id: pers.parachutiste_id,
                    evaluation_id: ins.id, verdict: ev.verdict,
                    decision: ev.verdict === 'vert' ? 'monte' : 'en_attente' },
      });

      setPersonne(pers); setEvaluation(ev); setEvaluationId(ins.id);
      const c = comportement(ev.verdict, regime);
      if (c.retourAutomatiqueMs) {
        retourRef.current = window.setTimeout(() => { retourAuScan(); compter(); }, c.retourAutomatiqueMs);
      }
    }
  }, [centreId, occupe, personne, libelleRotation, rotationId, jour, regime, retourAuScan, compter, parNumeroLicence]);

  // ── Une décision sur un verdict non vert ─────────────────────────────────
  const decider = async (a: ActionEmbarquement) => {
    if (!centreId || !evaluationId || !evaluation || !personne) return;
    if (a.motifObligatoire && !motifRecevable(motif)) { setErreur('Un motif écrit est obligatoire.'); return; }
    setOccupe(true); setErreur(null);
    try {
      const premierMotif = evaluation.motifs[0]?.codeRegle ?? '—';
      if (a.cle === 'lever' || a.cle === 'consigner_et_laisser') {
        const { error } = await supabase.from('levees').insert({
          evaluation_id: evaluationId, code_regle: premierMotif,
          type: a.cle === 'lever' ? 'levee' : 'passage_outre',
          auteur_habilitation: a.habilitation, motif: motif.trim() + (signataire ? ` — signé ${signataire.trim()}` : ''),
          portee: 'individu',
        });
        if (error) { setErreur(messageErreur(error)); return; }
      }
      await supabase.rpc('journaliser', {
        p_centre_id: centreId, p_type: 'embarquement_consigne',
        p_charge: { rotation: libelleRotation, rotation_id: rotationId, parachutiste_id: personne.parachutiste_id,
                    evaluation_id: evaluationId, verdict: evaluation.verdict,
                    decision: a.cle === 'refuser' ? 'refuse' : a.cle === 'prevenir_dt' ? 'dt_prevenu'
                            : a.cle === 'lever' ? 'levee' : 'passage_outre',
                    motif: a.motifObligatoire ? motif.trim() : undefined },
      });
      retourAuScan(); compter();
    } finally { setOccupe(false); }
  };

  const c = evaluation ? comportement(evaluation.verdict, regime) : null;

  if (feuVert !== 'actif') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
        <p style={{ fontSize: 17, fontWeight: 700 }}>
          {feuVert === 'inconnu' ? 'Vérification…' : 'Feu Vert n’est pas activé sur ce centre'}
        </p>
        {feuVert === 'inactif' && (
          <p style={{ fontSize: 14, color: 'var(--c-muted)', maxWidth: 420 }}>
            Le contrôle par scan à l’embarquement fait partie du module Feu Vert.
            Il s’active depuis Gestion → Référentiel Feu Vert.
          </p>
        )}
        <button type="button" onClick={() => navigate('/centre/journee?mode=avionnage')}
          style={action('secondaire')}>
          <ArrowLeft className="w-4 h-4" aria-hidden /> Retour à l’avionnage
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      {/* ── Bandeau : rotation + compteur. Le compteur est la pièce maîtresse. ── */}
      <header className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--c-nav)' }}>
        <button type="button" onClick={() => navigate('/centre/journee?mode=avionnage')}
          aria-label="Retour" style={{ minHeight: 44, minWidth: 44, color: 'var(--c-text)' }}>
          <ArrowLeft className="w-6 h-6" aria-hidden />
        </button>
        <select value={rotation} onChange={e => setRotation(e.target.value)} aria-label="Rotation"
          className="flex-1 min-w-0 px-2 rounded-xl"
          style={{ minHeight: 44, fontSize: 16, background: 'var(--c-input)', color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }}>
          <option value="">Rotation…</option>
          {rotations.map(r => (
            <option key={r.id} value={r.id}>
              Rot. {r.numero}{r.heure_prevue ? ` · ${r.heure_prevue.slice(0, 5)}` : ''}{r.immat ? ` · ${r.immat}` : ''}
            </option>
          ))}
          <option value="__libre__">Saisie libre…</option>
        </select>
        <span className="flex items-center gap-1 whitespace-nowrap font-extrabold" style={{ fontSize: 16 }}>
          <Users className="w-5 h-5" aria-hidden />{embarques} embarqué{embarques > 1 ? 's' : ''}
        </span>
      </header>
      {rotation === '__libre__' && (
        <input value={rotationLibre} onChange={e => setRotationLibre(e.target.value)}
          placeholder="Ex. : rotation 3 · 14 h 30 · F-HPCJ" aria-label="Rotation en saisie libre"
          className="mx-3 mt-2 px-3 rounded-xl"
          style={{ minHeight: 44, fontSize: 16, background: 'var(--c-input)', color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
      )}
      {regime === 'bloquant' && (
        <p className="mx-3 mt-2 px-3 py-1.5 rounded-xl" style={{ fontSize: 14, background: 'color-mix(in srgb, var(--sev-critique) 12%, transparent)', color: 'var(--c-text2)' }}>
          Régime bloquant actif sur ce centre.
        </p>
      )}

      {/* ── La caméra : la moitié haute ──────────────────────────────────── */}
      <div style={{ height: '46vh', flexShrink: 0 }}>
        <LecteurQr onDecode={scanner} actif={!personne && !occupe && !!libelleRotation} />
      </div>

      {/* ── Le verdict : au moins un tiers de l'écran, en pastille pleine ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {!personne ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
            <p style={{ fontSize: 16, color: 'var(--c-muted)', textAlign: 'center' }}>
              {!libelleRotation ? 'Choisissez la rotation, puis présentez la carte.' : occupe ? 'Lecture…' : 'Présentez la carte ParaPass.'}
            </p>
            {/* Repli sans caméra : le numéro de licence, en gros, à une main. */}
            <form className="w-full flex gap-2" onSubmit={e => { e.preventDefault(); scanner(saisie); setSaisie(''); }}>
              <input value={saisie} onChange={e => setSaisie(e.target.value)} placeholder="ou n° de licence / jeton"
                aria-label="Saisie manuelle" autoComplete="off"
                className="flex-1 min-w-0 px-3 rounded-xl"
                style={{ minHeight: 48, fontSize: 16, background: 'var(--c-input)', color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
              <button type="submit" style={{ ...action('secondaire'), minHeight: 48 }}>Valider</button>
            </form>
            {erreur && <p role="alert" style={{ fontSize: 14, color: 'var(--sev-critique)', textAlign: 'center' }}>{erreur}</p>}
          </div>
        ) : (
          <div className="flex-1 flex flex-col" style={{ background: `color-mix(in srgb, ${COULEUR[evaluation!.verdict]} 22%, var(--c-bg))` }}>
            <div className="flex items-center gap-3 px-4 pt-4">
              {personne.photo_url
                ? <img src={personne.photo_url} alt="" className="rounded-2xl object-cover flex-shrink-0" style={{ width: 72, height: 72 }} />
                : <div className="rounded-2xl flex-shrink-0" style={{ width: 72, height: 72, background: 'rgba(0,0,0,0.25)' }} />}
              <div className="min-w-0">
                <p className="font-extrabold leading-tight" style={{ fontSize: 24 }}>{personne.prenom} {personne.nom}</p>
                <p className="font-extrabold" style={{ fontSize: 22, color: COULEUR[evaluation!.verdict] }}>{c!.titre}</p>
              </div>
            </div>

            {evaluation!.verdict !== 'vert' && (
              <div className="px-4 pt-3">
                {evaluation!.motifs.slice(0, 2).map(m => (
                  <div key={m.codeRegle} className="mb-2">
                    <p style={{ fontSize: 16, fontWeight: 700 }}>{m.libelle}</p>
                    {/* Le texte source, cité : c'est lui que le système oppose. */}
                    <p style={{ fontSize: 14, color: 'var(--c-text2)' }}>{m.detail} — <em>{m.source}</em></p>
                  </div>
                ))}
                {evaluation!.motifs.length > 2 && (
                  <p style={{ fontSize: 14, color: 'var(--c-muted)' }}>+{evaluation!.motifs.length - 2} autre(s) motif(s)</p>
                )}
                <p className="mt-1" style={{ fontSize: 14, color: 'var(--c-text2)' }}>{c!.sousTitre}</p>
              </div>
            )}

            {actionEnCours ? (
              <div className="px-4 pt-3 space-y-2">
                <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={2}
                  placeholder={`Motif obligatoire pour « ${actionEnCours.libelle} »`} aria-label="Motif"
                  className="w-full px-3 py-2 rounded-xl"
                  style={{ fontSize: 16, background: 'var(--c-input)', color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                {actionEnCours.habilitation !== 'aucun' && (
                  <input value={signataire} onChange={e => setSignataire(e.target.value)}
                    placeholder={`Nom de la personne habilitée (${actionEnCours.habilitation})`} aria-label="Signataire"
                    className="w-full px-3 rounded-xl"
                    style={{ minHeight: 44, fontSize: 16, background: 'var(--c-input)', color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                )}
                <div className="flex gap-2">
                  <button type="button" disabled={occupe} onClick={() => decider(actionEnCours)}
                    style={{ ...action('principal'), flex: 1, justifyContent: 'center', minHeight: 52, fontSize: 16 }}>
                    {actionEnCours.libelle}
                  </button>
                  <button type="button" onClick={() => { setActionEnCours(null); setMotif(''); }}
                    style={{ ...action('secondaire'), minHeight: 52, fontSize: 16 }}>Annuler</button>
                </div>
              </div>
            ) : (
              <div className="mt-auto px-4 pb-4 pt-3 flex flex-col gap-2">
                {c!.actions.map(a => (
                  <button key={a.cle} type="button" disabled={occupe}
                    onClick={() => a.motifObligatoire ? setActionEnCours(a) : decider(a)}
                    style={{ ...action(a.rang), justifyContent: 'center', minHeight: 56, fontSize: 17 }}>
                    {a.libelle}
                  </button>
                ))}
                {evaluation!.verdict !== 'vert' && (
                  <button type="button" onClick={retourAuScan}
                    style={{ ...action('texte'), alignSelf: 'center', minHeight: 44, fontSize: 15 }}>
                    Retour au scan sans décision
                  </button>
                )}
              </div>
            )}
            {erreur && <p role="alert" className="px-4 pb-3" style={{ fontSize: 14, color: 'var(--sev-critique)' }}>{erreur}</p>}
          </div>
        )}
      </main>
    </div>
  );
}

export function EmbarquementPage() {
  return <ErrorBoundary><EmbarquementInner /></ErrorBoundary>;
}
