import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ymdLocal } from '../../lib/datetime';
import { Plus, Plane, ScanLine, MoonStar, Sunset, Settings2 } from 'lucide-react';
import { useDialogues } from '../../components/useDialogues';
import { action, enTeteSection, SEVERITE_COULEUR } from '../../lib/jetons';
import { brevetPrincipal } from '../../lib/brevets';
import { siegesOccupes, messageErreur, type Discipline, type VerdictDT48 } from '../../lib/avionnage';
import { FileAvionnageDZ } from './FileAvionnageDZ';
import { AjouterAeronef, type Aeronef } from './Rotations';
import { RechercheLicencie } from './RechercheLicencie';
import { ZoneDemoModule } from '../../components/ZoneDemoModule';
import { ReglagesAvionnage } from './ReglagesAvionnage';
import { coucherSoleil, libelleCoucher } from '../../lib/soleil';
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
  /** Le référentiel des disciplines du centre. Lu, jamais écrit en dur. */
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  /** Coordonnées du centre — sans elles, pas d'heure de coucher, et on le tait. */
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [dt48, setDt48] = useState<Map<string, VerdictDT48>>(new Map());
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
      supabase.from('aeronefs').select('id, immatriculation, places, altitude_max_m, masse_max_kg')
        .eq('centre_id', centreId).eq('actif', true).order('immatriculation'),
      supabase.from('centres').select('avionnage_actif, latitude, longitude').eq('id', centreId).maybeSingle(),
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
    const c = ctr as { latitude?: number | null; longitude?: number | null } | null;
    setCoords(c?.latitude != null && c?.longitude != null
      ? { lat: Number(c.latitude), lon: Number(c.longitude) } : null);
    // Aucune ligne d'options = pas souscrit. On ne présume jamais l'activation.
    setScanOuvert(Boolean((opt as { embarquement_qr?: boolean } | null)?.embarquement_qr));
    setLargueurs((lg ?? []) as { parachutiste_id: string; nom: string; prenom: string }[]);

    // Le référentiel des disciplines, filtré par ce que CE centre propose.
    // Absence de ligne d'activation = le défaut du catalogue.
    const [{ data: dRef }, { data: dCentre }] = await Promise.all([
      supabase.from('disciplines_saut')
        .select('code, libelle, ordre, equipage, radio_attendue, teinte')
        .eq('actif', true).order('ordre'),
      supabase.from('centres_disciplines').select('code, actif').eq('centre_id', centreId),
    ]);
    const retirees = new Set((dCentre ?? []).filter(x => !x.actif).map(x => x.code));
    setDisciplines(((dRef ?? []) as Discipline[]).filter(d => !retirees.has(d.code)));

    if (rr.length === 0) { setPlaces([]); setChargement(false); return; }
    const { data: pl, error: e2 } = await supabase.from('places_rotation')
      .select('id, rotation_id, parachutiste_id, moniteur_id, type_saut, rang_sortie, statut, groupe_id, masse_kg, altitude_largage_m, radio, passager_nom, video_option, profiles!parachutiste_id(nom, prenom, masse_kg, type_brevet_principal, type_brevet_moniteur)')
      .in('rotation_id', rr.map(r => r.id)).order('rang_sortie', { nullsFirst: false });
    if (e2) {
      console.error('Places — chargement échoué :', {
        code: e2.code, message: e2.message, details: e2.details, hint: e2.hint,
      });
    }
    type Pr = { nom: string; prenom: string; masse_kg: number | null; type_brevet_principal: string | null; type_brevet_moniteur: string | null };
    const brutes = (pl ?? []) as unknown as (Omit<PlaceVue, 'nom' | 'aptitude'> & { profiles: Pr | Pr[] | null })[];

    // Le verdict vient de FEU VERT, pour tout le monde — présent déclaré ou
    // non. L'ancien get_aptitude_du_jour ne rendait que les présents : les
    // autres n'avaient aucun badge, ce qui se lisait « tout va bien ».
    const ids = brutes.map(p => p.parachutiste_id).filter(Boolean) as string[];
    const verdicts = new Map<string, PlaceVue['aptitude']>();
    const motifs = new Map<string, string | null>();
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
      for (const v of (vd ?? []) as { parachutiste_id: string; verdict: PlaceVue['aptitude']; motifs: string | null }[]) {
        verdicts.set(v.parachutiste_id, v.verdict);
        motifs.set(v.parachutiste_id, v.motifs ?? null);
      }
    }
    setVerdictsParPersonne(verdicts);

    // Le nom du moniteur qui accompagne. Une lecture separee : la jointure
    // imbriquee sur la meme table que le parachutiste rendait des colonnes
    // ambigues, et un nom qui manque vaut mieux qu'une ligne qui ne charge pas.
    // L'ÉQUIPEMENT DÉCLARÉ. Deux sources, dans cet ordre : ce que le sauteur
    // a saisi en se déclarant présent aujourd'hui (perso / location DZ), puis
    // son matériel enregistré. Rien n'est deviné : sans déclaration, on écrit
    // « non déclaré » plutôt que d'inventer une voile.
    const equipements = new Map<string, string>();
    if (ids.length > 0) {
      const [{ data: pres }, { data: mats }] = await Promise.all([
        supabase.from('dz_presences')
          .select('user_id, materiel_type, voile_perso_ref, voile_perso_libre, voile_location_ref')
          .eq('dz_id', centreId).eq('date_presence', jour).in('user_id', ids),
        supabase.from('materiels')
          .select('parachutiste_id, marque, modele, taille_voile_ft2')
          .eq('type', 'parachute_principal').eq('statut', 'actif').in('parachutiste_id', ids),
      ]);
      const parMateriel = new Map<string, string>();
      for (const m of (mats ?? []) as { parachutiste_id: string; marque: string | null; modele: string | null; taille_voile_ft2: number | null }[]) {
        const libelle = [m.marque, m.modele, m.taille_voile_ft2 ? `${m.taille_voile_ft2} ft²` : null]
          .filter(Boolean).join(' ');
        if (libelle && !parMateriel.has(m.parachutiste_id)) parMateriel.set(m.parachutiste_id, libelle);
      }
      for (const pr of (pres ?? []) as { user_id: string; materiel_type: string; voile_perso_libre: string | null; voile_location_ref: string | null }[]) {
        const detail = pr.materiel_type === 'location'
          ? (pr.voile_location_ref ?? 'voile du centre')
          : (pr.voile_perso_libre ?? parMateriel.get(pr.user_id) ?? 'voile perso');
        equipements.set(pr.user_id, `${pr.materiel_type === 'location' ? 'location DZ' : 'perso'} · ${detail}`);
      }
      // Pas de déclaration du jour : on retombe sur le matériel enregistré.
      for (const [id, libelle] of parMateriel) {
        if (!equipements.has(id)) equipements.set(id, `perso · ${libelle}`);
      }
    }

    // LA DT 48 : surface minimale par poids nu et tranche de sauts. Lecture
    // serveur — ni les sauts ni le poids ne sont lisibles par le client.
    const d48 = new Map<string, VerdictDT48>();
    if (ids.length > 0) {
      const { data: dv, error: eD } = await supabase.rpc('dt48_verdicts', {
        p_centre_id: centreId, p_ids: ids,
      });
      if (eD) {
        console.error('DT 48 — lecture échouée :', {
          code: eD.code, message: eD.message, details: eD.details, hint: eD.hint,
        });
      }
      for (const v of (dv ?? []) as Record<string, unknown>[]) {
        d48.set(v.parachutiste_id as string, {
          nbSauts: Number(v.nb_sauts ?? 0),
          poidsNuKg: v.poids_nu_kg === null ? null : Number(v.poids_nu_kg),
          poidsDeduit: Boolean(v.poids_deduit),
          surfaceDeclareeFt2: v.surface_declaree_ft2 === null ? null : Number(v.surface_declaree_ft2),
          surfaceMinFt2: v.surface_min_ft2 === null ? null : Number(v.surface_min_ft2),
          surfaceRetenueFt2: v.surface_retenue_ft2 === null ? null : Number(v.surface_retenue_ft2),
          amenagement: Boolean(v.amenagement),
          libelleTranche: (v.libelle_tranche as string | null) ?? null,
          poidsEcrete: Boolean(v.poids_ecrete),
          horsTableauSauts: Boolean(v.hors_tableau_sauts),
          etat: v.etat as VerdictDT48['etat'],
          detail: (v.detail as string) ?? '',
        });
      }
    }
    setDt48(d48);

    // LE BREVET VIENT DE LA TABLE `brevets`, comme sur la carte de licence.
    // La planche lisait profiles.type_brevet_principal, un champ texte sans
    // date ni numero : les deux ecrans se contredisaient. Mesure sur BigAir —
    // Antoine BERGER, 7 sauts, « pas de brevet » ici et « brevet C » sur sa
    // licence. Une seule source, celle qui porte une preuve.
    const brevets = new Map<string, string>();
    if (ids.length > 0) {
      const { data: bv, error: eB } = await supabase.from('brevets')
        .select('parachutiste_id, type_brevet, date_obtention').in('parachutiste_id', ids);
      if (eB) {
        console.error('Brevets — lecture échouée :', {
          code: eB.code, message: eB.message, details: eB.details, hint: eB.hint,
        });
      }
      const parPersonne = new Map<string, { type_brevet: string }[]>();
      for (const b of (bv ?? []) as { parachutiste_id: string; type_brevet: string }[]) {
        parPersonne.set(b.parachutiste_id, [...(parPersonne.get(b.parachutiste_id) ?? []), b]);
      }
      for (const [id, liste] of parPersonne) {
        const principal = brevetPrincipal(liste);
        if (principal) brevets.set(id, principal.type_brevet);
      }
    }

    const nomsMoniteurs = new Map<string, string>();
    const idsMoniteurs = [...new Set(brutes.map(p => p.moniteur_id).filter(Boolean))] as string[];
    if (idsMoniteurs.length > 0) {
      const { data: mo } = await supabase.from('profiles')
        .select('id, nom, prenom').in('id', idsMoniteurs);
      for (const m of (mo ?? []) as { id: string; nom: string; prenom: string }[]) {
        nomsMoniteurs.set(m.id, `${m.prenom} ${m.nom}`);
      }
    }

    // Les qualifications VALIDES, telles qu'elles sont en base. Une
    // qualification périmée n'est pas une qualification : elle ne s'affiche
    // pas — un sigle est une autorisation, pas un souvenir.
    const qualifs = new Map<string, string[]>();
    if (ids.length > 0) {
      const { data: qs, error: eQ } = await supabase.from('qualifications')
        .select('parachutiste_id, type, date_expiration').in('parachutiste_id', ids);
      if (eQ) {
        console.error('Qualifications — lecture échouée :', {
          code: eQ.code, message: eQ.message, details: eQ.details, hint: eQ.hint,
        });
      }
      const aujourdhui = new Date().toISOString().slice(0, 10);
      for (const q of (qs ?? []) as { parachutiste_id: string; type: string; date_expiration: string | null }[]) {
        if (q.date_expiration && q.date_expiration < aujourdhui) continue;
        qualifs.set(q.parachutiste_id, [...(qualifs.get(q.parachutiste_id) ?? []), q.type]);
      }
    }

    // Le sigle « largueur » ne vient plus d'une qualification mais d'une
    // DÉSIGNATION portée par la rotation (rotations.largueur_id).

    setPlaces(brutes.map(p => {
      const pr = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const passager = (p as { passager_nom?: string | null }).passager_nom ?? null;
      return {
        id: p.id, rotation_id: p.rotation_id, parachutiste_id: p.parachutiste_id,
        moniteur_id: p.moniteur_id, type_saut: p.type_saut, rang_sortie: p.rang_sortie,
        statut: p.statut, groupe_id: p.groupe_id,
        // La masse de la PLACE prime sur celle du profil : un tandem n'a pas
        // de profil, et une place peut porter une masse ponctuelle.
        masse_kg: (p as { masse_kg?: number | null }).masse_kg ?? pr?.masse_kg ?? null,
        altitude_largage_m: (p as { altitude_largage_m?: number | null }).altitude_largage_m ?? null,
        radio: Boolean((p as { radio?: boolean }).radio),
        brevet: brevets.get(p.parachutiste_id ?? '') ?? null,
        brevet_moniteur: pr?.type_brevet_moniteur ?? null,
        motifs: motifs.get(p.parachutiste_id ?? '') ?? null,
        moniteur_nom: nomsMoniteurs.get(p.moniteur_id ?? '') ?? null,
        equipement: equipements.get(p.parachutiste_id ?? '') ?? null,
        passager_nom: (p as { passager_nom?: string | null }).passager_nom ?? null,
        video_option: Boolean((p as { video_option?: boolean }).video_option),
        // Ce qui n'est pas saisi ne s'affiche pas : aucune qualification n'est
        // déduite d'un nombre de sauts ni d'un brevet.
        qualifications: qualifs.get(p.parachutiste_id ?? '') ?? [],
        nom: pr ? `${pr.prenom} ${pr.nom}` : (passager ?? 'occupant non nommé'),
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
  /**
   * Désigner le largueur, c'est L'EMBARQUER.
   *
   * Il était choisi dans un menu à part : le seul homme de l'avion dont on ne
   * voyait ni la masse ni le feu. Or il pèse — l'avion se charge par les kilos
   * — et il doit être en règle. On lui crée donc une place, de type
   * « largueur » : il occupe un siège, il ne saute pas.
   */
  const designerLargueur = async (rotationId: string, largueurId: string | null) => {
    if (largueurId) {
      const dejaLa = places.some(p => p.rotation_id === rotationId && p.parachutiste_id === largueurId);
      if (!dejaLa) {
        const { error: eP } = await supabase.from('places_rotation')
          .insert({ rotation_id: rotationId, parachutiste_id: largueurId, type_saut: 'largueur' });
        if (eP) {
          console.error('Embarquement du largueur échoué :', {
            code: eP.code, message: eP.message, details: eP.details, hint: eP.hint,
          });
          setErreur(messageErreur(eP)); return;
        }
      }
    }
    // LE CHEF AVION SUIT LE LARGUEUR. Deux designations differentes sur un
    // meme avion se contredisent : sur le terrain, c'est la meme personne.
    // La colonne reste — l'histoire d'un avion parti ne se reecrit pas — mais
    // elle n'est plus choisie a part.
    const { error } = await supabase.from('rotations')
      .update({ largueur_id: largueurId, chef_avion_id: largueurId }).eq('id', rotationId);
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

  /**
   * Former un groupe. On génère l'identifiant CÔTÉ CLIENT (crypto.randomUUID)
   * plutôt que de créer une table de groupes : un groupe n'a pas d'attribut
   * propre — son nom se déduit, sa composition est dans les places. Une table
   * n'aurait rien porté de plus, et aurait pu se désynchroniser.
   */
  const grouper = async (placeIds: string[]): Promise<string | null> => {
    const groupeId = crypto.randomUUID();
    const { error } = await supabase.from('places_rotation')
      .update({ groupe_id: groupeId }).in('id', placeIds);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /** Défaire un groupe ne retire personne de l'avion : on coupe le lien. */
  const degrouper = async (groupeId: string): Promise<string | null> => {
    const { error } = await supabase.from('places_rotation')
      .update({ groupe_id: null }).eq('groupe_id', groupeId);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /**
   * Le DT demande la masse à voix haute et la saisit.
   *
   * Elle part sur le PROFIL quand il y en a un : c'est la masse de la
   * personne, pas celle du jour, et la retenir évite de redemander demain.
   * Sans profil (tandem), elle reste sur la place — elle n'appartient à
   * personne d'autre que ce saut-là.
   */
  const definirMasse = async (place: PlaceVue, kg: number | null): Promise<string | null> => {
    const { error } = place.parachutiste_id
      ? await supabase.from('profiles').update({ masse_kg: kg }).eq('id', place.parachutiste_id)
      : await supabase.from('places_rotation').update({ masse_kg: kg }).eq('id', place.id);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /**
   * Le passager d'un tandem. C'est un CIVIL : pas de compte, pas de licence,
   * pas de verdict. On lui donne une place nommee, rattachee a son moniteur
   * par le groupe — ils sortent attaches, c'est litteralement le cas.
   *
   * Lui fabriquer un profil aurait cree un compte a quelqu'un qui n'en a pas
   * demande, et un feu de conformite qui n'a aucun sens pour lui.
   */
  const ajouterPassager = async (placeMoniteur: PlaceVue, nom: string, kg: number | null): Promise<string | null> => {
    // Le moniteur et son passager partagent un groupe : s'il n'en a pas, on
    // en cree un pour les lier.
    let groupe = placeMoniteur.groupe_id;
    if (!groupe) {
      groupe = crypto.randomUUID();
      const { error: eG } = await supabase.from('places_rotation')
        .update({ groupe_id: groupe }).eq('id', placeMoniteur.id);
      if (eG) return messageErreur(eG);
    }
    const { error } = await supabase.from('places_rotation').insert({
      rotation_id: placeMoniteur.rotation_id,
      passager_nom: nom,
      type_saut: 'tandem',
      groupe_id: groupe,
      rang_sortie: placeMoniteur.rang_sortie,
      masse_kg: kg,
    });
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /**
   * Ce que fait la personne se change jusqu'a la derniere minute : un sauteur
   * decide au pied de l'avion qu'il part en VR, un videaste renonce a filmer.
   * La planche doit suivre, sinon elle ment dans les cinq minutes.
   */
  const changerDiscipline = async (placeId: string, code: string): Promise<string | null> => {
    const { error } = await supabase.from('places_rotation')
      .update({ type_saut: code }).eq('id', placeId);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /**
   * Valider l'embarquement FIGE la planche : ce qu'on a annonce a l'equipage
   * ne se reecrit pas. On peut rouvrir tant que l'avion n'a pas decolle — un
   * sauteur se decommande, ca arrive. Apres le decollage, la base refuse.
   */
  const validerEmbarquement = async (rotationId: string, valide: boolean): Promise<string | null> => {
    const { error } = await supabase.from('rotations')
      .update({ embarquement_valide_le: valide ? new Date().toISOString() : null })
      .eq('id', rotationId);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /**
   * L'AMENAGEMENT DT 48 de -11 %. Le texte : « une seule autorisation
   * d'amenagement, par palier, sur autorisation d'un DT ou d'un initiateur
   * BI5 ou B5 ». La base enregistre QUI l'accorde et QUAND — une derogation
   * sans auteur n'est pas une derogation — et ne cumule jamais deux
   * autorisations sur le meme palier.
   */
  const amenagementDT48 = async (parachutisteId: string, accorde: boolean): Promise<string | null> => {
    const { error } = await supabase.rpc('dt48_accorder_amenagement', {
      p_parachutiste_id: parachutisteId, p_centre_id: centreId, p_accorde: accorde,
    });
    if (error) {
      console.error('Amenagement DT 48 echoue :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      return messageErreur(error);
    }
    await charger();
    return null;
  };

  /** L'option video se vend au comptoir : l'ecran ne fait que la constater. */
  const basculerVideo = async (placeId: string, vendue: boolean): Promise<string | null> => {
    const { error } = await supabase.from('places_rotation')
      .update({ video_option: vendue }).eq('id', placeId);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /** La radio se constate d'un clic : elle est sur la personne, ou elle ne l'est pas. */
  const basculerRadio = async (placeId: string, radio: boolean): Promise<string | null> => {
    const { error } = await supabase.from('places_rotation')
      .update({ radio }).eq('id', placeId);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /** Carburant embarqué. Donnée de l'avion, saisie dans l'entête de planche. */
  const definirCarburant = async (rotationId: string, litres: number | null): Promise<string | null> => {
    const { error } = await supabase.from('rotations')
      .update({ carburant_litres: litres }).eq('id', rotationId);
    if (error) return messageErreur(error);
    await charger();
    return null;
  };

  /** Altitude propre à un sauteur. Vide = il reprend celle de l'avion. */
  const definirAltitude = async (placeId: string, metres: number | null): Promise<string | null> => {
    const { error } = await supabase.from('places_rotation')
      .update({ altitude_largage_m: metres }).eq('id', placeId);
    if (error) return messageErreur(error);
    await charger();
    return null;
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
        {/* LE COUCHER DU SOLEIL — la borne de la journee. Sur un manifest
            professionnel elle est toujours a l'ecran : en septembre elle bouge
            de deux minutes par jour, personne ne la devine. Aucune regle
            derriere : ParaPass ne connait pas de texte fixant une marge, et
            n'en invente pas. On affiche l'heure, le DT decide. */}
        {(() => {
          const l = coords ? libelleCoucher(coucherSoleil(maintenant, coords.lat, coords.lon), maintenant) : null;
          if (!l) return null;
          return (
            <span className="flex items-center gap-1.5 flex-shrink-0"
              title="Dernier décollage avant le coucher du soleil"
              style={{ fontSize: 13, marginRight: 8,
                       color: l.urgent ? SEVERITE_COULEUR.vigilance : 'var(--c-muted)',
                       fontWeight: l.urgent ? 700 : 400 }}>
              <Sunset className="w-4 h-4" aria-hidden />
              Coucher {l.heure} · {l.reste}
            </span>
          );
        })()}

        <button type="button" onClick={() => setReglagesOuverts(true)}
          title="Réglages de l’avionnage — disciplines, charge alaire"
          style={{ ...action('texte'), marginRight: 8 }}>
          <Settings2 className="w-4 h-4" aria-hidden />
          <span className="sr-only">Réglages de l’avionnage</span>
        </button>

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
                  onGrouper={grouper} onDegrouper={degrouper} onDefinirMasse={definirMasse}
                  onDefinirAltitude={definirAltitude}
                  onDefinirCarburant={l => definirCarburant(r.id, l)}
                  onBasculerRadio={basculerRadio} onAjouterPassager={ajouterPassager} onBasculerVideo={basculerVideo}
                  onChangerDiscipline={changerDiscipline} disciplines={disciplines} dt48={dt48}
                  onValiderEmbarquement={v => validerEmbarquement(r.id, v)}
                  onAmenagementDT48={amenagementDT48}
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
      <ZoneDemoModule module="avionnage" centreId={centreId} onFait={charger} />

      {reglagesOuverts && (
        <ReglagesAvionnage centreId={centreId}
          onFermer={() => setReglagesOuverts(false)} onChange={charger} />
      )}
    </div>
  );
}

export function Avionnage({ centreId }: { centreId: string }) {
  return <ErrorBoundary><AvionnageInner centreId={centreId} /></ErrorBoundary>;
}
