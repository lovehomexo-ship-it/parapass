# ParaPass — Instructions Claude

## Règles de fin de session — OBLIGATOIRES

1. Avant tout push : `npm run build` doit passer sans erreur. Jamais de push avec un build cassé.
2. À la fin de CHAQUE session de travail : `git add -A`, commit avec un message clair, `git push origin main`. Ne jamais terminer une session avec des modifications non commitées.
3. Après le push, rappeler de vérifier le déploiement Vercel (statut Ready) et de faire un hard refresh sur parapass.fr.
4. Ne JAMAIS afficher un secret (clé privée, token, mot de passe) dans le terminal ou une réponse. Les secrets se manipulent via des fichiers temporaires supprimés après usage.

## Anti-régression — leçon du crash home (React #130, 2026-07)

**`npm run build` (tsc + eslint + vite build) ne garantit PAS que l'app fonctionne.**
Il compile le code mais ne REND jamais l'arbre React. Un composant `undefined`
(champ de données supprimé, import cassé) ou un élément JSX rendu comme composant
(`<x.icon/>` où `x.icon` est `<Icon/>`) ne se voit qu'à l'exécution → React #130,
qui fait tomber toute la page. C'est exactement ce qui a cassé la page d'accueil.

### ⚠️ Cause racine : le typage ne tourne PAS dans `npm run build`

`tsconfig.json` est un fichier « solution style » (`{ "files": [], "references": [...] }`).
Or le script build lance `tsc --noEmit` **sans `-p`** → il lit `tsconfig.json`,
y trouve `files: []` et vérifie **0 fichier**. Mesuré :

| Commande | Fichiers vérifiés |
|---|---|
| `tsc --noEmit` (script `build`/`check`) | **0** |
| `npm run typecheck` (`-p tsconfig.app.json`) | **165** |

Avec le bon projet, TypeScript attrapait précisément le bug :
`src/pages/Landing.tsx(440,65): error TS2339: Property 'icon' does not exist on type 'Module'.`

**Conséquence** : ~113 erreurs de type préexistantes se sont accumulées en silence.
**→ Lancer `npm run typecheck` avant tout push.** Le brancher sur `build` seulement
quand les erreurs seront à zéro (chantier progressif, sinon le build casse).

Règles :
1. **« build vert » ≠ « ça marche ».** Après un gros refactor (surtout des
   remplacements scriptés multi-fichiers), CHARGER réellement les écrans modifiés
   (preview / `npm run dev`) ou lancer les tests fumée avant de conclure.
2. **Tests fumée obligatoires** — ils rendent réellement les écrans et attrapent les #130 :
   - `src/pages/pages.smoke.test.tsx` → 9 pages **publiques**
   - `src/pages/pages-privees.smoke.test.tsx` → écrans **privés** (Dashboard para,
     Dashboard DZ, Passeport), contextes stubés (auth/démo/thème/alertes)
   Toute nouvelle page importante doit y être ajoutée.
3. **Refactors scriptés (sed/python)** : à double tranchant. Vérifier chaque
   remplacement générique (`<X.icon/>` ne vaut que si `X.icon` est une RÉFÉRENCE de
   composant, pas un élément ni un champ supprimé).
4. Après un push, si possible **vérifier le rendu sur le déploiement**, pas seulement
   le statut « Ready ».
