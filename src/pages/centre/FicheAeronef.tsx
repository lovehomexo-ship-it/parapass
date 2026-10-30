import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { capacitePlein, dureeRotation, ecrireDomaine, lireDomaine } from '../../lib/masseCentrage';
import type { Aeronef } from './Rotations';

// ═══════════════════════════════════════════════════════════════════════════
// LA FICHE AÉRONEF — tout ce que la fiche de pesée et le manuel de vol disent
// de l'avion, au même endroit, pour que la planche calcule juste.
//
// Cinq blocs, dans l'ordre où on les lit sur les papiers de l'avion :
// identité, masses, vol, carburant, centrage. Chaque champ est facultatif ; ce
// qui manque, la planche le dit au lieu de l'inventer.
// ═══════════════════════════════════════════════════════════════════════════

type Champ = keyof Aeronef;
const NUM: Champ[] = [
  'places', 'altitude_max_m', 'masse_a_vide_kg', 'masse_max_kg', 'masse_max_atterrissage_kg', 'masse_pilote_kg',
  'densite_carburant', 'vario_montee_min_ftmin', 'vario_montee_max_ftmin', 'taux_descente_max_ftmin',
  'temps_kero_min', 'conso_rotation_l', 'rotations_par_plein', 'reserve_kero_l',
  'corde_mac_m', 'distance_reference_m', 'bras_vide_m', 'bras_pilote_m', 'bras_carburant_m',
];

