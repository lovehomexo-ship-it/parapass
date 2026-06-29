import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Alerte } from './types';
import { loadAcquittees, saveAcquittees } from '../components/AlertsPanel';

export type StatutDocs = 'valide' | 'expire_bientot' | 'expire' | null;

interface AlertesCtx {
  alertes: Alerte[];
  acquittees: string[];
  setAlertes: (a: Alerte[]) => void;
  acquitterAlertes: (ids: string[]) => void;
  statutDocs: StatutDocs;
  setStatutDocs: (s: StatutDocs) => void;
  licenceExpiration: string | null;
  setLicenceExpiration: (d: string | null) => void;
  certifExpiration: string | null;
  setCertifExpiration: (d: string | null) => void;
}

const Ctx = createContext<AlertesCtx>({
  alertes: [],
  acquittees: [],
  setAlertes: () => {},
  acquitterAlertes: () => {},
  statutDocs: null,
  setStatutDocs: () => {},
  licenceExpiration: null,
  setLicenceExpiration: () => {},
  certifExpiration: null,
  setCertifExpiration: () => {},
});

export function AlertesProvider({ children }: { children: ReactNode }) {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [acquittees, setAcquittees] = useState<string[]>(() => loadAcquittees());
  const [statutDocs, setStatutDocs] = useState<StatutDocs>(null);
  const [licenceExpiration, setLicenceExpiration] = useState<string | null>(null);
  const [certifExpiration, setCertifExpiration] = useState<string | null>(null);

  const acquitterAlertes = (ids: string[]) => {
    const nouvelles = [...new Set([...acquittees, ...ids])];
    setAcquittees(nouvelles);
    saveAcquittees(nouvelles);
  };

  return (
    <Ctx.Provider value={{ alertes, acquittees, setAlertes, acquitterAlertes, statutDocs, setStatutDocs, licenceExpiration, setLicenceExpiration, certifExpiration, setCertifExpiration }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAlertesContext() {
  return useContext(Ctx);
}
