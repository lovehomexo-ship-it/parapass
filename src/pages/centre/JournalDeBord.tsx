import { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import {
  Search, Lock, FileDown, CalendarDays, ShieldOff, Megaphone, CheckCheck,
  CloudSun, DoorOpen, DoorClosed, AlertTriangle, Circle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// P4 — JOURNAL DE BORD ET CLÔTURE DE JOURNÉE
//
// Le document qu'un directeur technique doit pouvoir sortir six mois plus tard :
// voilà ce qui s'est passé ce jour-là, et voilà ce que j'ai fait.
//
// Le journal est en AJOUT SEUL côté base (aucune policy UPDATE/DELETE, plus un
// déclencheur qui refuse explicitement). L'écran n'offre donc aucune action de
// modification : ce serait promettre ce que la base refuse.
// ═══════════════════════════════════════════════════════════════════════════

interface Entree {
  id: string;
  survenu_a: string;
  type: string;
  auteur_nom: string;
  texte: string;
}

const TYPES: Record<string, { label: string; couleur: string; Icone: typeof Circle }> = {
  ouverture:        { label: 'Ouverture',        couleur: '#34D399', Icone: DoorOpen },
  decision_meteo:   { label: 'Décision météo',   couleur: '#60A5FA', Icone: CloudSun },
  briefing_publie:  { label: 'Briefing',         couleur: '#A78BFA', Icone: Megaphone },
  acquittement:     { label: 'Acquittement',     couleur: '#38BDF8', Icone: CheckCheck },
  rotation_ouverte: { label: 'Rotation ouverte', couleur: '#FBBF24', Icone: DoorOpen },
  rotation_cloturee:{ label: 'Rotation close',   couleur: '#FBBF24', Icone: DoorClosed },
  derogation:       { label: 'Dérogation',       couleur: '#FB923C', Icone: ShieldOff },
  incident:         { label: 'Incident',         couleur: '#F87171', Icone: AlertTriangle },
  fermeture:        { label: 'Fermeture',        couleur: '#94A3B8', Icone: DoorClosed },
  autre:            { label: 'Autre',            couleur: '#94A3B8', Icone: Circle },
};

const heureDe = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function JournalInner({ centreId }: { centreId: string }) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(aujourdhui);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreType, setFiltreType] = useState<string>('tous');
  const [recherche, setRecherche] = useState('');
  const [cloture, setCloture] = useState<{ cloture_nom: string; cloture_le: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true); setErreur(null);
    const [{ data, error }, { data: cl }] = await Promise.all([
      supabase.from('journal_dz')
        .select('id, survenu_a, type, auteur_nom, texte')
        .eq('centre_id', centreId).eq('date_jour', date)
        .order('survenu_a', { ascending: true }),
      supabase.from('clotures_journee')
        .select('cloture_nom, cloture_le')
        .eq('centre_id', centreId).eq('date_jour', date).maybeSingle(),
    ]);
    if (error) {
      console.error('Journal de bord — chargement échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(error.message); setLoading(false); return;
    }
    setEntrees((data ?? []) as Entree[]);
    setCloture(cl ?? null);
    setLoading(false);
  }, [centreId, date]);

  useEffect(() => { charger(); }, [charger]);

  const clôturer = async () => {
    setEnCours(true);
    const { data, error } = await supabase.rpc('cloturer_journee', {
      p_centre_id: centreId, p_date: date,
    });
    setEnCours(false);
    if (error) {
      console.error('Clôture de journée — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      alert('La clôture a échoué : ' + error.message);
      return;
    }
    const res = data as { deja_cloturee: boolean; cloture_nom: string; synthese: Synthese };
    // La synthèse rendue est celle FIGÉE si la journée était déjà clôturée :
    // rouvrir la date produit donc exactement le même document.
    genererPdf(res.synthese, res.cloture_nom, date);
    charger();
  };

  const filtrees = entrees.filter(e =>
    (filtreType === 'tous' || e.type === filtreType) &&
    (recherche.trim() === '' ||
      (e.texte + ' ' + e.auteur_nom).toLowerCase().includes(recherche.toLowerCase())));

  const typesPresents = [...new Set(entrees.map(e => e.type))];

  if (loading) return <LoaderParaPass taille={72} message={null} />;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Journal de bord</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--c-dim)' }}>
          Chaque évènement de la journée, horodaté et signé. Le journal est en
          <strong> ajout seul</strong> : rien ne peut y être modifié ni supprimé.
        </p>
      </div>

      {/* Date + clôture */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-2xl p-4"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--c-muted)' }}>
          <CalendarDays className="w-4 h-4" aria-hidden />
          <input type="date" value={date} max={aujourdhui} onChange={e => setDate(e.target.value)}
            className="rounded-lg px-2 text-sm" style={{ minHeight: 40, background: 'var(--c-bg)',
              border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
        </label>

        {cloture ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#34D399' }}>
            <Lock className="w-4 h-4" aria-hidden />
            Clôturée par {cloture.cloture_nom} le {new Date(cloture.cloture_le).toLocaleDateString('fr-FR')}
            <button onClick={clôturer} disabled={enCours}
              className="ml-2 px-3 rounded-xl text-xs font-bold"
              style={{ minHeight: 40, background: 'var(--c-hover)', color: 'var(--c-text)' }}>
              <FileDown className="w-3.5 h-3.5 inline mr-1" aria-hidden />Rééditer le PDF
            </button>
          </div>
        ) : (
          <button onClick={clôturer} disabled={enCours}
            className="px-4 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ minHeight: 44, background: '#2563EB', color: '#fff' }}>
            {enCours ? 'Clôture en cours…' : 'Clôturer la journée'}
          </button>
        )}
      </div>

      {erreur && (
        <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>
          Journal indisponible : {erreur}
        </div>
      )}

      {/* Filtres + recherche */}
      {entrees.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-dim)' }} aria-hidden />
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher un nom, un motif…"
              className="w-full rounded-xl pl-9 pr-3 text-sm" style={{ minHeight: 44,
                background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['tous', ...typesPresents].map(t => (
              <button key={t} onClick={() => setFiltreType(t)}
                className="px-3 rounded-full text-xs font-semibold"
                style={{ minHeight: 36,
                  background: filtreType === t ? '#2563EB' : 'var(--c-surface)',
                  color: filtreType === t ? '#fff' : 'var(--c-muted)',
                  border: `1px solid ${filtreType === t ? '#2563EB' : 'var(--c-border)'}` }}>
                {t === 'tous' ? `Tout (${entrees.length})` : TYPES[t]?.label ?? t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Frise */}
      {filtrees.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--c-dim)' }}>
          {entrees.length === 0
            ? 'Aucun évènement consigné pour cette journée.'
            : 'Aucun évènement ne correspond à cette recherche.'}
        </p>
      ) : (
        <div className="relative pl-7">
          <div className="absolute left-2.5 top-2 bottom-2 w-px" style={{ background: 'var(--c-border-f)' }} />
          <div className="space-y-2">
            {filtrees.map(e => {
              const t = TYPES[e.type] ?? TYPES.autre;
              const Icone = t.Icone;
              return (
                <div key={e.id} className="relative">
                  <span className="absolute -left-[22px] top-3 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--c-bg)', border: `2px solid ${t.couleur}` }} />
                  <div className="rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: 'var(--c-dim)' }}>{heureDe(e.survenu_a)}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 rounded-full"
                        style={{ color: t.couleur, background: `${t.couleur}1A` }}>
                        <Icone className="w-3 h-3" aria-hidden />{t.label}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--c-dim)' }}>{e.auteur_nom}</span>
                    </div>
                    <p className="text-sm mt-1 break-words" style={{ color: 'var(--c-text2)' }}>{e.texte}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PDF de clôture ──────────────────────────────────────────────────────────

interface Synthese {
  date: string;
  centre: { nom: string; ville: string | null; code_ffp: string | null;
            dt: string | null; dt_licence: string | null } | null;
  briefing: { vent_kt: number | null; vent_deg: number | null; consignes: string | null;
              acquittements: { nom: string }[]; non_acquitte: string[] } | null;
  presents: number;
  sauts_par_categorie: Record<string, number>;
  derogations: { parachutiste: string; regle: string; motif: string; signataire: string }[];
  evenements: { heure: string; type: string; auteur: string; texte: string }[];
  encadrement: string[];
}

function genererPdf(s: Synthese, clotureNom: string, date: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15;
  const L = 180;
  let y = M;

  const titre = (t: string) => {
    y += 4;
    doc.setFillColor(0, 26, 77); doc.rect(M, y, L, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(t, M + 2, y + 5);
    y += 11; doc.setTextColor(30); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  };
  const ligne = (t: string, indent = 0) => {
    if (y > 275) { doc.addPage(); y = M; }
    for (const l of doc.splitTextToSize(t, L - indent)) { doc.text(l, M + indent, y); y += 4.6; }
  };

  // En-tête
  doc.setFillColor(0, 26, 77); doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text('Journal de bord — clôture de journée', M, 12);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`${s.centre?.nom ?? 'Centre'}${s.centre?.ville ? ' · ' + s.centre.ville : ''}`
    + `${s.centre?.code_ffp ? ' · ' + s.centre.code_ffp : ''}`, M, 19);
  y = 34; doc.setTextColor(30);

  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(new Date(date).toLocaleDateString('fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), M, y);
  y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Clôturée par ${clotureNom} — document édité le ${new Date().toLocaleString('fr-FR')}`, M, y);
  y += 4;

  titre('CENTRE ET ENCADREMENT');
  ligne(`Directeur technique de service : ${s.centre?.dt ?? 'non renseigné'}`
    + (s.centre?.dt_licence ? ` (licence ${s.centre.dt_licence})` : ''));

  titre('ACTIVITÉ');
  ligne(`Parachutistes présents : ${s.presents}`);
  const cats = Object.entries(s.sauts_par_categorie ?? {});
  ligne(`Sauts : ${cats.reduce((n, [, v]) => n + v, 0)}`
    + (cats.length ? ` (${cats.map(([k, v]) => `${k} : ${v}`).join(', ')})` : ''));
  ligne(`Encadrement de service : ${s.encadrement?.length ? s.encadrement.join(', ') : 'non renseigné'}`);

  titre('BRIEFING');
  if (!s.briefing) {
    ligne('Aucun briefing publié ce jour-là.');
  } else {
    ligne(`Vent : ${s.briefing.vent_kt ?? '?'} kt`
      + (s.briefing.vent_deg != null ? ` au ${s.briefing.vent_deg}°` : ''));
    if (s.briefing.consignes) ligne(`Consignes : ${s.briefing.consignes}`);
    ligne(`Acquitté par ${s.briefing.acquittements?.length ?? 0} personne(s) :`);
    ligne((s.briefing.acquittements ?? []).map(a => a.nom).join(', ') || '—', 4);
    if (s.briefing.non_acquitte?.length) {
      ligne(`Présents N'AYANT PAS acquitté (${s.briefing.non_acquitte.length}) :`);
      ligne(s.briefing.non_acquitte.join(', '), 4);
    }
  }

  titre('DÉROGATIONS ACCORDÉES');
  if (!s.derogations?.length) ligne('Aucune.');
  else for (const d of s.derogations) {
    ligne(`• ${d.parachutiste} — règle « ${d.regle} »`);
    ligne(`Motif : ${d.motif} — signée par ${d.signataire}`, 4);
  }

  titre('ÉVÈNEMENTS DE LA JOURNÉE');
  if (!s.evenements?.length) ligne('Aucun évènement consigné.');
  else for (const e of s.evenements) {
    ligne(`${new Date(e.heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}  ${e.texte}  (${e.auteur})`);
  }

  // Le manifest (P3) n'existe pas encore : on le DIT, plutôt que de laisser
  // croire qu'aucune rotation n'a eu lieu.
  titre('ROTATIONS');
  ligne('Module de manifest non installé — information non disponible pour cette journée.');

  doc.setFontSize(7); doc.setTextColor(120);
  doc.text('Document produit par ParaPass à partir du journal de bord, registre en ajout seul.',
    M, 288);

  doc.save(`journal-${s.centre?.nom?.replace(/\s+/g, '-').toLowerCase() ?? 'dz'}-${date}.pdf`);
}

export function JournalDeBord({ centreId }: { centreId: string }) {
  return <ErrorBoundary><JournalInner centreId={centreId} /></ErrorBoundary>;
}
