import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { generatePDF } from '../lib/pdf';
import type { Saut, Centre } from '../lib/types';
import type { Profile } from '../lib/auth';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS, FONCTION_LABELS, STATUT_LABELS } from '../lib/types';
import { ArrowLeft, FileDown } from 'lucide-react';
import { ParachuteIcon } from '../components/ParachuteIcon';

export function ParachutisteViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sauts, setSauts] = useState<Saut[]>([]);
  const [centre, setCentre] = useState<Centre | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (p) {
        setProfile(p as Profile);
        if (p.centre_id) {
          const { data: c } = await supabase.from('centres').select('*').eq('id', p.centre_id).maybeSingle();
          if (c) setCentre(c as Centre);
        }
      }
      const { data: s } = await supabase.from('sauts').select('*').eq('parachutiste_id', id).order('date_saut', { ascending: false });
      if (s) setSauts(s as Saut[]);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#001A4D]" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500">Parachutiste introuvable</div>
      </Layout>
    );
  }

  const statutBadge = (statut: string) => {
    const colors: Record<string, string> = {
      valide: 'bg-green-100 text-green-700',
      en_attente: 'bg-orange-100 text-orange-700',
      refuse: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[statut] || ''}`}>
        {STATUT_LABELS[statut] || statut}
      </span>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#001A4D]">{profile.prenom} {profile.nom}</h1>
              <p className="text-sm text-gray-500">Licence FFP : {profile.numero_licence}</p>
              {centre && <p className="text-sm text-gray-500">Centre : {centre.nom} — {centre.ville}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => generatePDF(profile, sauts)}
                disabled={sauts.length === 0}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Exporter PDF
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-[#001A4D]">Carnet de sauts ({sauts.length})</h2>
          </div>

          {sauts.length === 0 ? (
            <div className="p-12 text-center">
              <ParachuteIcon className="w-36 h-36 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun saut enregistré</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Lieu</th>
                    <th className="px-4 py-3 text-left font-medium">Aéronef</th>
                    <th className="px-4 py-3 text-left font-medium">Nature</th>
                    <th className="px-4 py-3 text-left font-medium">Catégorie</th>
                    <th className="px-4 py-3 text-left font-medium">Hauteur</th>
                    <th className="px-4 py-3 text-left font-medium">Fonction</th>
                    <th className="px-4 py-3 text-left font-medium">Tps vol</th>
                    <th className="px-4 py-3 text-left font-medium">Visa</th>
                    <th className="px-4 py-3 text-left font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sauts.map((saut) => (
                    <tr key={saut.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                        {new Date(saut.date_saut).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{saut.lieu}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">{saut.aeronef_immat}</td>
                      <td className="px-4 py-3 text-gray-700">{NATURE_SAUT_LABELS[saut.nature_saut]}</td>
                      <td className="px-4 py-3 text-gray-700">{CATEGORIE_LABELS[saut.categorie]}</td>
                      <td className="px-4 py-3 text-gray-700">{saut.hauteur_m}m</td>
                      <td className="px-4 py-3 text-gray-700">{FONCTION_LABELS[saut.fonction]}</td>
                      <td className="px-4 py-3 text-gray-700">{saut.temps_vol_min}'</td>
                      <td className="px-4 py-3 text-xs">
                        {saut.valide_par ? <span className="text-green-600">{saut.valide_par}</span> : '—'}
                      </td>
                      <td className="px-4 py-3">{statutBadge(saut.statut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
