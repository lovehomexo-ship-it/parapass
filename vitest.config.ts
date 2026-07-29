import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Runtime JSX automatique (comme l'app) pour que les tests .tsx n'aient pas
  // besoin d'importer React explicitement.
  esbuild: { jsx: 'automatic' },
  test: {
    // Fuseau non-UTC à offset positif : c'est précisément le cas où l'ancien
    // `toISOString()` décalait les dates d'un jour (bug Planning DZ). Les tests
    // de fuseau (Prompt C) restent valables car formatHeureParis force Europe/Paris.
    env: { TZ: 'Europe/Paris' },
    // .tsx inclus pour les tests « fumée » qui RENDENT les pages (react-dom/server) :
    // ils attrapent les crashs de rendu (React #130 : composant undefined / élément
    // rendu comme composant) que tsc + eslint + vite build ne voient pas.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
