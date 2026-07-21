import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64url encode a Uint8Array
function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    // Load private key from secrets
    const privateKeyJwk = Deno.env.get('PARAPASS_SIGNING_PRIVATE_KEY_JWK');
    if (!privateKeyJwk) return new Response('Signing key not configured', { status: 500, headers: corsHeaders });

    const privateKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(privateKeyJwk),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );

    // Fetch parachutiste data
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const [{ data: profile }, { data: licences }, { data: brevet }, { data: certif }, { count: totalJumps }, { count: validJumps }] =
      await Promise.all([
        adminClient.from('profiles').select('nom,prenom,numero_licence,centre_id').eq('id', user.id).maybeSingle(),
        adminClient.from('licences').select('numero_licence,date_expiration,statut').eq('parachutiste_id', user.id),
        adminClient.from('brevets').select('type_brevet').eq('parachutiste_id', user.id).order('date_obtention', { ascending: false }).limit(1).maybeSingle(),
        adminClient.from('certificats_medicaux').select('date_expiration').eq('parachutiste_id', user.id).order('date_expiration', { ascending: false }).limit(1).maybeSingle(),
        adminClient.from('sauts').select('id', { count: 'exact', head: true }).eq('parachutiste_id', user.id).neq('source', 'soufflerie'),
        adminClient.from('sauts').select('id', { count: 'exact', head: true }).eq('parachutiste_id', user.id).neq('source', 'soufflerie').in('statut', ['valide', 'historique']),
      ]);

    // Licence de référence : la ligne ACTIVE à l'échéance la plus lointaine, sinon
    // la plus récente. Le numéro vient de la table licences — pas du champ profil (périmable).
    const licence = (licences ?? [])
      .sort((a, b) => {
        if ((a.statut === 'actif') !== (b.statut === 'actif')) return a.statut === 'actif' ? -1 : 1;
        return (b.date_expiration ?? '').localeCompare(a.date_expiration ?? '');
      })[0] ?? null;

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 30 * 24 * 60 * 60; // 30 days

    const payload = {
      sub: user.id,
      nom: profile?.nom ?? '',
      prenom: profile?.prenom ?? '',
      lic: licence?.numero_licence ?? profile?.numero_licence ?? '',
      brevet: brevet?.type_brevet ?? null,
      lic_exp: licence?.date_expiration ?? null,
      lic_statut: licence?.statut ?? null,
      med_exp: certif?.date_expiration ?? null,
      total_jumps: totalJumps ?? 0,
      valid_jumps: validJumps ?? 0,
      active: licence?.statut === 'actif',
      iat: now,
      exp,
    };

    // Build JWS compact serialization
    const header = { alg: 'ES256', typ: 'JWT' };
    const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;

    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(signingInput),
    );

    const jws = `${signingInput}.${base64url(sig)}`;

    return new Response(JSON.stringify({ jws }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('sign-qr error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
