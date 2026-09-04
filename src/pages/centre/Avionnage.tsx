import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoaderParaPass } from '../../components/LoaderParaPass';
import { ymdLocal } from '../../lib/datetime';
import { Plus, Plane } from 'lucide-react';
import { action, enTeteSection } from '../../lib/jetons';
import { siegesOccupes, messageErreur } from '../../lib/avionnage';
import { FileAvionnageDZ } from './FileAvionnageDZ';
import { Inscrire, AjouterAeronef, type Aeronef } from './Rotations';
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
// get_aptitude_du_jour. Rien n'est recalculé deux fois.
// ═══════════════════════════════════════════════════════════════════════════

function AvionnageInner({ centreId }: { centreId: string }) {
  const jour = ymdLocal(new Date());
  const maintenant = useHorlogeMinute();
  const [rotations, setRotations] = useState<RotationVue[]>([]);
  const [places, setPlaces] = useState<PlaceVue[]>([]);
  const [aeronefs, setAeronefs] = useState<Aeronef[]>([]);
  const [presents, setPresents] = useState<{ id: string; nom: string; aptitude: string; motif: string | null }[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    const [{ data: rot, error: e1 }, { data: av }, { data: apt }, { data: ctr }] = await Promise.all([
      supabase.from('rotations').select('*')
        .eq('centre_id', centreId).eq('date_jour', jour).order('numero'),
      supabase.from('aeronefs').select('id, immatriculation, places, altitude_max_m')
        .eq('centre_id', centreId).eq('actif', true).order('immatriculation'),
      supabase.rpc('get_aptitude_du_jour', { p_centre_id: centreId }),
      supabase.from('centres').select('avionnage_actif').eq('id', centreId).maybeSingle(),
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

    type Apt = { parachutiste_id: string; nom: string; prenom: string; statut: string;
                 motifs: { libelle: string; levee: boolean }[] };
    const aptitudes = (apt ?? []) as Apt[];
    setPresents(aptitudes.map(a => ({
      id: a.parachutiste_id, nom: `${a.prenom} ${a.nom}`, aptitude: a.statut,
      motif: a.motifs.find(m => !m.levee)?.libelle ?? null,
    })));

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
    setPlaces(((pl ?? []) as unknown as (Omit<PlaceVue, 'nom' | 'aptitude'> & { profiles: Pr | Pr[] | null })[])
      .map(p => {
        const pr = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const a = aptitudes.find(x => x.parachutiste_id === p.parachutiste_id);
        return {
          id: p.id, rotation_id: p.rotation_id, parachutiste_id: p.parachutiste_id,
          moniteur_id: p.moniteur_id, type_saut: p.type_saut, rang_sortie: p.rang_sortie,
          statut: p.statut,
          nom: pr ? `${pr.prenom} ${pr.nom}` : (p.type_saut === 'tandem' ? 'Passager tandem' : '?'),
          aptitude: (a?.statut as PlaceVue['aptitude']) ?? null,
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 style={{ ...enTeteSection, marginBottom: 4, paddingBottom: 0, borderBottom: 'none' }}>
            <Plane className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden /> Avionnage
          </h2>
          <EnTetePlanches nb={rotations.length} enVol={enVol} />
        </div>
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
            const close = r.statut === 'terminee' || r.cloturee_le !== null;
            return (
              <div key={r.id} className="space-y-2">
                <PlancheAvionnage rotation={r} places={pl} maintenant={maintenant}
                  aeronef={aeronefs.find(a => a.id === r.aeronef_id)} onChange={charger} />
                {/* Quelqu'un arrive sans être passé par la file : le chef
                    d'avionnage l'embarque directement. L'aptitude s'affiche,
                    elle n'empêche rien. */}
                {!close && (
                  <Inscrire rotationId={r.id} presents={presents}
                    dejaInscrits={pl.map(p => p.parachutiste_id).filter(Boolean) as string[]}
                    onInscrire={inscrire} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── La file ──────────────────────────────────────────────────── */}
        <div>
          <FileAvionnageDZ centreId={centreId} ouvert={ouvert}
            onOuvrir={basculerOuverture} onPlace={charger}
            rotations={ouvertes.map(r => {
              const a = aeronefs.find(x => x.id === r.aeronef_id);
              const occ = siegesOccupes(places.filter(p => p.rotation_id === r.id));
              return { id: r.id, numero: r.numero, places_libres: a ? a.places - occ : null };
            })} />
        </div>
      </div>
    </div>
  );
}

export function Avionnage({ centreId }: { centreId: string }) {
  return <ErrorBoundary><AvionnageInner centreId={centreId} /></ErrorBoundary>;
}
