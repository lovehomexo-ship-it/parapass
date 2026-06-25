import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Users, TrendingUp, Calendar, Eye, Stamp, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { ParachuteIcon } from '../components/ParachuteIcon';
import { useNavigate, Link } from 'react-router-dom';

interface ParachutisteInfo {
  id: string;
  nom: string;
  prenom: string;
  numero_licence: string;
  email: string;
  totalSauts: number;
  sautsCetteAnnee: number;
  dernierSaut: string | null;
}

interface MoniteurInfo {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  numero_brevet_moniteur: string | null;
  type_brevet_moniteur: string | null;
  moniteur_valide_par_dt: boolean;
  moniteur_valide_le: string | null;
}

export function AdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [parachutistes, setParachutistes] = useState<ParachutisteInfo[]>([]);
  const [moniteurs, setMoniteurs] = useState<MoniteurInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'parachutistes' | 'moniteurs'>('parachutistes');

  const fetchData = useCallback(async () => {
    if (!profile?.centre_id) { setLoading(false); return; }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, nom, prenom, numero_licence, email, role, numero_brevet_moniteur, type_brevet_moniteur, moniteur_valide_par_dt, moniteur_valide_le')
      .eq('centre_id', profile.centre_id);

    if (!profilesData) { setLoading(false); return; }

    const paras = profilesData.filter((p) => p.role === 'parachutiste');
    const mons = profilesData.filter((p) => p.role === 'moniteur') as (typeof profilesData[0] & {
      numero_brevet_moniteur?: string | null;
      type_brevet_moniteur?: string | null;
      moniteur_valide_par_dt?: boolean;
      moniteur_valide_le?: string | null;
    })[];

    const parasWithStats = await Promise.all(
      paras.map(async (p) => {
        const { count: total } = await supabase
          .from('sauts')
          .select('*', { count: 'exact', head: true })
          .eq('parachutiste_id', p.id);

        const { count: thisYear } = await supabase
          .from('sauts')
          .select('*', { count: 'exact', head: true })
          .eq('parachutiste_id', p.id)
          .gte('date_saut', `${new Date().getFullYear()}-01-01`);

        const { data: lastSaut } = await supabase
          .from('sauts')
          .select('date_saut')
          .eq('parachutiste_id', p.id)
          .order('date_saut', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: p.id,
          nom: p.nom,
          prenom: p.prenom,
          numero_licence: p.numero_licence,
          email: p.email,
          totalSauts: total || 0,
          sautsCetteAnnee: thisYear || 0,
          dernierSaut: lastSaut?.date_saut ?? null,
        };
      })
    );

    setParachutistes(parasWithStats);
    setMoniteurs(mons.map((m) => ({
      id: m.id,
      nom: m.nom,
      prenom: m.prenom,
      email: m.email,
      numero_brevet_moniteur: m.numero_brevet_moniteur ?? null,
      type_brevet_moniteur: m.type_brevet_moniteur ?? null,
      moniteur_valide_par_dt: m.moniteur_valide_par_dt ?? false,
      moniteur_valide_le: m.moniteur_valide_le ?? null,
    })));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSautsMois = parachutistes.reduce((sum, p) => sum + p.sautsCetteAnnee, 0);
  const totalSauts = parachutistes.reduce((sum, p) => sum + p.totalSauts, 0);

  if (!profile?.centre_id) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-500">Aucun centre n'est associé à votre compte administrateur.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#001A4D]">Administration Centre</h1>
          <Link to="/tampon"
            className="flex items-center gap-2 bg-[#001A4D] hover:bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors no-underline">
            <Stamp className="w-4 h-4" /> Mon Tampon Officiel
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Parachutistes</p>
                <p className="text-3xl font-bold text-[#001A4D]">{parachutistes.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Moniteurs</p>
                <p className="text-3xl font-bold text-[#001A4D]">{moniteurs.length}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ParachuteIcon className="w-10 h-10 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Sauts cette année</p>
                <p className="text-3xl font-bold text-[#001A4D]">{totalSautsMois}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total sauts</p>
                <p className="text-3xl font-bold text-[#001A4D]">{totalSauts}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-sm">
          <button
            onClick={() => setActiveTab('parachutistes')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'parachutistes' ? 'bg-white shadow-sm text-[#001A4D]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Parachutistes ({parachutistes.length})
          </button>
          <button
            onClick={() => setActiveTab('moniteurs')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'moniteurs' ? 'bg-white shadow-sm text-[#001A4D]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Moniteurs ({moniteurs.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : activeTab === 'parachutistes' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-4 py-3 text-left font-medium">Nom</th>
                    <th className="px-4 py-3 text-left font-medium">Licence</th>
                    <th className="px-4 py-3 text-left font-medium">Total sauts</th>
                    <th className="px-4 py-3 text-left font-medium">Cette année</th>
                    <th className="px-4 py-3 text-left font-medium">Dernier saut</th>
                    <th className="px-4 py-3 text-left font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parachutistes.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#001A4D]">{p.prenom} {p.nom}</p>
                        <p className="text-xs text-gray-400">{p.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">{p.numero_licence}</td>
                      <td className="px-4 py-3 font-semibold text-[#001A4D]">{p.totalSauts}</td>
                      <td className="px-4 py-3 text-gray-700">{p.sautsCetteAnnee}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {p.dernierSaut ? new Date(p.dernierSaut).toLocaleDateString('fr-FR') : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/parachutiste/${p.id}`)}
                          className="text-gray-400 hover:text-orange-500 transition-colors"
                          title="Voir le carnet"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <MoniteursTable moniteurs={moniteurs} adminId={profile?.id} onRefresh={fetchData} />
        )}
      </div>
    </Layout>
  );
}

// ─── Moniteurs Table with DT validation ────────────────────────────────────────

function MoniteursTable({ moniteurs, adminId, onRefresh }: {
  moniteurs: MoniteurInfo[];
  adminId?: string;
  onRefresh: () => void;
}) {
  const [validating, setValidating] = useState<string | null>(null);

  const handleValidate = async (moniteurId: string) => {
    if (!adminId) return;
    setValidating(moniteurId);
    await supabase.from('profiles').update({
      moniteur_valide_par_dt: true,
      moniteur_valide_le: new Date().toISOString(),
      moniteur_valide_par_id: adminId,
    }).eq('id', moniteurId);
    setValidating(null);
    onRefresh();
  };

  const pending = moniteurs.filter((m) => !m.moniteur_valide_par_dt);
  const active = moniteurs.filter((m) => m.moniteur_valide_par_dt);

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">{pending.length} moniteur(s) en attente de validation DT</p>
            <p className="text-xs text-amber-700 mt-0.5">Ces comptes ne peuvent pas signer de sauts tant que vous ne les avez pas validés.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-4 py-3 text-left font-medium">Moniteur</th>
              <th className="px-4 py-3 text-left font-medium">Qualification</th>
              <th className="px-4 py-3 text-left font-medium">Statut DT</th>
              <th className="px-4 py-3 text-left font-medium w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[...pending, ...active].map((m) => (
              <tr key={m.id} className={`hover:bg-gray-50/50 transition-colors ${!m.moniteur_valide_par_dt ? 'bg-amber-50/30' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-[#001A4D]">{m.prenom} {m.nom}</p>
                  <p className="text-xs text-gray-400">{m.email}</p>
                </td>
                <td className="px-4 py-3">
                  {m.numero_brevet_moniteur ? (
                    <div>
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {m.type_brevet_moniteur ?? 'BEES'}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">{m.numero_brevet_moniteur}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Non renseigné</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.moniteur_valide_par_dt ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      <CheckCircle className="w-3 h-3" /> Validé par DT
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      <AlertTriangle className="w-3 h-3" /> En attente
                    </span>
                  )}
                  {m.moniteur_valide_le && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(m.moniteur_valide_le).toLocaleDateString('fr-FR')}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!m.moniteur_valide_par_dt && (
                    <button
                      onClick={() => handleValidate(m.id)}
                      disabled={validating === m.id}
                      className="flex items-center gap-1 bg-[#001A4D] hover:bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {validating === m.id ? '...' : 'Valider DT'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {moniteurs.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Aucun moniteur enregistré</div>
        )}
      </div>
    </div>
  );
}
