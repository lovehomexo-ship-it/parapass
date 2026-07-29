import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Certaines pages appellent useAuth() au rendu (contexte auth). On le stub pour
// tester le rendu déconnecté sans monter tout AuthProvider/Supabase.
vi.mock('../lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth')>();
  return {
    ...actual,
    useAuth: () => ({ user: null, profile: null, loading: false, signUp: async () => ({}) }),
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests « FUMÉE » — rendent réellement les pages publiques et vérifient qu'elles
// ne CRASHENT pas au rendu. C'est le filet manquant : tsc + eslint + vite build
// compilent le code mais ne rendent jamais l'arbre React, donc un composant
// `undefined` ou un élément rendu comme composant (React #130) n'apparaît qu'à
// l'exécution — exactement le bug qui a fait tomber la page d'accueil.
//
// renderToStaticMarkup fait UNE passe de rendu synchrone de TOUT l'arbre (toutes
// les listes, tous les <X.icon/>), donc un <undefined/> lève immédiatement ici.
// ═══════════════════════════════════════════════════════════════════════════

beforeAll(() => {
  // Certains hooks (reduced-motion, useInView) touchent ces API au montage.
  // Le rendu SSR n'exécute pas les effets, mais on stub par sécurité.
  const g = globalThis as unknown as Record<string, unknown>;
  g.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  g.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} };
});

const renders = (node: ReactElement) => () => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

import { LandingPage } from './Landing';
import { LoginPage } from './Login';
import { RegisterPage } from './Register';
import { InscriptionCentrePage } from './InscriptionCentre';
import { DemoPage } from './Demo';
import { DemoCentrePage } from './demo/DemoCentre';
import { DemoDashboardPage } from './demo/DemoDashboard';
import { MaintenancePage } from './MaintenancePage';
import { TandemPublicPage } from './TandemPublicPage';

// Chaque page publique (accessible sans authentification) doit se RENDRE sans
// planter. Ajouter ici toute nouvelle page publique.
const PAGES: [string, ReactElement][] = [
  ['LandingPage (accueil)', <LandingPage />],
  ['LoginPage', <LoginPage />],
  ['RegisterPage', <RegisterPage />],
  ['InscriptionCentrePage', <InscriptionCentrePage />],
  ['DemoPage', <DemoPage />],
  ['DemoCentrePage', <DemoCentrePage />],
  ['DemoDashboardPage', <DemoDashboardPage />],
  ['MaintenancePage', <MaintenancePage />],
  ['TandemPublicPage', <TandemPublicPage />],
];

describe('smoke : les pages publiques se rendent sans crash (React #130)', () => {
  it.each(PAGES)('%s se rend sans erreur', (_nom, node) => {
    expect(renders(node)).not.toThrow();
  });
});
