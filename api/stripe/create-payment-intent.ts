import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    transaction_ids,
    parachutiste_id,
    dz_id,
    centre_nom,
    montant_cents,
    success_url,
    cancel_url,
  } = req.body as {
    transaction_ids: string[];
    parachutiste_id: string;
    dz_id: string;
    centre_nom: string;
    montant_cents: number;
    success_url: string;
    cancel_url: string;
  };

  if (!transaction_ids?.length || !parachutiste_id || !dz_id || !montant_cents) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Règlement ${centre_nom ?? 'DZ'} — ParaPass`,
              description: `${transaction_ids.length} transaction${transaction_ids.length > 1 ? 's' : ''}`,
            },
            unit_amount: montant_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        parachutiste_id,
        dz_id,
        transaction_ids: transaction_ids.join(','),
      },
      success_url: success_url ?? `${process.env.VERCEL_URL}/dashboard?payment=success`,
      cancel_url: cancel_url ?? `${process.env.VERCEL_URL}/dashboard`,
    });

    return res.status(200).json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[stripe/create-payment-intent]', err);
    return res.status(500).json({ error: 'Erreur Stripe lors de la création de la session.' });
  }
}
