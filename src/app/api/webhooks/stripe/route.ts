import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/db/credits';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const hasRealWebhookSecret = Boolean(webhookSecret && webhookSecret !== 'whsec_xxx');
  const allowUnsignedDevWebhook =
    process.env.NODE_ENV === 'development' && (!webhookSecret || webhookSecret === 'whsec_xxx');

  if (hasRealWebhookSecret) {
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret!);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else if (allowUnsignedDevWebhook) {
    // Dev/sandbox mode with placeholder secret — parse without signature verification.
    event = JSON.parse(body) as Stripe.Event;
  } else {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        const credits = Number.parseInt(metadata.credits || '', 10);
        if (
          metadata.type === 'credits' &&
          metadata.userId &&
          Number.isFinite(credits) &&
          credits > 0 &&
          session.payment_status === 'paid'
        ) {
          await addCredits(
            metadata.userId,
            credits,
            session.id
          );
          console.log(`✓ Added ${credits} credits to ${metadata.userId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
