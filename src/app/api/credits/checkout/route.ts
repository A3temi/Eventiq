import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// $5 = 500 credits, $10 = 1100 credits, $20 = 2500 credits, $50 = 7000 credits
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

  const { tier } = await req.json();
  const plan = CREDIT_TIERS[tier];

  if (!plan) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: session.user.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Eventiq Credits — ${plan.label}`,
            description: `Add ${plan.label} to your Eventiq account`,
          },
          unit_amount: plan.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: 'credits',
      userId: session.user.email,
      credits: String(plan.credits),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/settings?purchased=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/settings`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
