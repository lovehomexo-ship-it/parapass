import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { LoaderParaPass } from './LoaderParaPass';
import { ModaleSaisie } from './ModaleSaisie';
import { useMeteoAltitude, indexHeureCourante, kmhEnKt } from '../lib/meteoAltitude';
import {
  evaluerTousPublics, calculerDerive,
  type SeuilsPublic, type MesuresMeteo, type VerdictPublic, type Feu, type CoucheVent,
} from '../lib/meteoPublics';
import { CheckCircle2, AlertTriangle, XOctagon, Navigation, ExternalLink, Info } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// P7 — MÉTÉO DÉCISIONNELLE
//
// Un directeur technique ne se demande pas « fait-il beau ? » mais « QUI peut
// sauter ? ». D'où une GRILLE — une ligne par public, un feu par public, et le
// paramètre qui déclenche écrit en clair — plutôt qu'un feu unique qui ne peut
// pas dire qu'un vent de 22 kt ferme les élèves et laisse partir les confirmés.
//
// La décision reste au DT : les boutons Ouvert / Sous réserve / Fermé écrivent
// au journal de bord AVEC les conditions du moment, pour que « pourquoi on a
// fermé ce jour-là » ait une réponse six mois plus tard.
// ═══════════════════════════════════════════════════════════════════════════

const FEU_UI: Record<Feu, { couleur: string; fond: string; bord: string; Icone: typeof CheckCircle2; mot: string }> = {
  vert:   { couleur: '#34D399', fond: 'rgba(16,185,129,0.10)', bord: 'rgba(16,185,129,0.35)', Icone: CheckCircle2,  mot: 'Praticable' },
  orange: { couleur: '#FB923C', fond: 'rgba(249,115,22,0.10)', bord: 'rgba(249,115,22,0.35)', Icone: AlertTriangle, mot: 'Vigilance' },
  rouge:  { couleur: '#F87171', fond: 'rgba(239,68,68,0.10)',  bord: 'rgba(239,68,68,0.35)',  Icone: XOctagon,      mot: 'Hors seuils' },
};

const DECISIONS = [
  { cle: 'ouvert',       label: 'Ouvert',        couleur: '#10B981' },
  { cle: 'sous_reserve', label: 'Sous réserve',  couleur: '#F97316' },
  { cle: 'ferme',        label: 'Fermé',         couleur: '#EF4444' },
] as const;

