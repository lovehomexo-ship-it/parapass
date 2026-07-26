// ─── Carte de partage social (Prompt V2) ─────────────────────────────────────
// Modèle + rendu canvas d'une carte « affiche de sportif » générée à partir des
// données RÉELLES du carnet (source unique de vérité). Aucune donnée tierce,
// jamais le numéro de licence complet, pas de GPS — uniquement le nom de la DZ.

export type ShareVariant = 'badge' | 'volume' | 'progression';
export type ShareFormat = 'carre' | 'story';

export interface ShareInput {
  prenom: string;            // prénom ou pseudo choisi
  total: number;             // total de sauts (source unique)
  sautsDuJour: number;       // sauts enregistrés aujourd'hui
  elementsMaitrises: number; // éléments techniques maîtrisés
  elementsTotal: number;     // sur N
  centre: string | null;     // nom de la DZ / centre (jamais de GPS)
  dateLabel: string;         // date lisible (ex. « 24 juillet 2026 »)
  nouveauBadge?: string | null; // palier franchi, s'il y a lieu
}

export interface ShareToggles {
  showTotal: boolean;
  showProgression: boolean;
  showCentre: boolean;
}

export interface CardModel {
  variant: ShareVariant;
  heroNumber: string;   // le chiffre héros, lisible en vignette
  heroLabel: string;    // légende du héros
  title: string;        // ton fier, 1re personne
  prenom: string;
  detail: string | null;   // type/DZ/date condensés
  showTotal: boolean;
  total: number;
  showProgression: boolean;
  progressionLabel: string;
  showCentre: boolean;
  centre: string | null;
  badge: string | null;
}

/**
 * Construit le modèle d'affichage de la carte à partir des données réelles.
 * Ne recalcule aucun chiffre : total/éléments viennent déjà de la source unique.
 * Choisit la variante selon le contenu (badge > volume > progression) et
 * n'expose JAMAIS de donnée sensible (licence, GPS) ni tierce.
 */
export function buildCardModel(input: ShareInput, toggles: ShareToggles): CardModel {
  const { prenom, total, sautsDuJour, elementsMaitrises, elementsTotal, centre, dateLabel, nouveauBadge } = input;

  let variant: ShareVariant;
  let heroNumber: string;
  let heroLabel: string;
  let title: string;

  if (nouveauBadge) {
    variant = 'badge';
    heroNumber = '★';
    heroLabel = nouveauBadge;
    title = 'Nouveau palier atteint';
  } else if (sautsDuJour >= 2) {
    variant = 'volume';
    heroNumber = String(sautsDuJour);
    heroLabel = 'sauts aujourd’hui';
    title = 'Ma journée';
  } else if (sautsDuJour === 1) {
    variant = 'volume';
    heroNumber = '1';
    heroLabel = 'saut aujourd’hui';
    title = 'Ma journée';
  } else {
    variant = 'progression';
    heroNumber = String(total);
    heroLabel = 'sauts au total';
    title = 'Ma progression';
  }

  return {
    variant,
    heroNumber,
    heroLabel,
    title,
    prenom,
    detail: [centre, dateLabel].filter(Boolean).join(' · ') || null,
    showTotal: toggles.showTotal,
    total,
    showProgression: toggles.showProgression,
    progressionLabel: `${elementsMaitrises}/${elementsTotal} éléments maîtrisés`,
    showCentre: toggles.showCentre,
    centre: toggles.showCentre ? centre : null,
    badge: nouveauBadge ?? null,
  };
}

export const CARD_DIMENSIONS: Record<ShareFormat, { w: number; h: number; safeTop: number; safeBottom: number }> = {
  // Zones de sécurité story : marges haut/bas pour ne pas passer sous les UI Insta/Snap.
  carre: { w: 1080, h: 1080, safeTop: 60, safeBottom: 60 },
  story: { w: 1080, h: 1920, safeTop: 250, safeBottom: 320 },
};

const NUIT = '#001A4D';
const NUIT2 = '#0A2A5E';
const ORANGE = '#F97316';

/** Charge une image (photo perso) depuis un fichier. Le passage par canvas au
 *  rendu retire naturellement les métadonnées EXIF/GPS. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Rend la carte sur un canvas et renvoie un blob PNG haute résolution.
 * Si `photo` est fournie, elle est utilisée en fond héros avec un voile sombre ;
 * sinon fond ParaPass dégradé. Génération 100 % client.
 */
export async function generateShareCard(
  model: CardModel,
  format: ShareFormat,
  photo?: HTMLImageElement | null,
): Promise<Blob> {
  const dim = CARD_DIMENSIONS[format];
  const canvas = document.createElement('canvas');
  canvas.width = dim.w;
  canvas.height = dim.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non supporté sur cet appareil.');

  // Fond
  if (photo) {
    // couvrir (cover) + voile dégradé sombre pour lisibilité du texte
    const scale = Math.max(dim.w / photo.width, dim.h / photo.height);
    const pw = photo.width * scale, ph = photo.height * scale;
    ctx.drawImage(photo, (dim.w - pw) / 2, (dim.h - ph) / 2, pw, ph);
    const veil = ctx.createLinearGradient(0, 0, 0, dim.h);
    veil.addColorStop(0, 'rgba(0,10,35,0.55)');
    veil.addColorStop(0.55, 'rgba(0,10,35,0.35)');
    veil.addColorStop(1, 'rgba(0,10,35,0.92)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, dim.w, dim.h);
  } else {
    const g = ctx.createLinearGradient(0, 0, dim.w, dim.h);
    g.addColorStop(0, NUIT);
    g.addColorStop(1, NUIT2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dim.w, dim.h);
  }

  const cx = dim.w / 2;
  const contentTop = dim.safeTop;
  const contentBottom = dim.h - dim.safeBottom;
  ctx.textAlign = 'center';

  // Titre (ton fier)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 46px Inter, sans-serif';
  ctx.fillText(model.title, cx, contentTop + 90);

  // Prénom / pseudo
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 64px Inter, sans-serif';
  ctx.fillText(model.prenom, cx, contentTop + 165);

  // Chiffre héros (orange, très gros — lisible en vignette)
  const heroY = format === 'story' ? dim.h * 0.42 : dim.h * 0.46;
  ctx.fillStyle = ORANGE;
  ctx.font = '900 320px Inter, sans-serif';
  ctx.fillText(model.heroNumber, cx, heroY);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 52px Inter, sans-serif';
  ctx.fillText(model.heroLabel, cx, heroY + 90);

  // Détail (DZ · date)
  let y = heroY + 190;
  if (model.detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '500 40px Inter, sans-serif';
    ctx.fillText(model.detail, cx, y);
    y += 80;
  }

  // Blocs optionnels (choisis par le parachutiste)
  const chips: string[] = [];
  if (model.showTotal) chips.push(`${model.total} sauts au total`);
  if (model.showProgression) chips.push(model.progressionLabel);
  if (chips.length) {
    ctx.font = '600 38px Inter, sans-serif';
    for (const chip of chips) {
      const tw = ctx.measureText(chip).width;
      const pad = 34, bw = tw + pad * 2, bh = 72, bx = cx - bw / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(ctx, bx, y, bw, bh, 36);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(chip, cx, y + 48);
      y += bh + 22;
    }
  }

  // Signature ParaPass discrète + CTA
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '700 34px Inter, sans-serif';
  ctx.fillText('ParaPass.fr · mon carnet de sauts', cx, contentBottom - 20);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Génération de l’image échouée.')), 'image/png');
  });
}
