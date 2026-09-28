import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, HelpCircle, Check, Wrench, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// CONFORMITÉ DU DOSSIER — pourquoi, et comment y remédier.
//
// La liste des licenciés annonçait « Dossier incomplet · 1 » et la fiche ne
// disait pas lequel. Une anomalie qu'on ne sait pas résoudre n'est qu'un
// reproche : l'écran devient un juge au lieu d'un outil.
//
// Chaque ligne porte donc trois choses : CE QU'ON A CONSTATÉ, CE QU'IL FAUT
// FAIRE, et LE TEXTE qui fonde la règle. Le remède vient du référentiel, pas
// d'ici — on ne rédige pas une consigne de sécurité dans un composant React.
//
// LES DEUX MOMENTS SONT SÉPARÉS À L'ÉCRAN comme ils le sont en base. Ce qui se
// constate au pied de l'avion ne peut pas être réglé depuis une fiche, et le
// mélanger au reste ferait chercher une solution qui n'existe pas ici.
// ═══════════════════════════════════════════════════════════════════════════

interface Ligne {
  code: string; libelle: string; gravite: string; etat: string;
  detail: string | null; remede: string | null; source_texte: string | null;
  moment: string;
}

const TEINTE: Record<string, { fond: string; bord: string; texte: string }> = {
  bloquant:  { fond: 'rgba(239,68,68,0.10)',  bord: 'rgba(239,68,68,0.35)',  texte: '#FCA5A5' },
  vigilance: { fond: 'rgba(245,158,11,0.10)', bord: 'rgba(245,158,11,0.35)', texte: '#FBBF24' },
};

function Bloc({ titre, sous, lignes }: { titre: string; sous: string; lignes: Ligne[] }) {
  if (lignes.length === 0) return null;
  return (
    <div className="mt-4">
      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-text)' }}>{titre}</p>
      <p className="mb-2" style={{ fontSize: 11.5, color: 'var(--c-muted)' }}>{sous}</p>
      <ul className="space-y-2">
        {lignes.map(l => {
          const t = TEINTE[l.gravite] ?? TEINTE.vigilance;
          const gris = l.etat === 'indisponible';
          return (
            <li key={l.code} className="rounded-xl p-3"
              style={{ background: t.fond, border: `1px solid ${t.bord}` }}>
              <p className="flex items-start gap-2" style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                {gris
                  ? <HelpCircle className="w-4 h-4 flex-shrink-0 mt-px" style={{ color: t.texte }} aria-hidden />
                  : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" style={{ color: t.texte }} aria-hidden />}
                <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--c-muted)', fontSize: 11 }}>
                  {l.code}
                </span>
                <span className="flex-1">{l.libelle}</span>
              </p>

              {/* CE QU'ON A CONSTATÉ — la donnée, datée, telle qu'elle est lue. */}
              {l.detail && (
                <p className="mt-1 ml-6" style={{ fontSize: 12.5, color: 'var(--c-text2)' }}>{l.detail}</p>
              )}

              {/* CE QU'IL FAUT FAIRE — c'est ce qui manquait. */}
              {l.remede && (
                <p className="mt-2 ml-6 flex items-start gap-1.5"
                  style={{ fontSize: 12.5, color: 'var(--c-text)' }}>
                  <Wrench className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#6EE7B7' }} aria-hidden />
                  <span>{l.remede}</span>
                </p>
              )}

              {/* LE TEXTE QUI LA FONDE — une règle sans référence n'en est pas une. */}
              {l.source_texte && (
                <p className="mt-1.5 ml-6 flex items-start gap-1.5"
                  style={{ fontSize: 11, color: 'var(--c-dim)', fontStyle: 'italic' }}>
                  <BookOpen className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden />
                  <span>{l.source_texte}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ConformiteDossier({ parachutisteId, centreId }: {
  parachutisteId: string; centreId: string;
}) {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);

  useEffect(() => {
    let vivant = true;
    supabase.rpc('dossier_detail', {
      p_parachutiste_id: parachutisteId, p_centre_id: centreId,
    }).then(({ data, error }) => {
      if (!vivant) return;
      if (error) {
        console.error('Conformité du dossier — lecture échouée :', {
          code: error.code, message: error.message, details: error.details, hint: error.hint });
        setLignes([]);
        return;
      }
      setLignes((data ?? []) as Ligne[]);
    });
    return () => { vivant = false; };
  }, [parachutisteId, centreId]);

  if (lignes === null) {
    return <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>Lecture de la conformité…</p>;
  }

  const aTraiter = lignes.filter(l => l.etat === 'non_conforme' || l.etat === 'indisponible');
  const dossier = aTraiter.filter(l => l.moment === 'dossier');
  const embarquement = aTraiter.filter(l => l.moment === 'embarquement');
  const acquittees = lignes.filter(l => l.etat === 'controlee');

  return (
    <div className="rounded-2xl p-4"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)' }}>
        <ShieldCheck className="w-4 h-4" aria-hidden /> Conformité du dossier
      </p>

      {aTraiter.length === 0 ? (
        <p className="mt-2 flex items-center gap-2" style={{ fontSize: 13, color: 'var(--sev-conforme, #10B981)' }}>
          <Check className="w-4 h-4" aria-hidden />
          Rien à signaler sur pièces. Les constats du jour se font à l’embarquement.
        </p>
      ) : (
        <>
          <Bloc titre="À régler sur pièces"
            sous="Se corrige depuis cette fiche ou l’espace du licencié, n’importe quel jour."
            lignes={dossier} />
          <Bloc titre="À constater au pied de l’avion"
            sous="Ne se règle pas ici : le directeur technique l’acquitte sur la planche, le jour du saut."
            lignes={embarquement} />
        </>
      )}

      {acquittees.length > 0 && (
        <p className="mt-3" style={{ fontSize: 11.5, color: 'var(--c-muted)' }}>
          {acquittees.length} règle(s) acquittée(s) aujourd’hui par l’encadrement.
        </p>
      )}
    </div>
  );
}
