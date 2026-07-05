// Backward-compat redirect: old QR codes encode /pliage/scan/<token>
// → look up the sac by token and redirect to /sac/<uuid>
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function ScanPliagePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) { navigate('/', { replace: true }); return; }
    supabase
      .from('sacs_parachute')
      .select('id')
      .eq('qr_code_token', token)
      .eq('actif', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          navigate(`/sac/${data.id}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      });
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1628' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
    </div>
  );
}
