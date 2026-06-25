import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Alerte } from './types';
import { loadAcquittees, saveAcquittees } from '../components/AlertsPanel';

interface AlertesCtx {
  alertes: Alerte[];
  acquittees: string[];
  setAlertes: (a: Alerte[]) => void;
  acquitterAlertes: (ids: string[]) => void;
}

const Ctx = createContext<AlertesCtx>({
  alertes: [],
  acquittees: [],
  setAlertes: () => {},
  acquitterAlertes: () => {},
});

export function AlertesProvider({ children }: { children: ReactNode }) {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [acquittees, setAcquittees] = useState<string[]>(() => loadAcquittees());

  const acquitterAlertes = (ids: string[]) => {
    const nouvelles = [...new Set([...acquittees, ...ids])];
    setAcquittees(nouvelles);
    saveAcquittees(nouvelles);
  };

  return (
    <Ctx.Provider value={{ alertes, acquittees, setAlertes, acquitterAlertes }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAlertesContext() {
  return useContext(Ctx);
}
