import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// Tests « FUMÉE » — écrans PRIVÉS (connectés). Même objectif que les pages
// publiques : garantir qu'ils se RENDENT sans crash (React #130 : composant
// undefined, élément rendu comme composant…). Ce sont les écrans utilisés en
// présentation DZ — un crash y est tout aussi bloquant.
//
// Les contextes (auth, démo, thème, alertes) sont stubés : on teste le RENDU,
// pas les données. renderToStaticMarkup n'exécute pas les effets, donc aucun
// appel réseau n'est déclenché.
// ═══════════════════════════════════════════════════════════════════════════

vi.mock('../lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth')>();
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'smoke-user', email: 'smoke@parapass.test' },
      profile: {
        id: 'smoke-user', prenom: 'Smoke', nom: 'TEST', email: 'smoke@parapass.test',
        role: 'parachutiste', numero_licence: 'FFP-TEST', admin_centre_id: null,
      },
      loading: false,
      signOut: async () => {},
      signUp: async () => ({}),
    }),
  };
});

vi.mock('../lib/useDemo', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useDemo: () => ({ isDemo: false, blockIfDemo: () => false }) };
});

vi.mock('../lib/ThemeContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useTheme: () => ({ theme: 'dark', toggleTheme: () => {} }) };
});

vi.mock('../lib/AlertesContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAlertesContext: () => ({
      alertes: [], acquittees: [], acquitterAlertes: () => {}, setAlertes: () => {},
      statutDocs: 'valide', setStatutDocs: () => {},
      licenceExpiration: null, setLicenceExpiration: () => {},
      certifExpiration: null, setCertifExpiration: () => {},
    }),
  };
});

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  g.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} };
  // Environnement node : pas de storage navigateur (lu au 1er rendu par certains écrans).
  const memStore = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null, length: 0,
    };
  };
  g.localStorage ??= memStore();
  g.sessionStorage ??= memStore();
});

const renders = (node: ReactElement) => () => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

import { DashboardPage } from './Dashboard';
import { CentreDashboardPage } from './CentreDashboard';
import { PasseportPage } from './Passeport';

// Ajouter ici tout nouvel écran privé important.
const PAGES: [string, ReactElement][] = [
  ['DashboardPage (parachutiste)', <DashboardPage />],
  ['CentreDashboardPage (DZ)', <CentreDashboardPage />],
  ['PasseportPage', <PasseportPage />],
];

describe('smoke : les écrans privés se rendent sans crash (React #130)', () => {
  it.each(PAGES)('%s se rend sans erreur', (_nom, node) => {
    expect(renders(node)).not.toThrow();
  });
});
