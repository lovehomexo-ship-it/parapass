import { Gauge } from 'lucide-react';
import {
  useCanopyGuidelines, usePoidsEquipe, getCanopyStatus, CANOPY_STATUS_CONFIG,
} from '../lib/canopy';
import { useJumpCounts } from '../lib/useJumpCount';

/** Encart charge alaire — strictement consultatif et pédagogique.
 *  Le poids équipé reste privé (table owner-only), jamais affiché ailleurs. */
export function ChargeAlaireCard({ userId, tailleVoileFt2 }: { userId: string | undefined; tailleVoileFt2: number | null }) {
  const guidelines = useCanopyGuidelines();
  const { poidsKg } = usePoidsEquipe(userId);
  const { valid: sautsCount } = useJumpCounts(userId);

  const { status, chargeAlaire, guideline } = getCanopyStatus(poidsKg, tailleVoileFt2, sautsCount, guidelines);
  const cfg = CANOPY_STATUS_CONFIG[status];

  // Jauge : position de la charge actuelle par rapport au repère de la tranche
  const gaugePct = chargeAlaire && guideline
    ? Math.min(100, (chargeAlaire / guideline.charge_max_recommandee) * 100 * 0.83) // repère à ~83 % de la jauge
    : 0;

  const trancheLabel = guideline
    ? `${guideline.sauts_min}–${guideline.sauts_max ?? '∞'} sauts`
    : null;

  return (
    <div className="mt-3 rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${status === 'donnees_manquantes' ? 'rgba(255,255,255,0.1)' : cfg.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4" style={{ color: status === 'donnees_manquantes' ? 'rgba(255,255,255,0.4)' : cfg.color }} />
          <span className="text-xs font-bold text-white">Charge alaire</span>
        </div>
        {status !== 'donnees_manquantes' && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
        )}
      </div>

      {status === 'donnees_manquantes' ? (
        <div>
          <p className="text-xs leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {!tailleVoileFt2
              ? 'Renseignez la surface de votre voile (ft²) via « Modifier » pour situer votre charge alaire.'
              : 'Renseignez votre poids dans « Mon profil » pour calculer votre charge alaire — un bon repère pour choisir sa taille de voile.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-2xl font-extrabold text-white leading-none">{chargeAlaire?.toFixed(2)}</span>
            <span className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>lb/ft²</span>
            {guideline && (
              <span className="text-[11px] mb-0.5 ml-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Repère ≤ {Number(guideline.charge_max_recommandee).toFixed(2)} · tranche {trancheLabel} ({sautsCount} sauts)
              </span>
            )}
          </div>

          {/* Jauge vert / orange / rouge */}
          <div className="relative rounded-full overflow-hidden mb-2" style={{ height: 8, background: 'linear-gradient(90deg, #10B981 0%, #10B981 62%, #F59E0B 75%, #EF4444 88%, #EF4444 100%)', opacity: 0.9 }}>
            <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: `${gaugePct}%`, boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} title="Votre charge alaire" />
          </div>

          {status === 'au_dela' && (
            <p className="text-xs leading-relaxed mb-1.5" style={{ color: '#FCA5A5' }}>
              Votre charge alaire dépasse le repère paramétré pour votre expérience — parlez-en avec un moniteur avant de descendre en taille de voile.
            </p>
          )}
          {status === 'proche_de_la_limite' && (
            <p className="text-xs leading-relaxed mb-1.5" style={{ color: '#FCD34D' }}>
              Vous approchez du repère paramétré pour votre expérience. Avant de descendre en taille, un échange avec un moniteur est une bonne idée.
            </p>
          )}
        </>
      )}

      {/* LE POIDS NE SE SAISIT PLUS ICI.
          Cette carte est affichée sur CHAQUE matériel : elle offrait donc
          autant de points de saisie que le sauteur a de sacs, pour une donnée
          qui n'en admet qu'un. C'était la cause du désordre — trois endroits
          écrivaient un poids sans se connaître. La saisie vit désormais dans
          « Mon profil », et cette carte se contente de ce qu'elle sait faire :
          calculer et expliquer. */}
      <div className="flex items-center gap-2 flex-wrap">
        <a href="/profil" className="text-xs font-medium underline underline-offset-2"
          style={{ color: 'rgba(147,197,253,0.9)' }}>
          {poidsKg != null
            ? `Poids équipé : ${poidsKg} kg — modifier dans Mon profil`
            : 'Renseigner mon poids dans Mon profil'}
        </a>
      </div>

      <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Formule : poids en livres ÷ surface en pieds carrés. La charge alaire influence la vitesse de vol et d'atterrissage de la voile :
        descendre en taille trop tôt est une cause fréquente d'accident. Repère consultatif — la décision se prend avec votre moniteur.
        Le poids se saisit une seule fois, dans « Mon profil ».
      </p>
    </div>
  );
}
