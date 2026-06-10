import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addCredits, getCreditBalance } from '@/lib/db/credits';
import Stripe from 'stripe';

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('Stripe is not configured');
  return new Stripe(secretKey);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await req.json().catch(() => ({}));
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return NextResponse.json({ error: 'Missing Stripe session id' }, { status: 400 });
  }

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId.trim());
  const metadata = checkoutSession.metadata || {};

  if (metadata.type !== 'credits') {
    return NextResponse.json({ error: 'This checkout session is not for credits' }, { status: 400 });
  }

  if (metadata.userId !== session.user.email) {
    return NextResponse.json({ error: 'Checkout session belongs to a different user' }, { status: 403 });
  }

  if (checkoutSession.payment_status !== 'paid') {
    return NextResponse.json(
      { error: 'Payment is not completed yet', status: checkoutSession.status, paymentStatus: checkoutSession.payment_status },
      { status: 409 },
    );
  }

  const credits = Number.parseInt(metadata.credits || '', 10);
  if (!Number.isFinite(credits) || credits <= 0) {
    return NextResponse.json({ error: 'Checkout session has invalid credit metadata' }, { status: 400 });
  }

  const balance = await addCredits(session.user.email, credits, checkoutSession.id);
  return NextResponse.json({ ok: true, balance });
}
