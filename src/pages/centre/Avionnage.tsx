import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ymdLocal } from '../../lib/datetime';
import { Plus, Plane, ScanLine, MoonStar } from 'lucide-react';
import { useDialogues } from '../../components/useDialogues';
import { action, enTeteSection } from '../../lib/jetons';
import { siegesOccupes, messageErreur } from '../../lib/avionnage';
import { FileAvionnageDZ } from './FileAvionnageDZ';
import { AjouterAeronef, type Aeronef } from './Rotations';
import { RechercheLicencie } from './RechercheLicencie';
import { DemoAvionnage } from '../../components/DemoAvionnage';
import {
  PlancheAvionnage, useHorlogeMinute, EnTetePlanches,
  type RotationVue, type PlaceVue,
} from './PlancheAvionnage';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — l'écran du chef d'avionnage. Troisième métier, troisième mode.
//
// Deux colonnes, comme sur les manifests professionnels :
//   à gauche  les PLANCHES, dans l'ordre des décollages, décompte en tête
//   à droite  la FILE, dans l'ordre d'arrivée, avec un bouton par planche
//             qui a encore de la place
//
// Sous 900 px, la file passe en dessous : au bord de la piste on tient un
// téléphone, pas un écran large.
//
// Une seule source pour chaque chiffre : les rotations et places viennent
// d'ici, la file vient de son propre crochet, l'aptitude de
// verdicts_du_jour (Feu Vert). L'ancien get_aptitude_du_jour a quitté cet
// écran : deux moteurs qui se contredisent, c'est ce que P7 interdit.
// ═══════════════════════════════════════════════════════════════════════════

