import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('Stripe is not configured');
  return new Stripe(secretKey);
}

function buildReturnUrl(req: NextRequest, path: string, params: Record<string, string>) {
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/settings';
  const url = new URL(safePath, req.nextUrl.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}');
}

// S$5 = 500 credits, S$10 = 1100 credits, S$20 = 2500 credits, S$50 = 7000 credits
const CREDIT_TIERS: Record<string, { amount: number; credits: number; label: string }> = {
  '5': { amount: 500, credits: 500, label: '500 credits' },
  '10': { amount: 1000, credits: 1100, label: '1,100 credits' },
  '20': { amount: 2000, credits: 2500, label: '2,500 credits' },
  '50': { amount: 5000, credits: 7000, label: '7,000 credits' },
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tier, returnPath = '/settings' } = await req.json();
  const plan = CREDIT_TIERS[tier];

  if (!plan) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const metadata = {
    type: 'credits',
    userId: session.user.email,
    credits: String(plan.credits),
    tier: String(tier),
  };

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['paynow'],
    client_reference_id: session.user.email,
    customer_email: session.user.email,
    line_items: [
      {
        price_data: {
          currency: 'sgd',
          product_data: {
            name: `Eventiq Credits — ${plan.label}`,
            description: `Add ${plan.label} to your Eventiq account`,
          },
          unit_amount: plan.amount,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url: buildReturnUrl(req, returnPath, {
      purchased: 'true',
      session_id: '{CHECKOUT_SESSION_ID}',
    }),
    cancel_url: buildReturnUrl(req, returnPath, { purchased: 'cancelled' }),
  });

  return NextResponse.json({ id: checkoutSession.id, url: checkoutSession.url });
}
