import { Layout } from '../components/Layout';
import { useAuth } from '../lib/auth';
import { usePassport } from '../lib/usePassport';
import { Shield, Wind, Mountain } from 'lucide-react';
import { REGLES_PAR_BREVET } from '../data/reglesFFP';

const HAUTEUR_ROWS = [
  { label: 'Élève PAC', brevets: ['PAC'], hauteur: 1500 },
  { label: 'BPA / Brevet A', brevets: ['BPA', 'A'], hauteur: 1200 },
  { label: 'Brevet B', brevets: ['B'], hauteur: 1000 },
  { label: 'Brevets C et D', brevets: ['C', 'D'], hauteur: 800 },
];

const VENT_ROWS = [
  { label: 'Avant brevet A (PAC / élève)', brevets: ['PAC'], vent: 7 },
  { label: 'Brevet A / BPA', brevets: ['A', 'BPA'], vent: 7 },
  { label: 'Brevet B et C', brevets: ['B', 'C'], vent: 11 },
  { label: 'Brevet D', brevets: ['D'], vent: 14 },
];

function RulesTable({ title, icon, rows, userBrevet, valueKey, unit }: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; brevets: string[]; [key: string]: unknown }[];
  userBrevet: string | null;
  valueKey: string;
  unit: string;
}) {
  const activeRow = rows.find((r) => r.brevets.includes(userBrevet ?? '')) ?? null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-[#001A4D]">
        <div className="text-white">{icon}</div>
        <p className="text-white font-semibold text-sm">{title}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map((row) => {
          const isActive = activeRow === row;
          return (
            <div
              key={row.label as string}
              className={`flex items-center justify-between px-4 py-3 ${isActive ? 'bg-amber-50' : ''}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm ${isActive ? 'font-semibold text-amber-800' : 'text-gray-600'}`}>
                  {row.label as string}
                </p>
                {isActive && (
                  <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                    Votre niveau
                  </span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-lg font-bold ${isActive ? 'text-amber-700' : 'text-[#001A4D]'}`}>
                  {(row[valueKey] as number).toLocaleString('fr-FR')}
                </span>
                <span className={`ml-1 text-xs ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>{unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReglesFFPPage() {
  const { user } = useAuth();
  const { brevets } = usePassport(user?.id);
  const brevetPrincipal = brevets.find((b) => Object.keys(REGLES_PAR_BREVET).includes(b.type_brevet))?.type_brevet ?? null;
  const regles = brevetPrincipal ? REGLES_PAR_BREVET[brevetPrincipal] : null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#001A4D]">Règles de sécurité FFP</h1>
          <p className="text-sm text-gray-500 mt-1">Reproduites depuis la page 3 du carnet de sauts officiel FFP</p>
        </div>

        {brevetPrincipal && regles && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-700">
                Votre brevet actuel : <span className="font-bold">{regles.label}</span> — les règles applicables sont mises en évidence.
              </p>
              <p className="text-xs text-blue-500 mt-0.5">
                Ouverture min : {regles.hauteurOuvertureMin.toLocaleString('fr-FR')} m · Vent max : {regles.ventMaxSol} m/s
              </p>
            </div>
          </div>
        )}

        <RulesTable
          title="Hauteur minimale d'ouverture"
          icon={<Mountain className="w-5 h-5" />}
          rows={HAUTEUR_ROWS}
          userBrevet={brevetPrincipal}
          valueKey="hauteur"
          unit="m min"
        />

        <RulesTable
          title="Limite maximale de vent au sol"
          icon={<Wind className="w-5 h-5" />}
          rows={VENT_ROWS}
          userBrevet={brevetPrincipal}
          valueKey="vent"
          unit="m/s max"
        />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-[#001A4D]">
            <p className="text-white font-semibold text-sm">Rappels réglementaires</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { titre: 'Certificat médical', texte: 'Obligatoire en cours de validité avant tout saut. Un certificat expiré interdit la pratique.' },
              { titre: 'Licence FFP', texte: 'La licence doit être valide et comporter les assurances individuelle et RC.' },
              { titre: 'Visite médicale annuelle', texte: 'La visite médicale doit être effectuée chaque année avant la saison.' },
              { titre: 'Équipement homologué', texte: 'Tout équipement doit être homologué DGAC et révisé selon les échéances réglementaires.' },
              { titre: 'Conditions météo', texte: "La pratique est soumise à l'appréciation du DT et aux conditions météorologiques adaptées." },
            ].map((item) => (
              <div key={item.titre} className="border-l-2 border-[#001A4D]/20 pl-3">
                <p className="text-sm font-semibold text-[#001A4D]">{item.titre}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.texte}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-gray-400 text-center">
          Source : Carnet de sauts FFP officiel, page 3 — Règlement intérieur de la Fédération Française de Parachutisme
        </p>
      </div>
    </Layout>
  );
}