const versTexte = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
const versNombre = (t: string): number | null => {
  const s = t.trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Les colonnes d'avant la fiche complète (migration 209). */
const ANCIENNES = new Set(['immatriculation', 'type', 'places', 'altitude_max_m', 'masse_a_vide_kg', 'masse_max_kg']);

/** La base porte-t-elle déjà les colonnes de la fiche ? `select('*')` le dit. */
export const ficheComplete = (a: object) => 'parachute_pilote' in a;

export function FicheAeronef({ aeronef, onFermer, onEnregistre }: {
  aeronef: Aeronef; onFermer: () => void; onEnregistre: () => void;
}) {
  const complete = ficheComplete(aeronef);
  const [v, setV] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {
      immatriculation: aeronef.immatriculation, nom: aeronef.nom ?? '', type: aeronef.type ?? '',
      couleur: aeronef.couleur ?? '#2563EB', domaine: ecrireDomaine(aeronef.domaine_centrage),
    };
    NUM.forEach(c => { init[c] = versTexte(aeronef[c]); });
    if (!init.densite_carburant) init.densite_carburant = '0,8';
    return init;
  });
  const [parachute, setParachute] = useState(aeronef.parachute_pilote !== false);
  const [bras, setBras] = useState<string[]>(() => (aeronef.bras_places_m ?? []).map(versTexte));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const places = Math.max(1, Math.min(40, Math.round(versNombre(v.places) || aeronef.places)));
  // Un bras par siège : la liste suit le nombre de places.
  useEffect(() => { setBras(b => Array.from({ length: places }, (_, i) => b[i] ?? '')); }, [places]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onFermer]);

  const maj = (c: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV(s => ({ ...s, [c]: e.target.value }));
  const domaine = useMemo(() => lireDomaine(v.domaine), [v.domaine]);

  // Ce que la fiche permet déjà de calculer : la preuve qu'elle sert.
  const apercu = useMemo(() => {
    const f = {
      places, conso_rotation_l: versNombre(v.conso_rotation_l), rotations_par_plein: versNombre(v.rotations_par_plein),
      reserve_kero_l: versNombre(v.reserve_kero_l), vario_montee_min_ftmin: versNombre(v.vario_montee_min_ftmin),
      vario_montee_max_ftmin: versNombre(v.vario_montee_max_ftmin), taux_descente_max_ftmin: versNombre(v.taux_descente_max_ftmin),
    };
    return { plein: capacitePlein(f), duree: dureeRotation(f, versNombre(v.altitude_max_m) || 4000) };
  }, [v, places]);

  const enregistrer = async () => {
    setErreur(null);
    const patch: Record<string, unknown> = {
      immatriculation: v.immatriculation.trim().toUpperCase(), nom: v.nom.trim() || null,
      type: v.type.trim() || null, parachute_pilote: parachute,
      couleur: /^#[0-9A-Fa-f]{6}$/.test(v.couleur) ? v.couleur.toUpperCase() : null,
    };
    if (!patch.immatriculation) { setErreur('L’immatriculation est obligatoire.'); return; }
    for (const c of NUM) {
      const n = versNombre(v[c]);
      if (Number.isNaN(n)) { setErreur(`Valeur illisible : « ${v[c]} ».`); return; }
      patch[c] = n;
    }
    patch.places = places;
    if (patch.densite_carburant === null) patch.densite_carburant = 0.8;
    const vmin = patch.vario_montee_min_ftmin as number | null, vmax = patch.vario_montee_max_ftmin as number | null;
    if (vmin !== null && vmax !== null && vmin > vmax) { setErreur('Le vario mini dépasse le vario maxi.'); return; }
    if (v.domaine.trim() && !domaine) {
      setErreur('Domaine de centrage illisible : au moins trois sommets [masse, %], ex. [0,11],[1450,11],[2200,25].'); return;
    }
    patch.domaine_centrage = domaine;
    const lesBras = bras.map(versNombre);
    if (lesBras.some(n => Number.isNaN(n))) { setErreur('Un bras de levier est illisible.'); return; }
    patch.bras_places_m = lesBras.every(n => n === null) ? null : lesBras;

    // Base pas encore à jour : on n'écrit que les colonnes qui existent, au
    // lieu d'échouer sur tout le reste.
    if (!complete) Object.keys(patch).forEach(k => { if (!ANCIENNES.has(k)) delete patch[k]; });

    setEnvoi(true);
    // `.select()` : une mise à jour refusée par les droits ne renvoie pas
    // d'erreur, elle ne touche aucune ligne. On le vérifie.
    const { data, error } = await supabase.from('aeronefs').update(patch).eq('id', aeronef.id).select('id');
    setEnvoi(false);
    if (error || !data?.length) {
      setErreur(error ? `Enregistrement refusé : ${error.message}` : 'Enregistrement refusé : droits insuffisants sur cet aéronef.');
      return;
    }
    onEnregistre();
  };

  const nf = new Intl.NumberFormat('fr-FR');
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(11,29,58,0.55)' }} onClick={onFermer}>
      <div role="dialog" aria-modal="true" aria-labelledby="titre-fiche-aeronef"
        className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: 'var(--c-card)', color: 'var(--c-text)' }} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--c-card)', borderBottom: '1px solid var(--c-border)' }}>
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: v.couleur }} aria-hidden />
          <h2 id="titre-fiche-aeronef" className="flex-1 min-w-0 text-[16px] font-bold truncate">
            Fiche aéronef · {v.immatriculation || aeronef.immatriculation}
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer la fiche"
            className="w-11 h-11 flex items-center justify-center rounded-xl" style={{ color: 'var(--c-muted)' }}>
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {!complete && (
          <p role="status" className="mx-4 mt-4 rounded-xl px-3 py-2 text-[13px]"
            style={{ background: 'color-mix(in srgb, var(--sev-vigilance, #B45309) 14%, transparent)', color: 'var(--c-text)' }}>
            Mise à jour de la base en attente : seuls l’identité, les places, le plafond, la masse à vide et la MTOW
            sont enregistrés pour l’instant. Les blocs Vol, Carburant et Centrage le seront dès qu’elle sera faite.
          </p>
        )}
        <div className="p-4 grid gap-4 md:grid-cols-2">
          <Bloc titre="Identité">
            <Ligne lib="Immatriculation *"><Saisie v={v.immatriculation} onChange={maj('immatriculation')} placeholder="F-HPCJ" /></Ligne>
            <Ligne lib="Nom d’usage"><Saisie v={v.nom} onChange={maj('nom')} placeholder="Pilatus Big Air" /></Ligne>
            <Ligne lib="Type, modèle"><Saisie v={v.type} onChange={maj('type')} placeholder="Pilatus PC-6 B2H4" /></Ligne>
            <Ligne lib="Places parachutistes" aide="Largueur et passager tandem compris, pilote non compris.">
              <Saisie v={v.places} onChange={maj('places')} num />
            </Ligne>
            <Ligne lib="Plafond de largage" unite="m"><Saisie v={v.altitude_max_m} onChange={maj('altitude_max_m')} num /></Ligne>
            <Ligne lib="Couleur à l’avionnage">
              <span className="flex items-center gap-2">
                <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(v.couleur) ? v.couleur : '#2563EB'}
                  onChange={maj('couleur')} aria-label="Couleur de l’avion sur les planches"
                  className="w-11 h-11 rounded-lg cursor-pointer" style={{ border: '1px solid var(--c-border)', background: 'none' }} />
                <span className="text-[13px] tabular-nums" style={{ color: 'var(--c-muted)' }}>{v.couleur.toUpperCase()}</span>
              </span>
            </Ligne>
          </Bloc>

          <Bloc titre="Masses" aide="Sur la fiche de pesée de l’avion.">
            <Ligne lib="Masse à vide" unite="kg"><Saisie v={v.masse_a_vide_kg} onChange={maj('masse_a_vide_kg')} num /></Ligne>
            <Ligne lib="Masse maxi au décollage (MTOW)" unite="kg"><Saisie v={v.masse_max_kg} onChange={maj('masse_max_kg')} num /></Ligne>
            <Ligne lib="Masse maxi à l’atterrissage (MLW)" unite="kg"><Saisie v={v.masse_max_atterrissage_kg} onChange={maj('masse_max_atterrissage_kg')} num /></Ligne>
            <Ligne lib="Pilote équipé" unite="kg"><Saisie v={v.masse_pilote_kg} onChange={maj('masse_pilote_kg')} num placeholder="85" /></Ligne>
            <label className="flex items-start gap-3 py-2 cursor-pointer">
              <input type="checkbox" checked={parachute} onChange={e => setParachute(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-[13px]">
                <strong>Parachute pilote</strong>
                <span className="block" style={{ color: 'var(--c-muted)' }}>Coché, 10 kg sont ajoutés à la masse du pilote.</span>
              </span>
            </label>
            <Ligne lib="Densité du carburant" unite="kg/L" aide="0,8 pour du Jet A1, 0,72 pour de l’AvGas.">
              <Saisie v={v.densite_carburant} onChange={maj('densite_carburant')} num />
            </Ligne>
          </Bloc>

          <Bloc titre="Vol">
            <Ligne lib="Vario mini en montée" unite="ft/min"><Saisie v={v.vario_montee_min_ftmin} onChange={maj('vario_montee_min_ftmin')} num /></Ligne>
            <Ligne lib="Vario maxi en montée" unite="ft/min"><Saisie v={v.vario_montee_max_ftmin} onChange={maj('vario_montee_max_ftmin')} num /></Ligne>
            <Ligne lib="Taux de descente maxi" unite="ft/min"><Saisie v={v.taux_descente_max_ftmin} onChange={maj('taux_descente_max_ftmin')} num /></Ligne>
            <Ligne lib="Temps d’un plein (kéro)" unite="min"><Saisie v={v.temps_kero_min} onChange={maj('temps_kero_min')} num /></Ligne>
            {apercu.duree && (
              <Apercu>
                À {nf.format(versNombre(v.altitude_max_m) || 4000)} m : montée {apercu.duree.monteeMin}–{apercu.duree.monteeMax} min
                {apercu.duree.descente !== null && <>, descente {apercu.duree.descente} min, soit un tour d’environ {apercu.duree.tour} min</>}.
              </Apercu>
            )}
          </Bloc>

          <Bloc titre="Carburant">
            <Ligne lib="Consommation par rotation" unite="L"><Saisie v={v.conso_rotation_l} onChange={maj('conso_rotation_l')} num /></Ligne>
            <Ligne lib="Rotations par plein" ><Saisie v={v.rotations_par_plein} onChange={maj('rotations_par_plein')} num /></Ligne>
            <Ligne lib="Réserve" unite="L"><Saisie v={v.reserve_kero_l} onChange={maj('reserve_kero_l')} num /></Ligne>
            {apercu.plein !== null && (
              <Apercu>Plein estimé : {nf.format(apercu.plein)} L. La planche signale le kéro quand le tour suivant entamerait la réserve.</Apercu>
            )}
          </Bloc>

          <div className="md:col-span-2">
            <Bloc titre="Centrage" aide="Bras de levier en mètres, depuis le plan de référence de la fiche de pesée.">
              <div className="grid gap-x-6 md:grid-cols-2">
                <div>
                  <Ligne lib="Corde aérodynamique moyenne" unite="m" aide="La MAC. Ex. 1,9 m sur un PC-6 B2H2.">
                    <Saisie v={v.corde_mac_m} onChange={maj('corde_mac_m')} num />
                  </Ligne>
                  <Ligne lib="Distance de référence" unite="m" aide="Du plan de référence au bord d’attaque. Ex. 3,0 m sur un PC-6.">
                    <Saisie v={v.distance_reference_m} onChange={maj('distance_reference_m')} num />
                  </Ligne>
                  <label className="block py-2">
                    <span className="text-[13px] font-semibold">Domaine de centrage</span>
                    <span className="block text-[13px]" style={{ color: 'var(--c-muted)' }}>
                      Sommets [masse en kg, % de corde]. Ex. [0,11],[1450,11],[2200,25],[2200,34],[0,34] sur un PC-6 B2H2.
                    </span>
                    <input value={v.domaine} onChange={maj('domaine')} spellCheck={false}
                      className="mt-1 w-full rounded-lg px-3 text-[13px] font-mono" style={styleSaisie} />
                    <span className="block text-[13px] mt-1" style={{
                      color: v.domaine.trim() && !domaine ? 'var(--sev-critique)' : 'var(--c-muted)' }}>
                      {!v.domaine.trim() ? 'Non renseigné.' : domaine ? `${domaine.length} sommets lus.` : 'Illisible : il faut au moins trois sommets.'}
                    </span>
                  </label>
                  <Ligne lib="Avion vide" unite="m"><Saisie v={v.bras_vide_m} onChange={maj('bras_vide_m')} num /></Ligne>
                  <Ligne lib="Pilote" unite="m"><Saisie v={v.bras_pilote_m} onChange={maj('bras_pilote_m')} num /></Ligne>
                  <Ligne lib="Carburant" unite="m"><Saisie v={v.bras_carburant_m} onChange={maj('bras_carburant_m')} num /></Ligne>
                </div>
                <div>
                  <p className="text-[13px] font-semibold pt-2">Sièges parachutistes</p>
                  <p className="text-[13px]" style={{ color: 'var(--c-muted)' }}>Le siège n° 1 reçoit le premier de la planche.</p>
                  <div className="grid grid-cols-2 gap-x-4">
                    {bras.map((b, i) => (
                      <Ligne key={i} lib={`Siège ${i + 1}`} unite="m">
                        <Saisie v={b} num onChange={e => { const t = e.target.value; setBras(x => x.map((y, j) => j === i ? t : y)); }} />
                      </Ligne>
                    ))}
                  </div>
                </div>
              </div>
            </Bloc>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center gap-3 px-4 py-3 flex-wrap"
          style={{ background: 'var(--c-card)', borderTop: '1px solid var(--c-border)' }}>
          {erreur
            ? <p role="alert" className="flex-1 min-w-[200px] text-[13px]" style={{ color: 'var(--sev-critique)' }}>{erreur}</p>
            : <p className="flex-1 min-w-[200px] text-[13px]" style={{ color: 'var(--c-muted)' }}>
                Ces chiffres se lisent sur les papiers de l’avion ; ParaPass n’en invente aucun.
              </p>}
          <button type="button" onClick={onFermer} className="px-4 rounded-xl text-[14px] font-semibold"
            style={{ minHeight: 44, color: 'var(--c-text2, var(--c-text))', border: '1px solid var(--c-border)' }}>
            Annuler
          </button>
          <button type="button" onClick={enregistrer} disabled={envoi} className="px-5 rounded-xl text-[14px] font-bold disabled:opacity-60"
            style={{ minHeight: 44, background: 'var(--action-fond, #2563EB)', color: '#fff' }}>
            {envoi ? 'Enregistrement…' : 'Enregistrer la fiche'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styleSaisie = { minHeight: 44, background: 'var(--c-input, var(--c-bg))', color: 'var(--c-text)',
  border: '1px solid var(--c-border)' } as const;

function Bloc({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--c-surface, var(--c-bg))', border: '1px solid var(--c-border)' }}>
      <h3 className="text-[14px] font-bold">{titre}</h3>
      {aide && <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-muted)' }}>{aide}</p>}
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Ligne({ lib, unite, aide, children }: { lib: string; unite?: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 py-1.5">
      <span className="flex-1 min-w-0 text-[13px]">
        {lib}
        {aide && <span className="block" style={{ color: 'var(--c-muted)' }}>{aide}</span>}
      </span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        {children}
        {unite && <span className="text-[13px] w-12" style={{ color: 'var(--c-muted)' }}>{unite}</span>}
      </span>
    </label>
  );
}

function Saisie({ v, onChange, num, placeholder }: {
  v: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; num?: boolean; placeholder?: string;
}) {
  return (
    <input value={v} onChange={onChange} placeholder={placeholder ?? (num ? '—' : undefined)}
      inputMode={num ? 'decimal' : undefined}
      className={`rounded-lg px-3 text-[14px] ${num ? 'w-24 text-right tabular-nums' : 'w-44 sm:w-52'}`} style={styleSaisie} />
  );
}

function Apercu({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[13px] rounded-xl px-3 py-2"
      style={{ background: 'color-mix(in srgb, var(--action-texte) 10%, transparent)', color: 'var(--c-text2, var(--c-text))' }}>
      {children}
    </p>
  );
}
