import { useState, useEffect } from 'react';
import { Plane, AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { FileAvionnage } from './FileAvionnage';
import { useResumeAvionnage, dzActive, type ResumeAvionnageDz } from '../lib/avionnage';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — UN SEUL BLOC, quel que soit le nombre de DZ.
//
// CE QUI N'ALLAIT PAS : le tableau de bord posait un bandeau d'avionnage PAR
// CENTRE. Deux affiliations donnaient deux bandeaux, cinq en donnaient cinq —
// tous identiques, tous vides, et la licence numérique passait sous la ligne
// de flottaison. Le défaut n'est pas cosmétique : il est de conception. ON NE
// SAUTE PAS SUR CINQ DROP ZONES LE MÊME JOUR. Afficher les cinq, c'est
// afficher quatre fois rien.
//
// Ce que ce composant fait à la place :
//
//   • RIEN N'EST PROGRAMMÉ NULLE PART → une ligne. Pas une carte par DZ, pas
//     un bloc : une ligne discrète qui dit qu'il n'y a rien et disparaît du
//     regard. C'est l'état le plus fréquent — un tableau de bord s'ouvre plus
//     souvent un mardi soir qu'un samedi au hangar.
//
//   • QUELQUE CHOSE QUELQUE PART → la DZ concernée, en entier, et elle seule.
//     Le choix vient de `mon_avionnage_du_jour`, qui trie déjà : d'abord là où
//     je suis en file, puis là où un avion vole. L'écran ne devine pas.
//
//   • PLUSIEURS DZ → un sélecteur en pastilles, avec un point sur celles où il
//     se passe quelque chose. On garde l'accès aux autres sans les étaler.
//
// Le bloc complet reste `FileAvionnage` : il est bon, il n'est pas réécrit.
// Ce composant décide seulement LEQUEL montrer.
// ═══════════════════════════════════════════════════════════════════════════

function SelecteurDz({ dzs, choisie, onChoisir }: {
  dzs: ResumeAvionnageDz[]; choisie: string; onChoisir: (id: string) => void;
}) {
  if (dzs.length < 2) return null;
  return (
    <div className="flex gap-1.5 flex-wrap mb-2">
      {dzs.map(d => {
        const actif = d.centre_id === choisie;
        return (
          <button key={d.centre_id} type="button" onClick={() => onChoisir(d.centre_id)}
            className="text-[11px] font-semibold px-2.5 rounded-full inline-flex items-center gap-1.5"
            style={{
              minHeight: 30,
              background: actif ? 'rgba(249,115,22,0.16)' : 'var(--c-surface)',
              color: actif ? '#FDBA74' : 'var(--c-muted)',
              border: `1px solid ${actif ? 'rgba(249,115,22,0.4)' : 'var(--c-border)'}`,
            }}>
            {/* Le point ne dit pas « ouvert » mais « il s'y passe quelque chose
                aujourd'hui » — un module ouvert sans avion n'intéresse personne. */}
            {dzActive(d) && (
              <span aria-hidden style={{
                width: 6, height: 6, borderRadius: 999, flexShrink: 0,
                background: d.ma_position !== null ? '#34D399' : '#F97316',
              }} />
            )}
            {d.centre_nom}
          </button>
        );
      })}
    </div>
  );
}

function AvionnageInner({ userId }: { userId: string | undefined }) {
  const { dzs, chargement, erreur } = useResumeAvionnage(userId);
  const [choisie, setChoisie] = useState<string | null>(null);

  // La DZ retenue suit le tri de la base tant que l'utilisateur n'a pas choisi
  // lui-même. Dès qu'un avion se programme ailleurs, la sélection le suit.
  useEffect(() => {
    if (dzs.length === 0) { setChoisie(null); return; }
    setChoisie(c => (c && dzs.some(d => d.centre_id === c)) ? c : dzs[0].centre_id);
  }, [dzs]);

  if (chargement || dzs.length === 0) return null;

  if (erreur) {
    return (
      <div className="rounded-xl px-4 py-3 mb-6 text-xs flex items-start gap-2"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden />
        <span>Avionnage indisponible — {erreur}. Rapproche-toi du chef d’avionnage.</span>
      </div>
    );
  }

  const actives = dzs.filter(dzActive);

  // AUCUNE DZ N'A RIEN AUJOURD'HUI : une ligne, et on passe à autre chose.
  if (actives.length === 0) {
    return (
      <div className="rounded-xl px-4 py-2.5 mb-6 flex items-center gap-2.5"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <Plane className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />
        <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
          Aucun avion programmé aujourd’hui
          {dzs.length > 1 ? ` sur tes ${dzs.length} DZ` : ` à ${dzs[0].centre_nom}`}.
        </span>
      </div>
    );
  }

  const dz = dzs.find(d => d.centre_id === choisie) ?? dzs[0];

  return (
    <div className="mb-6">
      <SelecteurDz dzs={dzs} choisie={dz.centre_id} onChoisir={setChoisie} />
      {/* `key` sur la DZ : changer de centre remonte le bloc, sinon il garderait
          la file du centre précédent le temps d'un aller-retour réseau. */}
      <FileAvionnage key={dz.centre_id} centreId={dz.centre_id}
        centreNom={dzs.length > 1 ? dz.centre_nom : undefined} userId={userId} />
    </div>
  );
}

export function AvionnageDuJour({ userId }: { userId: string | undefined }) {
  if (!userId) return null;
  return <ErrorBoundary><AvionnageInner userId={userId} /></ErrorBoundary>;
}
