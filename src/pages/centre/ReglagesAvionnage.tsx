import { useState, useEffect } from 'react';
import { X, Settings2, BookOpen, Calculator, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { surface, action, enTeteSection, SEVERITE_COULEUR } from '../../lib/jetons';
import { messageErreur, type Discipline, SOURCE_DT48 } from '../../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// RÉGLAGES DE L'AVIONNAGE — ce que le centre décide lui-même.
//
// Discret : une roue crantée dans l'en-tête du module, pas une entrée de menu
// de plus. On règle l'avionnage DEPUIS l'avionnage.
//
// Deux réglages pour commencer, ceux qui changent ce que l'écran affiche :
//   • les disciplines proposées — le catalogue est commun, l'activation est
//     au centre ;
//   • l'abaque de charge alaire, ET SA SOURCE.
//
// SUR L'ABAQUE, UN POINT QUI COMPTE. Les seuils livrés portent tous la mention
// « À VÉRIFIER — recommandations fédérales / manuels constructeurs » : ils ne
// sont fondés sur aucun texte identifié. Tant qu'aucune source n'est saisie,
// cet écran les présente comme un REPÈRE DU CENTRE, jamais comme une règle
// fédérale. C'est P2 : une règle porte la référence qui la fonde, ou elle n'en
// est pas une. Le champ « source » existe pour le jour où le texte est connu.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Un sac du PARC DU CENTRE. C'est la même table que le module Pliage
 * (`sacs_parachute`) : l'inventaire appartient au centre, le module Pliage ne
 * gouverne que le travail de pliage. Une seconde table aurait garanti deux
 * inventaires divergents au premier sac ajouté.
 */
interface SacParc {
  id: string; nom_court: string | null; marque: string | null; modele: string | null;
  numero_serie: string | null; taille_voile_ft2: number | null; statut: string; actif: boolean | null;
}

function Inner({ centreId, onFermer, onChange }: {
  centreId: string; onFermer: () => void; onChange: () => void;
}) {
  const [catalogue, setCatalogue] = useState<Discipline[]>([]);
  const [retirees, setRetirees] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [sacs, setSacs] = useState<SacParc[]>([]);
  const [nouvelleDiscipline, setNouvelleDiscipline] = useState('');
  const [nouvelleTeinte, setNouvelleTeinte] = useState('#818CF8');
  const [nouveauNom, setNouveauNom] = useState('');
  const [nouvelleSurface, setNouvelleSurface] = useState('');
  const [poids, setPoids] = useState('80');
  const [sauts, setSauts] = useState('120');
  const [resultat, setResultat] = useState<{
    surface_ft2: number; libelle_tranche: string; amenagee: number | null;
    poids_ecrete: boolean; hors_tableau_sauts: boolean;
  } | null>(null);

  /**
   * Le calculateur interroge la MÊME fonction SQL que le pare-feu de
   * l'avionnage. Refaire le calcul en JavaScript aurait donné deux vérités le
   * jour où le tableau change.
   */
  /**
   * Personnaliser une discipline du catalogue COMMUN : on n'y écrit pas, on
   * pose une surcharge propre au centre. Écrire dans le catalogue changerait
   * le libellé chez tous les autres centres.
   */
  const personnaliser = async (code: string, patch: { libelle?: string; teinte?: string }) => {
    setOccupe(true); setErreur(null);
    const { error } = await supabase.from('centres_disciplines')
      .upsert({ centre_id: centreId, code, actif: !retirees.has(code), ...patch },
              { onConflict: 'centre_id,code' });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    await charger();
    onChange();
  };

  /**
   * Créer une discipline que le catalogue n'a pas. Le code est dérivé du
   * libellé — sans accents ni espaces — parce qu'il sert de clé étrangère et
   * qu'il doit rester stable même si le libellé change ensuite.
   */
  const ajouterDiscipline = async () => {
    const libelle = nouvelleDiscipline.trim();
    if (!libelle) return;
    const code = libelle.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    if (!code) { setErreur('Ce nom ne donne aucun code utilisable.'); return; }
    setOccupe(true); setErreur(null);
    const { error } = await supabase.from('disciplines_saut').insert({
      code, libelle, teinte: nouvelleTeinte, ordre: 500, centre_id: centreId, actif: true,
    });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    setNouvelleDiscipline('');
    await charger();
    onChange();
  };

  /** La surface d'un sac : c'est elle que lit la DT 48 pour un sauteur en location. */
  const ecrireSurface = async (sacId: string, valeur: string) => {
    setOccupe(true); setErreur(null);
    const { error } = await supabase.from('sacs_parachute')
      .update({ taille_voile_ft2: valeur.trim() === '' ? null : Number(valeur.replace(',', '.')) })
      .eq('id', sacId);
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    await charger();
    onChange();
  };

  /**
   * Ajouter un sac au parc. Le jeton QR est généré même sans le module Pliage :
   * la colonne l'exige, et le jour où le centre souscrit le Pliage, ses sacs
   * sont déjà prêts. Rien à reprendre.
   */
  const ajouterSac = async () => {
    if (!nouveauNom.trim()) return;
    setOccupe(true); setErreur(null);
    const { error } = await supabase.from('sacs_parachute').insert({
      centre_id: centreId,
      nom_court: nouveauNom.trim(),
      qr_code_token: crypto.randomUUID(),
      taille_voile_ft2: nouvelleSurface.trim() === '' ? null : Number(nouvelleSurface.replace(',', '.')),
      actif: true, statut: 'en_service',
    });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    setNouveauNom(''); setNouvelleSurface('');
    await charger();
    onChange();
  };

  const calculer = async () => {
    setOccupe(true); setErreur(null);
    const { data, error } = await supabase.rpc('dt48_surface_minimale', {
      p_poids_nu: Number(poids.replace(',', '.')), p_nb_sauts: Number(sauts),
    });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); setResultat(null); return; }
    const r = (data ?? [])[0] as {
      surface_ft2: number; libelle_tranche: string;
      poids_ecrete: boolean; hors_tableau_sauts: boolean;
    } | undefined;
    setResultat(r ? {
      surface_ft2: r.surface_ft2, libelle_tranche: r.libelle_tranche,
      amenagee: Math.round(r.surface_ft2 * 0.89 * 10) / 10,
      poids_ecrete: r.poids_ecrete, hors_tableau_sauts: r.hors_tableau_sauts,
    } : null);
  };

  const charger = async () => {
    const [{ data: d }, { data: cd }, { data: sp }] = await Promise.all([
      supabase.rpc('disciplines_du_centre', { p_centre_id: centreId }),
      supabase.from('centres_disciplines').select('code, actif').eq('centre_id', centreId),
      supabase.from('sacs_parachute')
        .select('id, nom_court, marque, modele, numero_serie, taille_voile_ft2, statut, actif')
        .eq('centre_id', centreId).order('nom_court'),
    ]);
    setCatalogue((d ?? []) as Discipline[]);
    setRetirees(new Set((cd ?? []).filter(x => !x.actif).map(x => x.code)));
    setSacs((sp ?? []) as SacParc[]);
    setChargement(false);
  };
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [centreId]);

  const basculerDiscipline = async (code: string, actif: boolean) => {
    setOccupe(true); setErreur(null);
    const { error } = await supabase.from('centres_disciplines')
      .upsert({ centre_id: centreId, code, actif }, { onConflict: 'centre_id,code' });
    setOccupe(false);
    if (error) { setErreur(messageErreur(error)); return; }
    setRetirees(s => { const n = new Set(s); if (actif) n.delete(code); else n.add(code); return n; });
    onChange();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-label="Réglages de l’avionnage">
      <div className="w-full max-w-2xl mt-8 p-4 rounded-2xl" style={surface(1)}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 style={{ ...enTeteSection, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <Settings2 className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden />
            Réglages de l’avionnage
          </h2>
          <button type="button" onClick={onFermer} style={{ ...action('texte'), minHeight: 36 }}>
            <X className="w-4 h-4" aria-hidden /> Fermer
          </button>
        </div>

        {erreur && (
          <p role="alert" className="px-3 py-2 rounded-xl mb-3" style={{
            fontSize: 13, borderLeft: '5px solid var(--sev-critique)', color: 'var(--c-text2)',
            background: 'color-mix(in srgb, var(--sev-critique) 10%, transparent)' }}>{erreur}</p>
        )}

        {chargement ? (
          <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>Chargement…</p>
        ) : (
          <div className="space-y-5">
            {/* ── Les disciplines proposées ─────────────────────────────── */}
            <section>
              <h3 style={{ ...enTeteSection, marginBottom: 6 }}>Disciplines proposées</h3>
              <p className="mb-2" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                Ce que ce centre propose à l’avionnage. Retirer une discipline ne
                l’efface nulle part : les sauts passés la gardent, et un saut en
                cours continue de l’afficher.
              </p>
              <ul className="space-y-1.5">
                {catalogue.map(d => {
                  const actif = !retirees.has(d.code);
                  return (
                    <li key={d.code} className="flex items-center gap-2 flex-wrap px-2 py-1.5 rounded-xl"
                      style={{ background: 'var(--n3-fond)', border: '1px solid var(--n3-filet)' }}>
                      {/* LE LIBELLÉ. Modifiable : c'est le mot que lit le chef
                          d'avionnage, il doit être celui de son club. */}
                      <input type="text" defaultValue={d.libelle} disabled={occupe}
                        aria-label={`Libellé de ${d.libelle}`}
                        onBlur={e => {
                          if (e.target.value.trim() && e.target.value !== d.libelle)
                            personnaliser(d.code, { libelle: e.target.value.trim() });
                        }}
                        className="px-2 rounded-lg"
                        style={{ width: 150, minHeight: 32, fontSize: 13, fontWeight: 700,
                                 background: 'var(--c-input)',
                                 color: d.teinte ?? 'var(--c-text)',
                                 border: `1px solid ${d.teinte ?? 'var(--n2-bord)'}` }} />

                      {/* LA COULEUR. Elle groupe, elle n'alerte pas : le mot
                          reste à côté, et c'est lui qui renseigne. */}
                      <input type="color" defaultValue={d.teinte ?? '#94A3B8'} disabled={occupe}
                        aria-label={`Couleur de ${d.libelle}`}
                        onBlur={e => { if (e.target.value !== d.teinte) personnaliser(d.code, { teinte: e.target.value }); }}
                        style={{ width: 38, height: 32, background: 'transparent',
                                 border: '1px solid var(--n2-bord)', borderRadius: 8, cursor: 'pointer' }} />

                      {d.radio_attendue && (
                        <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>radio attendue</span>
                      )}
                      {d.propre && (
                        <span style={{ fontSize: 11, color: 'var(--c-dim)' }}>propre à votre centre</span>
                      )}

                      <button type="button" disabled={occupe}
                        onClick={() => basculerDiscipline(d.code, !actif)}
                        aria-pressed={actif}
                        className="ml-auto px-2 py-1 rounded-lg"
                        style={{ fontSize: 12, fontWeight: 700,
                          color: actif ? SEVERITE_COULEUR.conforme : 'var(--c-dim)',
                          border: `1px ${actif ? 'solid' : 'dashed'} ${actif ? SEVERITE_COULEUR.conforme : 'var(--n2-bord)'}` }}>
                        {actif ? 'proposée' : 'retirée'}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Créer une discipline que le catalogue commun n'a pas. Elle
                  appartient au centre : les autres ne la voient pas. */}
              <div className="flex items-end gap-2 flex-wrap mt-2">
                <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Nouvelle discipline
                  <input type="text" value={nouvelleDiscipline}
                    onChange={e => setNouvelleDiscipline(e.target.value)}
                    placeholder="ex : Saut Cordouan" disabled={occupe}
                    className="block px-2 rounded-lg mt-1"
                    style={{ width: 180, minHeight: 32, fontSize: 13, background: 'var(--c-input)',
                             color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                </label>
                <input type="color" value={nouvelleTeinte}
                  onChange={e => setNouvelleTeinte(e.target.value)} disabled={occupe}
                  aria-label="Couleur de la nouvelle discipline"
                  style={{ width: 38, height: 32, background: 'transparent',
                           border: '1px solid var(--n2-bord)', borderRadius: 8, cursor: 'pointer' }} />
                <button type="button" onClick={ajouterDiscipline}
                  disabled={occupe || !nouvelleDiscipline.trim()}
                  className="disabled:opacity-50" style={{ ...action('secondaire'), minHeight: 34 }}>
                  <Plus className="w-4 h-4" aria-hidden /> Ajouter
                </button>
              </div>
            </section>

            {/* ── LE PARC DE VOILES DU CENTRE ───────────────────────────── */}
            <section>
              <h3 style={{ ...enTeteSection, marginBottom: 6 }}>
                Parc de voiles du centre
              </h3>
              <p className="mb-2" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                C’est le <strong>même inventaire</strong> que le module Pliage : une seule
                liste, deux écrans. Vous n’avez pas besoin du module Pliage pour
                tenir votre parc — il ne gouverne que le travail de pliage.
                <br />
                <strong>La surface est ce que lit la DT 48</strong> pour un sauteur en
                location : sans elle, il reste « surface inconnue », donc refusé.
              </p>

              {sacs.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--c-dim)' }}>
                  Aucun sac au parc. Ajoutez-en un ci-dessous.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {sacs.map(s => (
                    <li key={s.id} className="flex items-center gap-2 flex-wrap px-2 py-1.5 rounded-xl"
                      style={{ background: 'var(--n3-fond)', border: '1px solid var(--n3-filet)' }}>
                      <span className="flex-1 min-w-[140px]" style={{ fontSize: 13, color: 'var(--c-text)' }}>
                        <strong>{s.nom_court ?? 'sans nom'}</strong>
                        {(s.marque || s.modele) && (
                          <span style={{ color: 'var(--c-muted)', fontWeight: 400 }}>
                            {' · '}{[s.marque, s.modele].filter(Boolean).join(' ')}
                          </span>
                        )}
                        {s.numero_serie && (
                          <span style={{ color: 'var(--c-dim)', fontWeight: 400, fontSize: 11 }}>
                            {' · n° '}{s.numero_serie}
                          </span>
                        )}
                      </span>
                      <label className="flex items-center gap-1"
                        style={{ fontSize: 12,
                                 color: s.taille_voile_ft2 == null ? SEVERITE_COULEUR.vigilance : 'var(--c-muted)' }}>
                        <span className="sr-only">Surface de {s.nom_court ?? 'ce sac'}, en ft²</span>
                        <input type="number" min={50} max={500} step={1}
                          defaultValue={s.taille_voile_ft2 ?? ''} disabled={occupe}
                          placeholder="— ft²"
                          onBlur={e => {
                            if (Number(e.target.value || 0) !== Number(s.taille_voile_ft2 ?? 0))
                              ecrireSurface(s.id, e.target.value);
                          }}
                          className="px-1.5 rounded-lg text-right"
                          style={{ width: 78, minHeight: 30, fontSize: 12, background: 'var(--c-input)',
                                   color: 'var(--c-text)',
                                   border: `1px solid ${s.taille_voile_ft2 == null ? SEVERITE_COULEUR.vigilance : 'var(--n2-bord)'}` }} />
                        ft²
                      </label>
                      {s.statut !== 'en_service' && (
                        <span style={{ fontSize: 11, color: 'var(--c-dim)' }}>{s.statut}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-end gap-2 flex-wrap mt-2">
                <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Nouveau sac
                  <input type="text" value={nouveauNom} onChange={e => setNouveauNom(e.target.value)}
                    placeholder="ex : Club 39" disabled={occupe}
                    className="block px-2 rounded-lg mt-1"
                    style={{ width: 160, minHeight: 32, fontSize: 13, background: 'var(--c-input)',
                             color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                </label>
                <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Surface (ft²)
                  <input type="number" min={50} max={500} step={1} value={nouvelleSurface}
                    onChange={e => setNouvelleSurface(e.target.value)} disabled={occupe}
                    className="block px-2 rounded-lg mt-1"
                    style={{ width: 100, minHeight: 32, fontSize: 13, background: 'var(--c-input)',
                             color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                </label>
                <button type="button" onClick={ajouterSac} disabled={occupe || !nouveauNom.trim()}
                  className="disabled:opacity-50" style={{ ...action('secondaire'), minHeight: 34 }}>
                  <Plus className="w-4 h-4" aria-hidden /> Ajouter au parc
                </button>
              </div>
            </section>

            {/* ── LA DT 48, ET SON CALCULATEUR ──────────────────────────── */}
            <section>
              <h3 style={{ ...enTeteSection, marginBottom: 6 }}>
                Surface de voilure minimale — DT 48
              </h3>
              <p className="mb-2 flex items-start gap-1.5" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden />
                <span>
                  {SOURCE_DT48}. Le tableau se lit avec le <strong>poids nu</strong> :
                  le tableur fédéral ajoute lui-même 10 kg d’équipement.
                </span>
              </p>

              {/* Le calculateur : on entre un poids et un nombre de sauts, on lit
                  la surface. Il interroge la MÊME fonction que le pare-feu de
                  l’avionnage — deux calculs auraient fini par diverger. */}
              <div className="flex items-end gap-2 flex-wrap px-2 py-2 rounded-xl"
                style={{ background: 'var(--n3-fond)', border: '1px solid var(--n3-filet)' }}>
                <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Poids nu (kg)
                  <input type="number" min={30} max={160} step={1} value={poids}
                    onChange={e => setPoids(e.target.value)}
                    className="block px-2 rounded-lg mt-1"
                    style={{ width: 90, minHeight: 32, fontSize: 13, background: 'var(--c-input)',
                             color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                </label>
                <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Nombre de sauts
                  <input type="number" min={0} max={20000} step={10} value={sauts}
                    onChange={e => setSauts(e.target.value)}
                    className="block px-2 rounded-lg mt-1"
                    style={{ width: 110, minHeight: 32, fontSize: 13, background: 'var(--c-input)',
                             color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }} />
                </label>
                <button type="button" onClick={calculer} disabled={occupe}
                  style={{ ...action('secondaire'), minHeight: 34 }}>
                  <Calculator className="w-4 h-4" aria-hidden /> Calculer
                </button>

                {resultat && (
                  <p className="flex-1 min-w-[220px]" style={{ fontSize: 13, color: 'var(--c-text)' }}>
                    <strong style={{ fontSize: 18 }}>{resultat.surface_ft2} ft²</strong>{' '}
                    minimum — {resultat.libelle_tranche}
                    {resultat.amenagee !== null && (
                      <span style={{ color: 'var(--c-muted)' }}>
                        {' · '}avec aménagement −11 % : <strong>{resultat.amenagee} ft²</strong>
                      </span>
                    )}
                    {(resultat.poids_ecrete || resultat.hors_tableau_sauts) && (
                      <span className="block" style={{ fontSize: 11.5, color: SEVERITE_COULEUR.vigilance }}>
                        {resultat.poids_ecrete && 'Poids hors fourchette 60–110 kg : valeur extrême appliquée, comme le prévoit le texte. '}
                        {resultat.hors_tableau_sauts && 'Au-delà de 1600 sauts le tableau ne publie rien : dernière colonne appliquée — c’est une lecture prudente, pas une règle écrite.'}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <p className="mt-1.5" style={{ fontSize: 11.5, color: 'var(--c-dim)' }}>
                Le pare-feu de l’avionnage applique ce même tableau avant
                l’embarquement : une voile sous le minimum bloque la planche.
                L’aménagement de −11 % s’accorde par licencié, et ParaPass
                enregistre qui l’a accordé.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReglagesAvionnage(props: { centreId: string; onFermer: () => void; onChange: () => void }) {
  return <ErrorBoundary><Inner {...props} /></ErrorBoundary>;
}
