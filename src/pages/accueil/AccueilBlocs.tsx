import { Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, ChevronRight, QrCode, Star } from 'lucide-react';
import type { Saut, BadgeDefinition } from '../../lib/types';
import { NATURE_SAUT_LABELS } from '../../lib/types';
import { BadgeIcon } from '../../design/BadgeIcon';

// ═══════════════════════════════════════════════════════════════════════════
// L'ACCUEIL DU PARACHUTISTE — ses blocs.
//
// L'ancien accueil faisait 4,8 écrans et disait cinq fois « vous êtes en
// règle » : bandeau, carte, verso, deux tuiles, en-tête du menu. Celui-ci tient
// en cinq blocs, chacun dit UNE chose, une seule fois :
//   1. qui je suis et si je suis en règle      → EnTeteAccueil (une pastille)
//   2. ce qui se passe à la DZ aujourd'hui     → assemblé par la page
//   3. ma licence, à montrer                   → CarteWallet
//   4. où en est mon carnet                    → CarteCarnet
//   5. où j'en suis                            → CarteProgression
// Rien n'est perdu : chaque bloc mène à l'écran qui détaille.
// ═══════════════════════════════════════════════════════════════════════════

export type StatutDocs = 'valide' | 'expire_bientot' | 'expire' | null;

const ETAT: Record<'valide' | 'expire_bientot' | 'expire' | 'inconnu', { libelle: string; couleur: string; Icone: typeof ShieldCheck }> = {
  valide:         { libelle: 'En règle',            couleur: 'var(--sev-conforme)',  Icone: ShieldCheck },
  expire_bientot: { libelle: 'Document à renouveler', couleur: 'var(--sev-vigilance)', Icone: AlertTriangle },
  expire:         { libelle: 'Document expiré',      couleur: 'var(--sev-critique)',  Icone: AlertTriangle },
  inconnu:        { libelle: 'Dossier à compléter',  couleur: 'var(--sev-neutre)',    Icone: AlertTriangle },
};

const carte = { background: 'var(--c-card)', border: '1px solid var(--c-border)' } as const;

