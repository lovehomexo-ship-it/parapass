import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature' });

  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('[webhook] signature invalid', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const transactionIds = session.metadata?.transaction_ids?.split(',').filter(Boolean) ?? [];
    const parachutiste_id = session.metadata?.parachutiste_id;
    const dz_id = session.metadata?.dz_id;

    if (transactionIds.length > 0) {
      // Mark transactions as paid
      const { error: txError } = await supabase
        .from('parachutiste_transactions')
        .update({ statut: 'paye' })
        .in('id', transactionIds)
        .eq('statut', 'du');

      if (txError) {
        console.error('[webhook] update transactions error', txError);
        return res.status(500).json({ error: 'DB update failed' });
      }

      // Create paiement record
      if (parachutiste_id && dz_id) {
        const { error: payError } = await supabase.from('paiements').insert({
          parachutiste_id,
          dz_id,
          montant_cents: session.amount_total ?? 0,
          stripe_payment_intent_id: session.payment_intent as string | null,
          stripe_checkout_session_id: session.id,
          statut: 'paye',
        });
        if (payError) console.error('[webhook] insert paiement error', payError);
      }
    }
  }

  return res.status(200).json({ received: true });
}
