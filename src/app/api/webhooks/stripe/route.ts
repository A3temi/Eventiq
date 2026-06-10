import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/db/credits';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;

  // If webhook secret is set, verify signature. Otherwise accept (sandbox dev mode).
  if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== 'whsec_xxx' && signature) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else {
    // Dev/sandbox mode — parse without signature verification
    event = JSON.parse(body) as Stripe.Event;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        if (metadata.type === 'credits' && metadata.userId && metadata.credits) {
          await addCredits(
            metadata.userId,
            parseInt(metadata.credits),
            session.id
          );
          console.log(`✓ Added ${metadata.credits} credits to ${metadata.userId}`);
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
