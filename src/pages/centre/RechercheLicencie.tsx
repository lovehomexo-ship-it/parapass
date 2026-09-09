import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, UserPlus } from 'lucide-react';
import { surface, action, pastille, enTeteSection, rayure, type Severite } from '../../lib/jetons';
import { LIBELLE_TYPE, type TypeSautFile } from '../../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — Le DT cherche un licencié PAR SON NOM et l'embarque lui-même.
//
// Le sélecteur « Ajouter un présent… » ne proposait que les présents du jour.
// Or au bord de la piste, la personne est là, devant le DT, et n'est ni en
// file ni déclarée présente : elle vient d'arriver. Le DT ne doit pas avoir à
// lui expliquer le téléphone — il tape trois lettres et l'embarque.
//
// Périmètre : TOUS les licenciés actifs du centre, moins ceux déjà à bord
// aujourd'hui et ceux déjà en file (pour eux, la file est le bon chemin :
// on ne double pas la personne). L'aptitude s'affiche si elle est connue ;
// elle n'empêche rien — c'est la doctrine du produit, et le DT a la fiche à
// un clic pour comprendre.
// ═══════════════════════════════════════════════════════════════════════════

interface Licencie { id: string; nom: string; prenom: string; numero_licence: string | null }

const APTITUDE: Record<string, { sev: Severite; libelle: string }> = {
  rouge:   { sev: 'critique',  libelle: 'À examiner' },
  orange:  { sev: 'vigilance', libelle: 'Vigilance' },
  vert:    { sev: 'conforme',  libelle: 'Peut sauter' },
  inconnu: { sev: 'neutre',    libelle: 'Non déclaré présent' },
};