function GrilleInner({ centreId }: { centreId: string }) {
  const { payload, loading: meteoLoading } = useMeteoAltitude(centreId);
  const [seuils, setSeuils] = useState<SeuilsPublic[]>([]);
  const [oaci, setOaci] = useState<string | null>(null);
  const [altLargage, setAltLargage] = useState(4000);
  const [decision, setDecision] = useState<{ decision: string; motif: string; auteur: string } | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  // Décision en cours de saisie (modale) et historique des décisions du jour.
  const [saisie, setSaisie] = useState<{ cle: string; label: string; couleur: string } | null>(null);
  const [historique, setHistorique] = useState<{ heure: string; texte: string }[]>([]);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    const jour = new Date().toISOString().slice(0, 10);
    const [{ data: s, error: e1 }, { data: c }, { data: j }] = await Promise.all([
      supabase.from('meteo_seuils_public').select('*').eq('centre_id', centreId),
      supabase.from('centres').select('code_oaci').eq('id', centreId).maybeSingle(),
      supabase.from('journal_dz').select('texte, auteur_nom, donnees, survenu_a')
        .eq('centre_id', centreId).eq('date_jour', jour).eq('type', 'decision_meteo')
        .order('survenu_a', { ascending: false }),
    ]);
    if (e1) {
      console.error('Seuils météo — chargement échoué :', {
        code: e1.code, message: e1.message, details: e1.details, hint: e1.hint,
      });
      setErreur(e1.message);
    }
    setSeuils((s ?? []) as SeuilsPublic[]);
    setOaci(c?.code_oaci ?? null);
    const lignes = (j ?? []) as { texte: string; auteur_nom: string; donnees: Record<string, unknown>; survenu_a: string }[];
    if (lignes.length > 0) {
      const d = (lignes[0].donnees ?? {}) as { decision?: string; motif?: string };
      setDecision({ decision: d.decision ?? '', motif: d.motif ?? '', auteur: lignes[0].auteur_nom });
    } else { setDecision(null); }
    // Historique : les conditions changent, la décision aussi. Chaque révision
    // est une NOUVELLE entrée du journal — rien n'est écrasé.
    setHistorique(lignes.map(l => ({
      heure: new Date(l.survenu_a).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      texte: String((l.donnees as { decision?: string })?.decision ?? ''),
    })));
    setChargement(false);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  if (chargement || meteoLoading) return <LoaderParaPass taille={72} message={null} />;

  // ── Mesures de l'heure en cours ──
  const i = payload ? indexHeureCourante(payload.times) : 0;
  const ventKt = payload ? kmhEnKt(payload.sol.speed[i] ?? 0) : 0;
  const rafalesKt = payload ? kmhEnKt(payload.sol.gusts[i] ?? 0) : 0;

  // Vent en altitude : le niveau le plus proche de l'altitude de largage.
  const niveauLargage = payload?.niveaux
    ?.slice().sort((a, b) => Math.abs(a.altM - altLargage) - Math.abs(b.altM - altLargage))[0];
  const ventAltitudeKt = niveauLargage ? kmhEnKt(niveauLargage.speed[i] ?? 0) : null;

  // Plafond estimé : sans mesure directe, on n'invente pas de valeur — on ne
  // renseigne le paramètre que si la couche basse est franchement couverte.
  const nuagesBas = payload?.nuages.bas[i] ?? 0;
  const plafondM = nuagesBas >= 70 ? 900 : nuagesBas >= 40 ? 1500 : null;

  const mesures: MesuresMeteo = { ventKt, rafalesKt, ventAltitudeKt, plafondM, visibiliteKm: null };
  const verdicts: VerdictPublic[] = evaluerTousPublics(seuils, mesures);

  // ── Dérive et point de largage ──
  const couches: CoucheVent[] = (payload?.niveaux ?? [])
    .filter(n => n.altM <= altLargage)
    .map(n => ({ altitudeM: n.altM, vitesseKt: kmhEnKt(n.speed[i] ?? 0), directionDeg: n.dir[i] ?? 0 }));
  const derive = calculerDerive(couches, altLargage);

  const prendreDecision = async (cle: string, label: string, motif: string) => {
    setEnvoi(true);
    const { error } = await supabase.rpc('journaliser', {
      p_centre_id: centreId,
      p_type: 'decision_meteo',
      p_texte: `Décision du jour : ${label}${motif.trim() ? ` — ${motif.trim()}` : ''}. `
        + `Conditions au moment de la décision : vent ${Math.round(ventKt)} kt, `
        + `rafales ${Math.round(rafalesKt)} kt`
        + (ventAltitudeKt != null ? `, vent en altitude ${Math.round(ventAltitudeKt)} kt` : '')
        + (plafondM != null ? `, plafond estimé ${plafondM} m` : '') + '.',
      p_donnees: {
        decision: cle, motif: motif.trim(),
        vent_kt: Math.round(ventKt), rafales_kt: Math.round(rafalesKt),
        vent_altitude_kt: ventAltitudeKt != null ? Math.round(ventAltitudeKt) : null,
        plafond_m: plafondM,
        verdicts: verdicts.map(v => ({ public: v.public_cible, feu: v.feu, declencheur: v.declencheur })),
      },
    });
    setEnvoi(false);
    if (error) {
      console.error('Décision du jour — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      alert('La décision n’a pas pu être consignée : ' + error.message);
      return;
    }
    charger();
  };

  return (
    <div className="rounded-2xl p-4 sm:p-5 space-y-4"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-s)' }}>

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold" style={{ color: 'var(--c-text)' }}>Qui peut sauter maintenant ?</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>
            Vent {Math.round(ventKt)} kt · rafales {Math.round(rafalesKt)} kt
            {ventAltitudeKt != null && ` · ${Math.round(ventAltitudeKt)} kt à ${niveauLargage?.altM} m`}
            {plafondM != null && ` · plafond estimé ${plafondM} m`}
          </p>
        </div>
        {oaci && (
          <a href={`https://aviationweather.gov/api/data/metar?ids=${oaci}&format=raw&taf=true`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: '#60A5FA', minHeight: 32 }}>
            METAR / TAF {oaci} <ExternalLink className="w-3 h-3" aria-hidden />
          </a>
        )}
      </div>

      {erreur && (
        <p className="text-xs" style={{ color: '#F87171' }}>Seuils indisponibles : {erreur}</p>
      )}

      {/* ── LA GRILLE : une ligne par public ── */}
      {verdicts.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--c-dim)' }}>
          Aucun seuil paramétré pour ce centre.
        </p>
      ) : (
        <div className="space-y-1.5">
          {verdicts.map(v => {
            const ui = FEU_UI[v.feu];
            const Icone = ui.Icone;
            const ouvert = detailOuvert === v.public_cible;
            return (
              <div key={v.public_cible} className="rounded-xl"
                style={{ background: ui.fond, border: `1px solid ${ui.bord}` }}>
                <button
                  onClick={() => setDetailOuvert(ouvert ? null : v.public_cible)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  style={{ minHeight: 48 }}>
                  <Icone className="w-5 h-5 flex-shrink-0" style={{ color: ui.couleur }} aria-hidden />
                  <span className="font-semibold text-sm flex-1 min-w-0" style={{ color: 'var(--c-text)' }}>
                    {v.libelle}
                  </span>
                  <span className="text-xs text-right" style={{ color: ui.couleur, fontWeight: 600 }}>
                    {v.declencheur ?? 'Dans les seuils'}
                  </span>
                </button>
                {ouvert && (
                  <div className="px-3 pb-3 pt-0 grid grid-cols-2 gap-x-4 gap-y-1">
                    {v.details.map(d => (
                      <div key={d.label} className="flex items-baseline justify-between text-[11px] gap-2">
                        <span style={{ color: 'var(--c-dim)' }}>{d.label}</span>
                        <span style={{ color: FEU_UI[d.feu].couleur, fontWeight: 600 }}>
                          {d.valeur} <span style={{ color: 'var(--c-dim)', fontWeight: 400 }}>({d.seuil})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Aide au largage ── */}
      {derive && (
        <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <Navigation className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#60A5FA' }} aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>
              Point de largage : {(derive.distanceM / 1000).toFixed(1)} km au {Math.round(derive.capDeg)}° depuis la cible
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-dim)' }}>
              Estimation à partir du profil de vent, pour un largage à {altLargage} m et un taux de chute de 5 m/s.
              <strong> C’est une aide, pas une consigne.</strong>
            </p>
            <label className="text-[11px] flex items-center gap-2 mt-1.5" style={{ color: 'var(--c-dim)' }}>
              Altitude de largage
              <select value={altLargage} onChange={e => setAltLargage(Number(e.target.value))}
                className="rounded-lg px-2 text-[11px]"
                style={{ minHeight: 32, background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                {[1500, 2200, 3000, 3500, 4000, 4200].map(a => <option key={a} value={a}>{a} m</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* ── Décision du jour ── */}
      <div className="pt-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Info className="w-3.5 h-3.5" style={{ color: 'var(--c-dim)' }} aria-hidden />
          <p className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
            L’application informe ; la décision vous appartient, et elle est consignée.
          </p>
        </div>
        {/* Les boutons restent TOUJOURS actifs : la météo évolue dans la journée,
            la décision doit pouvoir être révisée. Chaque révision crée une
            nouvelle entrée du journal — rien n'est écrasé, la chronologie des
            décisions reste lisible six mois plus tard. */}
        <div className="flex gap-2 flex-wrap">
          {DECISIONS.map(d => {
            const active = decision?.decision === d.cle;
            return (
              <button key={d.cle}
                onClick={() => setSaisie({ cle: d.cle, label: d.label, couleur: d.couleur })}
                disabled={envoi}
                className="flex-1 px-3 rounded-xl text-sm font-bold disabled:opacity-50 transition"
                style={{
                  minHeight: 48, minWidth: 110,
                  background: active ? d.couleur : 'transparent',
                  color: active ? '#fff' : d.couleur,
                  border: `2px solid ${d.couleur}`,
                  boxShadow: active ? `0 0 0 3px ${d.couleur}33` : 'none',
                }}>
                {d.label}
              </button>
            );
          })}
        </div>

        {decision && (
          <div className="mt-2 rounded-xl px-3 py-2.5 text-sm"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
              En vigueur : {DECISIONS.find(d => d.cle === decision.decision)?.label ?? decision.decision}
            </span>
            {decision.motif && <span style={{ color: 'var(--c-text2)' }}> — {decision.motif}</span>}
            <span className="text-xs block mt-0.5" style={{ color: 'var(--c-dim)' }}>
              Décidé par {decision.auteur} · consigné au journal de bord
            </span>
            {historique.length > 1 && (
              <p className="text-[11px] mt-1.5 pt-1.5" style={{ color: 'var(--c-dim)', borderTop: '1px solid var(--c-border)' }}>
                Journée : {historique.slice().reverse().map(h =>
                  `${h.heure} ${DECISIONS.find(d => d.cle === h.texte)?.label ?? h.texte}`).join(' → ')}
              </p>
            )}
          </div>
        )}
      </div>

      {saisie && (
        <ModaleSaisie
          titre={`Décision du jour : ${saisie.label}`}
          description={
            `Conditions retenues : vent ${Math.round(ventKt)} kt, rafales ${Math.round(rafalesKt)} kt`
            + (ventAltitudeKt != null ? `, ${Math.round(ventAltitudeKt)} kt en altitude` : '')
            + '. Elles seront consignées avec votre décision.'}
          label="Motif"
          placeholder="Ex. : rafales en hausse, élèves suspendus jusqu'à 15 h."
          libelleValider="Consigner la décision"
          couleurValider={saisie.couleur}
          onFermer={() => setSaisie(null)}
          onValider={async (motif) => {
            await prendreDecision(saisie.cle, saisie.label, motif);
            setSaisie(null);
          }}
        />
      )}
    </div>
  );
}

export function GrilleMeteoDZ({ centreId }: { centreId: string }) {
  return <ErrorBoundary><GrilleInner centreId={centreId} /></ErrorBoundary>;
}