function AvionnageInner({ centreId }: { centreId: string }) {
  const jour = ymdLocal(new Date());
  const maintenant = useHorlogeMinute();
  const [rotations, setRotations] = useState<RotationVue[]>([]);
  const [places, setPlaces] = useState<PlaceVue[]>([]);
  const [aeronefs, setAeronefs] = useState<Aeronef[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [verdictsParPersonne, setVerdictsParPersonne] = useState<Map<string, PlaceVue['aptitude']>>(new Map());
  // DEUX drapeaux, pas un. Je les avais confondus : le bouton était branché
  // sur feu_vert_actif, puis activer les feux a fait revenir le bouton.
  //   feu_vert_actif   → le moteur et les feux
  //   embarquement_qr  → l'écran de scan. Faux par défaut.
  const [scanOuvert, setScanOuvert] = useState(false);
  // Les largueurs QUALIFIÉS du centre, pour le sélecteur de désignation.
  const [largueurs, setLargueurs] = useState<{ parachutiste_id: string; nom: string; prenom: string }[]>([]);
  const navigate = useNavigate();
  const { demanderConfirmation, dialogue } = useDialogues();
  const rechargerFile = useRef<(() => Promise<void>) | null>(null);

  // Le tiroir d'une fiche a sa propre URL : un clic sur une personne y mène,
  // et le bouton Retour ramène ici. C'est là qu'une anomalie se comprend.
  const ouvrirFiche = useCallback((id: string) => navigate(`/centre/licencies/${id}`), [navigate]);

  // UN seul chemin de placement, pour le bouton comme pour le glisser-déposer.
  // Rend le message d'erreur (déjà écrit pour l'utilisateur par la base), ou null.
  const placer = useCallback(async (fileId: string, rotationId: string): Promise<string | null> => {
    const { error } = await supabase.rpc('placer_depuis_file', { p_file_id: fileId, p_rotation_id: rotationId });
    if (error) {
      console.error('Placement depuis la file échoué :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      return messageErreur(error);
    }
    await Promise.all([charger(), rechargerFile.current?.()]);
    return null;
  // charger est défini plus bas ; la référence est stable (useCallback).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centreId]);

  const charger = useCallback(async () => {
    setErreur(null);
    const [{ data: rot, error: e1 }, { data: av }, { data: ctr }, { data: opt }, { data: lg }] = await Promise.all([
      supabase.from('rotations').select('*')
        .eq('centre_id', centreId).eq('date_jour', jour).order('numero'),
      supabase.from('aeronefs').select('id, immatriculation, places, altitude_max_m')
        .eq('centre_id', centreId).eq('actif', true).order('immatriculation'),
      supabase.from('centres').select('avionnage_actif').eq('id', centreId).maybeSingle(),
      supabase.from('centres_options').select('embarquement_qr').eq('centre_id', centreId).maybeSingle(),
      supabase.rpc('largueurs_disponibles', { p_centre_id: centreId }),
    ]);
    if (e1) {
      console.error('Avionnage — chargement échoué :', {
        code: e1.code, message: e1.message, details: e1.details, hint: e1.hint,
      });
      setErreur(e1.message); setChargement(false); return;
    }
    const rr = (rot ?? []) as RotationVue[];
    setRotations(rr);
    setAeronefs((av ?? []) as Aeronef[]);
    setOuvert(Boolean((ctr as { avionnage_actif?: boolean } | null)?.avionnage_actif));
    // Aucune ligne d'options = pas souscrit. On ne présume jamais l'activation.
    setScanOuvert(Boolean((opt as { embarquement_qr?: boolean } | null)?.embarquement_qr));
    setLargueurs((lg ?? []) as { parachutiste_id: string; nom: string; prenom: string }[]);

    if (rr.length === 0) { setPlaces([]); setChargement(false); return; }
    const { data: pl, error: e2 } = await supabase.from('places_rotation')
      .select('id, rotation_id, parachutiste_id, moniteur_id, type_saut, rang_sortie, statut, profiles!parachutiste_id(nom, prenom)')
      .in('rotation_id', rr.map(r => r.id)).order('rang_sortie', { nullsFirst: false });
    if (e2) {
      console.error('Places — chargement échoué :', {
        code: e2.code, message: e2.message, details: e2.details, hint: e2.hint,
      });
    }
    type Pr = { nom: string; prenom: string };
    const brutes = (pl ?? []) as unknown as (Omit<PlaceVue, 'nom' | 'aptitude'> & { profiles: Pr | Pr[] | null })[];

    // Le verdict vient de FEU VERT, pour tout le monde — présent déclaré ou
    // non. L'ancien get_aptitude_du_jour ne rendait que les présents : les
    // autres n'avaient aucun badge, ce qui se lisait « tout va bien ».
    const ids = brutes.map(p => p.parachutiste_id).filter(Boolean) as string[];
    const verdicts = new Map<string, PlaceVue['aptitude']>();
    if (ids.length > 0) {
      const { data: vd, error: e3 } = await supabase.rpc('verdicts_du_jour', {
        p_centre_id: centreId, p_ids: ids, p_date: jour,
      });
      if (e3) {
        // Une lecture en échec ne rend pas tout vert : elle laisse tout gris.
        console.error('Verdicts Feu Vert — lecture échouée :', {
          code: e3.code, message: e3.message, details: e3.details, hint: e3.hint,
        });
      }
      for (const v of (vd ?? []) as { parachutiste_id: string; verdict: PlaceVue['aptitude'] }[]) {
        verdicts.set(v.parachutiste_id, v.verdict);
      }
    }
    setVerdictsParPersonne(verdicts);

    // Le sigle « largueur » ne vient plus d'une qualification mais d'une
    // DÉSIGNATION portée par la rotation (rotations.largueur_id).

    setPlaces(brutes.map(p => {
      const pr = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return {
        id: p.id, rotation_id: p.rotation_id, parachutiste_id: p.parachutiste_id,
        moniteur_id: p.moniteur_id, type_saut: p.type_saut, rang_sortie: p.rang_sortie,
        statut: p.statut,
        nom: pr ? `${pr.prenom} ${pr.nom}` : (p.type_saut === 'tandem' ? 'Passager tandem' : '?'),
        // Inconnu → GRIS. Jamais l'absence de réponse traduite en vert.
        aptitude: (p.parachutiste_id && verdicts.get(p.parachutiste_id)) || 'gris',
      };
    }));
    setChargement(false);
  }, [centreId, jour]);

  useEffect(() => { charger(); }, [charger]);

  // Temps réel sur les places : un placement depuis un autre poste doit
  // apparaître ici sans recharger — deux chefs d'avionnage, un seul manifest.
  useEffect(() => {
    const canal = supabase.channel(`avionnage-${centreId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'places_rotation' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rotations', filter: `centre_id=eq.${centreId}` }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [centreId, charger]);

  /**
   * Clôturer la JOURNÉE. Le geste qui manquait : on clôturait avion par avion
   * et il restait, le soir, des planches jamais décollées et une file de gens
   * rentrés chez eux. Le lendemain, l'écran mentait.
   *
   * La confirmation dit ce qui va être écrit AVANT de l'écrire — clôturer
   * crée des sauts, ce n'est pas un geste anodin.
   */
  const cloturerJournee = async () => {
    const aLarguer = rotations.filter(r => r.heure_largage && !r.cloturee_le && r.statut !== 'annulee').length;
    const sansVol = rotations.filter(r => !r.heure_largage && r.statut !== 'annulee' && r.statut !== 'terminee').length;
    const ok = await demanderConfirmation('Clôturer la journée d’avionnage ?',
      `${aLarguer} avion(s) ayant largué seront clôturés et leurs sauts créés. `
      + `${sansVol} avion(s) n'ayant pas volé seront ANNULÉS, sans créer de saut. `
      + `Les personnes restées en file seront retirées, et les inscriptions fermées. `
      + `Les sauts déjà créés ne sont pas touchés.`);
    if (!ok) return;
    setOccupe(true);
    const { data, error } = await supabase.rpc('cloturer_journee_avionnage', { p_centre_id: centreId });
    setOccupe(false);
    if (error) {
      console.error('Clôture de la journée — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(messageErreur(error)); return;
    }
    const r = data as { planches_cloturees: number; planches_annulees: number; sauts_crees: number; file_retiree: number };
    setErreur(null);
    await Promise.all([charger(), rechargerFile.current?.()]);
    alert(`Journée clôturée — ${r.planches_cloturees} avion(s) clôturé(s), ${r.sauts_crees} saut(s) créé(s), `
        + `${r.planches_annulees} annulé(s), ${r.file_retiree} personne(s) retirée(s) de la file.`);
  };

  /** Désigner — ou retirer — le largueur d'un avion. Un seul par rotation. */
  const designerLargueur = async (rotationId: string, largueurId: string | null) => {
    const { error } = await supabase.from('rotations')
      .update({ largueur_id: largueurId }).eq('id', rotationId);
    if (error) {
      console.error('Désignation du largueur échouée :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(messageErreur(error)); return;
    }
    setErreur(null);
    await charger();
  };

  const basculerOuverture = async (v: boolean) => {
    const precedent = ouvert;
    setOuvert(v);
    const { error } = await supabase.from('centres').update({ avionnage_actif: v }).eq('id', centreId);
    if (error) { setOuvert(precedent); setErreur(messageErreur(error)); }
  };

  const nouvellePlanche = async () => {
    setOccupe(true); setErreur(null);
    const dernier = rotations[rotations.length - 1];
    // Heure prévue par défaut : la précédente + 30 min, ou dans 30 min. Une
    // planche naît avec un call — sans heure, pas de décompte, pas de manifest.
    const base = dernier?.heure_prevue
      ? new Date(`${jour}T${dernier.heure_prevue}`) : new Date();
    const prevue = new Date(base.getTime() + 30 * 60000);
    const hh = String(prevue.getHours()).padStart(2, '0');
    const mm = String(prevue.getMinutes()).padStart(2, '0');
    const { error } = await supabase.from('rotations').insert({
      centre_id: centreId, date_jour: jour,
      numero: (dernier?.numero ?? 0) + 1,
      aeronef_id: aeronefs[0]?.id ?? null,
      altitude_largage_m: aeronefs[0]?.altitude_max_m ?? 4000,
      heure_prevue: `${hh}:${mm}:00`,
    });
    setOccupe(false);
    if (error) {
      console.error('Nouvelle planche — échec :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(messageErreur(error)); return;
    }
    charger();
  };

  const inscrire = async (rotationId: string, parachutisteId: string, type: string) => {
    const { error } = await supabase.from('places_rotation')
      .insert({ rotation_id: rotationId, parachutiste_id: parachutisteId, type_saut: type });
    if (error) { setErreur(messageErreur(error)); return; }
    charger();
  };

  if (chargement) return <LoaderParaPass taille={72} message={null} />;

  const ouvertes = rotations.filter(r => r.statut !== 'terminee' && r.statut !== 'annulee' && !r.cloturee_le);
  const enVol = rotations.filter(r => r.heure_decollage && !r.cloturee_le).length;

  return (
    <div className="space-y-4">
      {dialogue}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 style={{ ...enTeteSection, marginBottom: 4, paddingBottom: 0, borderBottom: 'none' }}>
            <Plane className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden /> Avionnage
          </h2>
          <EnTetePlanches nb={rotations.length} enVol={enVol} />
        </div>
        {scanOuvert && (
          <button type="button" onClick={() => navigate('/centre/embarquement')}
            style={{ ...action('secondaire'), marginRight: 8 }}>
            <ScanLine className="w-4 h-4" aria-hidden /> Embarquement
          </button>
        )}
        {rotations.length > 0 && (
          <button type="button" onClick={cloturerJournee} disabled={occupe}
            style={{ ...action('secondaire'), marginRight: 8 }}>
            <MoonStar className="w-4 h-4" aria-hidden /> Clôturer la journée
          </button>
        )}
        <button type="button" onClick={nouvellePlanche} disabled={occupe || aeronefs.length === 0}
          className="disabled:opacity-50" style={action('principal')}>
          <Plus className="w-4 h-4" aria-hidden /> Nouvelle planche
        </button>
      </div>

      {erreur && (
        <p role="alert" className="px-3 py-2 rounded-xl" style={{
          fontSize: 13, borderLeft: '5px solid var(--sev-critique)', color: 'var(--c-text2)',
          background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>{erreur}</p>
      )}

      {/* Sans avion, pas de planche : la saisie est ici, là où le manque se voit. */}
      <AjouterAeronef centreId={centreId} aeronefs={aeronefs} onFait={charger} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        {/* ── Les planches ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {rotations.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--c-muted)' }}>
              {aeronefs.length === 0
                ? 'Enregistrez un aéronef pour créer la première planche.'
                : 'Aucune planche. Créez la première : elle naît avec son call.'}
            </p>
          ) : rotations.map(r => {
            const pl = places.filter(p => p.rotation_id === r.id)
              .sort((a, b) => (a.rang_sortie ?? 99) - (b.rang_sortie ?? 99));
            return (
              <div key={r.id} className="space-y-2">
                <PlancheAvionnage rotation={r} places={pl} maintenant={maintenant}
                  aeronef={aeronefs.find(a => a.id === r.aeronef_id)} onChange={charger}
                  onDeposer={fileId => placer(fileId, r.id)} onOuvrirFiche={ouvrirFiche}
                  largueurs={largueurs}
                  onDesignerLargueur={id => designerLargueur(r.id, id)} />
              </div>
            );
          })}
        </div>

        {/* ── La file ──────────────────────────────────────────────────── */}
        <div>
          <FileAvionnageDZ centreId={centreId} ouvert={ouvert}
            onOuvrir={basculerOuverture} onPlacer={placer} onOuvrirFiche={ouvrirFiche}
            rechargerRef={rechargerFile}
            rotations={ouvertes.map(r => {
              const a = aeronefs.find(x => x.id === r.aeronef_id);
              const occ = siegesOccupes(places.filter(p => p.rotation_id === r.id));
              return { id: r.id, numero: r.numero, places_libres: a ? a.places - occ : null };
            })} />

          {/* Quelqu'un est là, devant le DT, ni en file ni déclaré présent :
              il vient d'arriver. Le DT tape son nom et l'embarque — sans lui
              expliquer le téléphone. Un seul chercheur pour toutes les
              planches, à la place d'un sélecteur par planche. */}
          <div className="mt-4">
            <RechercheLicencie centreId={centreId}
              aptitudes={verdictsParPersonne}
              dejaABord={new Set(places.map(p => p.parachutiste_id).filter(Boolean) as string[])}
              onInscrire={inscrire} onOuvrirFiche={ouvrirFiche}
              rotations={ouvertes.map(r => {
                const a = aeronefs.find(x => x.id === r.aeronef_id);
                const occ = siegesOccupes(places.filter(p => p.rotation_id === r.id));
                return { id: r.id, numero: r.numero, places_libres: a ? a.places - occ : null };
              })} />
          </div>
        </div>
      </div>

      {/* Zone de test, EN BAS et à part : ce qui n'est pas de la production ne
          se mélange pas aux planches du jour. */}
      <DemoAvionnage centreId={centreId} onFait={charger} />
    </div>
  );
}

export function Avionnage({ centreId }: { centreId: string }) {
  return <ErrorBoundary><AvionnageInner centreId={centreId} /></ErrorBoundary>;
}