export function RechercheLicencie({ centreId, rotations, aptitudes, dejaABord, onInscrire, onOuvrirFiche }: {
  centreId: string;
  /** Rotations ouvertes, avec les sièges restants (null = aéronef inconnu). */
  rotations: { id: string; numero: number; places_libres: number | null }[];
  /** Aptitude du jour des présents, par id — absent = non déclaré présent. */
  aptitudes: Map<string, string>;
  /** Ids déjà à bord d'une planche aujourd'hui : on ne double personne. */
  dejaABord: Set<string>;
  onInscrire: (rotationId: string, parachutisteId: string, type: string) => Promise<void> | void;
  onOuvrirFiche: (parachutisteId: string) => void;
}) {
  const [texte, setTexte] = useState('');
  const [licencies, setLicencies] = useState<Licencie[]>([]);
  const [enFile, setEnFile] = useState<Set<string>>(new Set());
  const [type, setType] = useState<TypeSautFile>('solo');
  const [occupe, setOccupe] = useState<string | null>(null);

  // Une lecture au montage : la liste des licenciés d'un centre tient en
  // mémoire (quelques dizaines à quelques centaines). Filtrer localement
  // rend la recherche instantanée, ce qui compte plus que la fraîcheur ici.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const [{ data: lc }, { data: f }] = await Promise.all([
        supabase.from('licencies_centres')
          .select('parachutiste_id, profiles!parachutiste_id(id, nom, prenom, numero_licence, est_demo)')
          .eq('centre_id', centreId).eq('statut', 'actif'),
        supabase.from('file_avionnage').select('parachutiste_id')
          .eq('centre_id', centreId).eq('statut', 'attente')
          .eq('date_jour', new Date().toISOString().slice(0, 10)),
      ]);
      if (!vivant) return;
      type Pr = { id: string; nom: string; prenom: string; numero_licence: string | null; est_demo: boolean | null };
      setLicencies(((lc ?? []) as unknown as { profiles: Pr | Pr[] | null }[])
        .map(x => Array.isArray(x.profiles) ? x.profiles[0] : x.profiles)
        .filter((p): p is Pr => !!p)
        .map(p => ({ id: p.id, nom: p.nom, prenom: p.prenom, numero_licence: p.numero_licence }))
        .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)));
      setEnFile(new Set((f ?? []).map(x => x.parachutiste_id)));
    })();
    return () => { vivant = false; };
  }, [centreId]);

  const q = texte.trim().toLowerCase();
  // Recherche sur nom, prénom, ou numéro de licence — le DT tape ce qu'il a
  // sous les yeux. Trois caractères minimum : en dessous, la liste est du bruit.
  const resultats = q.length < 2 ? [] : licencies
    .filter(l => !dejaABord.has(l.id) && !enFile.has(l.id))
    .filter(l => `${l.prenom} ${l.nom}`.toLowerCase().includes(q)
              || `${l.nom} ${l.prenom}`.toLowerCase().includes(q)
              || (l.numero_licence ?? '').toLowerCase().includes(q))
    .slice(0, 8);

  const embarquer = async (rotationId: string, id: string) => {
    setOccupe(id);
    await onInscrire(rotationId, id, type);
    setOccupe(null);
    setTexte('');
  };

  const dispo = rotations.filter(r => r.places_libres === null || r.places_libres > 0);

  return (
    <section aria-label="Embarquer un licencié" className="p-4" style={surface(2)}>
      <h3 style={{ ...enTeteSection, marginBottom: 8 }}>
        <UserPlus className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden />
        Embarquer directement
      </h3>

      <div className="flex gap-2 flex-wrap">
        <label className="flex-1 min-w-[180px] flex items-center gap-2 px-3 rounded-xl"
          style={{ minHeight: 44, background: 'var(--c-input)', border: '1px solid var(--n2-bord)' }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} aria-hidden />
          <span className="sr-only">Nom, prénom ou numéro de licence</span>
          <input type="search" value={texte} onChange={e => setTexte(e.target.value)}
            placeholder="Nom, prénom ou n° de licence…"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{ fontSize: 14, color: 'var(--c-text)' }} />
        </label>
        <select value={type} onChange={e => setType(e.target.value as TypeSautFile)}
          aria-label="Type de saut"
          className="px-3 rounded-xl"
          style={{ minHeight: 44, fontSize: 14, background: 'var(--c-input)',
                   color: 'var(--c-text)', border: '1px solid var(--n2-bord)' }}>
          {(Object.keys(LIBELLE_TYPE) as TypeSautFile[]).map(t => (
            <option key={t} value={t}>{LIBELLE_TYPE[t]}</option>
          ))}
        </select>
      </div>

      {q.length >= 2 && resultats.length === 0 && (
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--c-muted)' }}>
          Aucun licencié disponible pour « {texte.trim()} » — déjà à bord, déjà en file, ou inconnu du centre.
        </p>
      )}

      {resultats.length > 0 && (
        <ul className="mt-3">
          {resultats.map((l, i) => {
            const a = APTITUDE[aptitudes.get(l.id) ?? 'inconnu'];
            return (
              <li key={l.id} className="flex items-center gap-2 py-2 px-2 flex-wrap"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--n3-filet)', ...rayure(a.sev) }}>
                <button type="button" onClick={() => onOuvrirFiche(l.id)}
                  className="flex-1 min-w-0 text-left hover:underline font-bold"
                  style={{ fontSize: 14, color: 'var(--c-text)', minHeight: 32 }}>
                  {l.prenom} {l.nom}
                  {l.numero_licence && (
                    <span className="font-normal" style={{ color: 'var(--c-muted)' }}> · {l.numero_licence}</span>
                  )}
                </button>
                <span className="flex-shrink-0" style={pastille(a.sev)}>{a.libelle}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {dispo.map(r => (
                    <button key={r.id} type="button" disabled={occupe !== null}
                      onClick={() => embarquer(r.id, l.id)}
                      className="disabled:opacity-50"
                      style={{ ...action('secondaire'), minHeight: 36, fontSize: 12, padding: '0 10px' }}>
                      <UserPlus className="w-3.5 h-3.5" aria-hidden /> Rot. {r.numero}
                    </button>
                  ))}
                  {dispo.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>aucune planche avec de la place</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
