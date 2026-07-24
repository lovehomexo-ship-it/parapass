import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Fuseau non-UTC à offset positif : c'est précisément le cas où l'ancien
    // `toISOString()` décalait les dates d'un jour (bug Planning DZ). Les tests
    // de fuseau (Prompt C) restent valables car formatHeureParis force Europe/Paris.
    env: { TZ: 'Europe/Paris' },
    include: ['src/**/*.test.ts'],
  },
});