/** « Bonjour Alexandre » + la seule pastille d'état de l'écran. */
export function EnTeteAccueil({ prenom, statutDocs }: { prenom: string | null | undefined; statutDocs: StatutDocs }) {
  const e = ETAT[statutDocs ?? 'inconnu'];
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return (
    <header className="mb-5">
      {/* La pastille sur la ligne de la date : le prénom garde toute la
          largeur et n'est jamais coupé (« Bonjour Alexan… »). */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold capitalize" style={{ color: 'var(--c-muted)' }}>{date}</p>
        {/* La pastille mène au passeport : c'est là qu'on renouvelle. */}
        <Link to="/passeport" className="no-underline inline-flex items-center gap-1.5 rounded-full px-3 text-[13px] font-bold flex-shrink-0"
          style={{ minHeight: 32, color: e.couleur, background: `color-mix(in srgb, ${e.couleur} 14%, transparent)` }}>
          <e.Icone className="w-4 h-4" aria-hidden /> {e.libelle}
        </Link>
      </div>
      <h1 className="text-[28px] leading-tight font-extrabold mt-1" style={{ color: 'var(--c-text)', letterSpacing: '-0.01em' }}>
        Bonjour{prenom ? ` ${prenom}` : ''}
      </h1>
    </header>
  );
}

/** Un titre de bloc, discret : il range, il ne crie pas. */
export function TitreBloc({ children, lien, libelleLien = 'Tout voir' }: { children: React.ReactNode; lien?: string; libelleLien?: string }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-6">
      <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-muted)', letterSpacing: '0.06em' }}>{children}</h2>
      {lien && (
        <Link to={lien} className="no-underline inline-flex items-center gap-0.5 text-[13px] font-semibold" style={{ color: 'var(--accent-texte)', minHeight: 32 }}>
          {libelleLien} <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

const frDate = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString('fr-FR') : null;

/**
 * LA LICENCE, FAÇON WALLET. Une carte de la taille d'une carte, pas 984 px de
 * carte, de tuiles et de boutons : nom, brevet, sauts, échéances. Un toucher
 * ouvre le passeport complet ; le bouton QR, le code à présenter.
 */
export function CarteWallet({ prenom, nom, photo, brevet, totalSauts, licenceFin, medicalFin, statutDocs }: {
  prenom: string; nom: string; photo: string | null | undefined; brevet: string | null;
  totalSauts: number; licenceFin: string | null; medicalFin: string | null; statutDocs: StatutDocs;
}) {
  const actif = statutDocs === 'valide' || statutDocs === 'expire_bientot';
  return (
    <div className="relative">
      {/* La carte garde ses couleurs dans les deux thèmes : c'est un objet,
          comme une carte bancaire dans Wallet, pas une surface de l'écran. */}
      <Link to="/passeport" aria-label="Ouvrir mon passeport"
        className="no-underline block rounded-[20px] p-4 pr-16 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B2A5B 0%, #123F86 100%)', color: '#fff', minHeight: 156,
                 boxShadow: '0 6px 20px rgba(11,42,91,0.28)', borderTop: '3px solid #F97316' }}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold" style={{ color: '#FDBA74' }}>Licence FFP</span>
          <span className="text-xs font-extrabold rounded-full px-2" style={{ lineHeight: '22px',
            background: actif ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.22)', color: actif ? '#6EE7B7' : '#FCA5A5' }}>
            {actif ? 'ACTIVE' : 'À RÉGULARISER'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          {photo
            ? <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid rgba(255,255,255,0.35)' }} />
            : <span className="w-12 h-12 rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                {(prenom[0] ?? '') + (nom[0] ?? '')}
              </span>}
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight truncate">{nom.toUpperCase()} {prenom}</p>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {brevet ? `Brevet ${brevet}` : 'Sans brevet'} · {totalSauts.toLocaleString('fr-FR')} saut{totalSauts > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <p className="text-[13px] mt-3" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Licence {frDate(licenceFin) ?? '—'} · Médical {frDate(medicalFin) ?? '—'}
        </p>
      </Link>
      <Link to="/qr-code" aria-label="Afficher mon QR code"
        className="no-underline absolute top-1/2 -translate-y-1/2 right-3 w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: '#fff', color: '#0B2A5B' }}>
        <QrCode className="w-6 h-6" aria-hidden />
      </Link>
    </div>
  );
}

function ilYa(iso: string | null): string | null {
  if (!iso) return null;
  const j = Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 864e5);
  if (j <= 0) return 'aujourd’hui';
  if (j === 1) return 'hier';
  if (j < 31) return `il y a ${j} jours`;
  const m = Math.round(j / 30.4);
  return m < 12 ? `il y a ${m} mois` : `il y a ${Math.round(m / 12)} an${m >= 18 ? 's' : ''}`;
}

/** Mon carnet en une ligne, puis les trois derniers sauts. */
export function CarteCarnet({ total, cetteAnnee, derniers, numeros, onOuvrir, onSaut }: {
  total: number; cetteAnnee: number; derniers: Saut[]; numeros: Record<string, number>;
  onOuvrir: () => void; onSaut: (s: Saut) => void;
}) {
  const dernier = derniers.find(s => !s.is_tunnel) ?? null;
  return (
    <div className="rounded-2xl overflow-hidden" style={carte}>
      <button type="button" onClick={onOuvrir} className="w-full text-left px-4 pt-4 pb-3 flex items-end justify-between gap-3">
        <span>
          <span className="block text-[28px] font-extrabold leading-none tabular-nums" style={{ color: 'var(--c-text)' }}>
            {total.toLocaleString('fr-FR')} <span className="text-[15px] font-semibold" style={{ color: 'var(--c-muted)' }}>saut{total > 1 ? 's' : ''}</span>
          </span>
          <span className="block text-[13px] mt-1" style={{ color: 'var(--c-muted)' }}>
            {cetteAnnee} cette année{dernier ? ` · dernier ${ilYa(dernier.date_saut)}` : ''}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />
      </button>
      {derniers.slice(0, 3).map(s => (
        <button key={s.id} type="button" onClick={() => onSaut(s)}
          className="w-full text-left flex items-center gap-3 px-4 py-2.5" style={{ borderTop: '1px solid var(--c-border-s)', minHeight: 52 }}>
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 tabular-nums"
            style={{ background: 'color-mix(in srgb, var(--accent-texte) 14%, transparent)', color: 'var(--accent-texte)' }}>
            {numeros[s.id] ?? '—'}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{s.lieu}</span>
            <span className="block text-[13px] truncate" style={{ color: 'var(--c-muted)' }}>
              {new Date(s.date_saut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              {s.is_tunnel ? ' · soufflerie' : ` · ${s.hauteur_m.toLocaleString('fr-FR')} m · ${NATURE_SAUT_LABELS[s.nature_saut] ?? s.nature_saut}`}
            </span>
          </span>
          {s.statut === 'en_attente' && (
            <span className="text-xs font-semibold rounded-full px-2 flex-shrink-0" style={{ lineHeight: '22px', color: 'var(--accent-texte)', background: 'color-mix(in srgb, var(--accent-texte) 12%, transparent)' }}>
              à valider
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Où j'en suis : un saut à évaluer, le prochain palier, le dernier badge. */
export function CarteProgression({ aEvaluer, onEvaluer, palier, sautsValides, dernierBadge, nbBadges }: {
  aEvaluer: number; onEvaluer: () => void;
  palier: number | null; sautsValides: number;
  dernierBadge: BadgeDefinition | null; nbBadges: number;
}) {
  return (
    <div className="rounded-2xl" style={carte}>
      {aEvaluer > 0 && (
        <div className="flex items-center gap-3 px-4 py-3">
          <Star className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-texte)' }} aria-hidden />
          <span className="flex-1 min-w-0 text-sm" style={{ color: 'var(--c-text)' }}>
            <strong>{aEvaluer} saut{aEvaluer > 1 ? 's' : ''} à évaluer</strong>
            <span className="block text-[13px]" style={{ color: 'var(--c-muted)' }}>Ta courbe de progression s'en nourrit</span>
          </span>
          <button type="button" onClick={onEvaluer} className="rounded-xl px-3 text-sm font-bold text-white flex-shrink-0"
            style={{ minHeight: 40, background: 'var(--accent-fond)' }}>Évaluer</button>
        </div>
      )}
      {palier && (
        <Link to="/progression" className="no-underline block px-4 py-3" style={{ borderTop: aEvaluer > 0 ? '1px solid var(--c-border-s)' : undefined }}>
          <span className="flex items-baseline justify-between gap-2 text-sm" style={{ color: 'var(--c-text)' }}>
            <span>Prochain palier : <strong>{palier.toLocaleString('fr-FR')} sauts</strong></span>
            <span className="text-[13px]" style={{ color: 'var(--c-muted)' }}>encore {Math.max(0, palier - sautsValides)}</span>
          </span>
          <span className="block h-2 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--c-hover)' }}>
            <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (sautsValides / palier) * 100)}%`, background: 'var(--accent-texte)' }} />
          </span>
        </Link>
      )}
      <Link to="/badges" className="no-underline flex items-center gap-3 px-4 py-3" style={{ borderTop: (aEvaluer > 0 || palier) ? '1px solid var(--c-border-s)' : undefined, minHeight: 52 }}>
        {dernierBadge
          ? <BadgeIcon type={dernierBadge.type} nom={dernierBadge.nom} couleur={dernierBadge.couleur} className="w-8 h-8 flex-shrink-0" />
          : <Star className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />}
        <span className="flex-1 min-w-0 text-sm" style={{ color: 'var(--c-text)' }}>
          {dernierBadge ? <>Dernier badge : <strong>{dernierBadge.nom}</strong></> : 'Ton premier badge t’attend'}
          <span className="block text-[13px]" style={{ color: 'var(--c-muted)' }}>{nbBadges} badge{nbBadges > 1 ? 's' : ''} obtenu{nbBadges > 1 ? 's' : ''}</span>
        </span>
        <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-dim)' }} aria-hidden />
      </Link>
    </div>
  );
}
