# Système de design ParaPass

Source unique de vérité visuelle. **Tout nouvel écran pioche ici** au lieu de
redéfinir ses couleurs/espacements/composants. Ce dossier ne contient aucune
logique métier — uniquement la fondation visuelle.

> Statut : **fondation posée, pas encore rebranchée** sur les écrans existants.
> Le rebranding écran par écran fait l'objet de prompts séparés — donc aucune
> régression : les écrans actuels continuent de fonctionner à l'identique.

## Où est quoi

- `tokens.ts` — couleurs, statuts, échelle d'espacement, règle de couleur des chiffres.
- `icons.ts` — famille d'icônes unique (Lucide) + `iconeMeteo(code)`.
- `../components/ui/` — composants partagés (`Button`, `Card`/`SectionCard`, `StatCard`, `StatusBadge`, `EmptyState`).

## Couleurs (tokens)

Import : `import { color, statusSoft } from '../design/tokens'`.

- **Surfaces** : `bg`, `surface`, `surfaceElevated`, `hover` → variables CSS thème-aware (clair/sombre gérés seuls).
- **Texte** : `textPrimary`, `textSecondary`, `textTertiary`, `textDim`.
- **Action** : `action` (orange ParaPass) — **une seule** couleur d'action, réservée aux CTA primaires et éléments héros. Variantes douces : `actionSoftBg`, `actionSoftBorder`.
- **Statuts** (réservés à leur sens, jamais décoratifs) : `ok` (vert), `warn` (ambre), `danger` (rouge), `neutral`. Fond+bordure adoucis via `statusSoft.{ok|warn|danger|neutral}`.
- **Bordures** : `border`, `borderStrong`, `separator`.

Aucune couleur de ce système ne doit être écrite en dur ailleurs.

## Règle de couleur des chiffres

`numberColor(kind)` — chaque grand chiffre porte **une** nature → **une** couleur :

- `actionnable` → action (orange). Ex. « 21 carnets à valider ».
- `conforme` → ok (vert). Ex. « 15 licences à jour ».
- `alerte` → warn (ambre). Ex. « 2 certificats expirants ».
- `danger` → danger (rouge). Ex. « 1 licence expirée ».
- `informatif` → texte primaire (neutre). Ex. « 12 sauts aujourd'hui ».

Pas de couleur décorative hors de cette règle (ni violet, ni cyan, etc.).

## Icônes

`import { icons, iconeMeteo } from '../design/icons'`. Une seule famille
vectorielle, monochrome (`currentColor`), teintée par son contexte. **Aucun
emoji système** comme icône. `icons.<usage>` couvre sauts, badges, validation,
présence, météo, etc. La météo passe par `iconeMeteo(code)` (code WMO Open-Meteo).

## Espacement

`import { space, layout } from '../design/tokens'`. Échelle en multiples de 4 px
(`space.xs=4 … space['3xl']=48`).

Règle de rythme : **plus d'espace entre grandes zones qu'entre cartes d'une même
zone** — `layout.zoneGap` (32) entre zones, `layout.cardGap` (12) entre cartes,
`layout.cardPadding` (16) en marge interne, `layout.radius` (16) pour l'arrondi.

## Composants partagés

`import { Button, Card, SectionCard, StatCard, StatusBadge, EmptyState } from '../components/ui'`.

- **Button** — `variant="primary" | "secondary"`. Un seul primaire (orange plein) par écran ; le reste en secondaire.
- **Card** / **SectionCard** — surface homogène ; `SectionCard` ajoute un surtitre + une action (« Voir tout »).
- **StatCard** — libellé + grand chiffre (couleur imposée par `kind`) + sous-texte.
- **StatusBadge** — `status="ok|warn|danger|neutral"`.
- **EmptyState** — libellé explicite paramétrable, **jamais un tiret**.

Ces composants sont purement présentiels : compatibles ErrorBoundary, mobile-first,
sans état ni accès données.
