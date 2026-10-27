import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Pencil, Trash2, ChevronRight, Wind, ClipboardList, X } from 'lucide-react';
import type { Saut } from '../../lib/types';
import { NATURE_SAUT_LABELS } from '../../lib/types';

// ═══════════════════════════════════════════════════════════════════════════
// LE CARNET — une liste qu'on parcourt, pas 46 écrans d'un seul bloc.
//
// Les 269 sauts s'affichaient d'un coup (37 754 px), sans repère ni recherche,
// avec une icône de suppression coupée au bord droit sur téléphone. Ici :
//   • une recherche (DZ, avion, n°, nature, année) et deux filtres ;
//   • les sauts groupés par mois, l'en-tête du mois collé en haut en défilant ;
//   • 40 lignes, puis la suite en descendant — le carnet d'un moniteur à
//     3 000 sauts s'ouvre aussi vite que celui d'un élève ;
//   • la même liste sur téléphone et sur ordinateur.
// ═══════════════════════════════════════════════════════════════════════════

const PAGE = 40;
type Filtre = 'tous' | 'a_valider' | 'soufflerie';

export function CarnetListe({ sauts, numeros, statutBadge, onDetail, onEdit, onDelete }: {
  sauts: Saut[];                       // déjà triés, du plus récent au plus ancien
  numeros: Record<string, number>;
  statutBadge: (s: Saut) => React.ReactNode;
  onDetail: (s: Saut) => void;
  onEdit: (s: Saut) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [n, setN] = useState(PAGE);
  const fin = useRef<HTMLDivElement>(null);

  const filtres = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, '');
    return sauts.filter(s => {
      if (filtre === 'a_valider' && s.statut !== 'en_attente') return false;
      if (filtre === 'soufflerie' && !(s.is_tunnel || s.source === 'soufflerie')) return false;
      if (!t) return true;
      const meule = [s.lieu, s.aeronef_immat, NATURE_SAUT_LABELS[s.nature_saut], s.date_saut.slice(0, 4),
        numeros[s.id] != null ? String(numeros[s.id]) : ''].filter(Boolean).join(' ').toLowerCase();
      return meule.includes(t);
    });
  }, [sauts, q, filtre, numeros]);

  // Une nouvelle recherche repart du haut de la liste.
  useEffect(() => { setN(PAGE); }, [q, filtre]);

  // La suite se charge quand on approche du bas.
  useEffect(() => {
    const el = fin.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setN(v => v + PAGE); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtres.length]);

  const visibles = filtres.slice(0, n);
  const mois = useMemo(() => {
    const groupes: { cle: string; libelle: string; total: number; sauts: Saut[] }[] = [];
    const totalParMois = new Map<string, number>();
    filtres.forEach(s => totalParMois.set(s.date_saut.slice(0, 7), (totalParMois.get(s.date_saut.slice(0, 7)) ?? 0) + 1));
    visibles.forEach(s => {
      const cle = s.date_saut.slice(0, 7);
      let g = groupes[groupes.length - 1];
      if (!g || g.cle !== cle) {
        g = { cle, libelle: new Date(`${cle}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
              total: totalParMois.get(cle) ?? 0, sauts: [] };
        groupes.push(g);
      }
      g.sauts.push(s);
    });
    return groupes;
  }, [visibles, filtres]);

  const nbAValider = sauts.filter(s => s.statut === 'en_attente').length;
  const nbSoufflerie = sauts.filter(s => s.is_tunnel || s.source === 'soufflerie').length;

  return (
    <div>
      {/* ── Recherche et filtres ── */}
      <div className="px-4 pt-4 pb-3 space-y-2.5">
        <label className="flex items-center gap-2 rounded-xl px-3" style={{ minHeight: 44, background: 'var(--c-hover)' }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} aria-hidden />
          <span className="sr-only">Rechercher dans le carnet</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder="DZ, avion, n°, année…"
            className="flex-1 bg-transparent outline-none text-[15px]" style={{ color: 'var(--c-text)', minWidth: 0 }} />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Effacer la recherche" className="w-8 h-8 flex items-center justify-center">
              <X className="w-4 h-4" style={{ color: 'var(--c-muted)' }} aria-hidden />
            </button>
          )}
        </label>
        <div role="group" aria-label="Filtrer" className="flex gap-2 flex-wrap">
          {([['tous', `Tous · ${sauts.length}`], ['a_valider', `À valider · ${nbAValider}`],
             ...(nbSoufflerie ? [['soufflerie', `Soufflerie · ${nbSoufflerie}`]] : [])] as [Filtre, string][]).map(([cle, lib]) => {
            const actif = filtre === cle;
            return (
              <button key={cle} type="button" aria-pressed={actif} onClick={() => setFiltre(cle)}
                className="rounded-full px-3 text-[13px] font-semibold"
                style={{ minHeight: 34, background: actif ? 'var(--accent-fond)' : 'var(--c-hover)', color: actif ? '#fff' : 'var(--c-text2)' }}>
                {lib}
              </button>
            );
          })}
        </div>
      </div>

      {filtres.length === 0 && (
        <p className="px-4 py-10 text-center text-sm" style={{ color: 'var(--c-muted)' }}>
          Aucun saut ne correspond{q ? ` à « ${q} »` : ''}.
        </p>
      )}

      {/* ── Les mois ── */}
      {mois.map(g => (
        <section key={g.cle} aria-label={g.libelle}>
          {/* L'en-tête du mois reste collé en haut pendant le défilement :
              on sait toujours où l'on est dans le carnet. */}
          <h3 className="sticky z-10 px-4 py-2 text-[13px] font-bold capitalize flex items-baseline justify-between"
            style={{ top: 56, background: 'var(--c-surface, var(--c-card))', color: 'var(--c-text2)', borderTop: '1px solid var(--c-border-s)', borderBottom: '1px solid var(--c-border-s)' }}>
            <span>{g.libelle}</span>
            <span className="font-semibold normal-case" style={{ color: 'var(--c-muted)' }}>{g.total} saut{g.total > 1 ? 's' : ''}</span>
          </h3>
          {g.sauts.map(s => <Ligne key={s.id} s={s} numero={numeros[s.id] ?? null} statutBadge={statutBadge}
            onDetail={onDetail} onEdit={onEdit} onDelete={onDelete} />)}
        </section>
      ))}

      {visibles.length < filtres.length && (
        <div ref={fin} className="px-4 py-4">
          <button type="button" onClick={() => setN(v => v + PAGE)} className="w-full rounded-xl text-sm font-semibold"
            style={{ minHeight: 44, color: 'var(--accent-texte)', background: 'var(--c-hover)' }}>
            Afficher la suite · {filtres.length - visibles.length} saut{filtres.length - visibles.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function Ligne({ s, numero, statutBadge, onDetail, onEdit, onDelete }: {
  s: Saut; numero: number | null; statutBadge: (s: Saut) => React.ReactNode;
  onDetail: (s: Saut) => void; onEdit: (s: Saut) => void; onDelete: (id: string) => void;
}) {
  const soufflerie = s.is_tunnel || s.source === 'soufflerie';
  if (s.statut === 'declaration_honneur') {
    return (
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--c-border-s)' }}>
        <ClipboardList className="w-5 h-5 flex-shrink-0" style={{ color: '#A78BFA' }} aria-hidden />
        <span className="text-sm" style={{ color: 'var(--c-text2)' }}>
          <strong>Solde antérieur</strong> — {s.nb_sauts_declares ?? '?'} sauts déclarés sur l'honneur
        </span>
      </div>
    );
  }
  // Modifiable tant qu'un moniteur n'a pas signé.
  const modifiable = s.statut !== 'valide' && s.statut !== 'refuse' && s.statut !== 'historique';
  return (
    <div className="flex items-center gap-2 pl-4 pr-2" style={{ borderBottom: '1px solid var(--c-border-s)', minHeight: 60 }}>
      <button type="button" onClick={() => onDetail(s)} className="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-left">
        <span className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 tabular-nums"
          style={soufflerie
            ? { background: 'color-mix(in srgb, #0E7490 14%, transparent)', color: '#0E7490' }
            : { background: 'color-mix(in srgb, var(--accent-texte) 14%, transparent)', color: 'var(--accent-texte)' }}>
          {soufflerie ? <Wind className="w-4 h-4" aria-hidden /> : (numero ?? '—')}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold truncate" style={{ color: 'var(--c-text)' }}>{s.lieu || 'Lieu non renseigné'}</span>
          <span className="block text-[13px] truncate" style={{ color: 'var(--c-muted)' }}>
            {new Date(s.date_saut).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
            {soufflerie
              ? ' · soufflerie'
              : ` · ${s.hauteur_m.toLocaleString('fr-FR')} m · ${NATURE_SAUT_LABELS[s.nature_saut] ?? s.nature_saut}`}
          </span>
        </span>
        <span className="flex-shrink-0 hidden min-[420px]:inline">{statutBadge(s)}</span>
        {!modifiable && <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />}
      </button>
      {modifiable && (
        <span className="flex items-center flex-shrink-0">
          <button type="button" onClick={() => onEdit(s)} aria-label={`Modifier le saut du ${new Date(s.date_saut).toLocaleDateString('fr-FR')}`}
            className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ color: 'var(--c-muted)' }}>
            <Pencil className="w-4 h-4" aria-hidden />
          </button>
          <button type="button" onClick={() => onDelete(s.id)} aria-label={`Supprimer le saut du ${new Date(s.date_saut).toLocaleDateString('fr-FR')}`}
            className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ color: 'var(--sev-critique)' }}>
            <Trash2 className="w-4 h-4" aria-hidden />
          </button>
        </span>
      )}
    </div>
  );
}
