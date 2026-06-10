import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits } from '@/lib/db/credits';
import { recordPayment, updatePaymentStatus } from '@/lib/db/payments';
import { updatePaymentStatus as updateAttendeePayment } from '@/lib/db/attendees';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        if (metadata.type === 'credits') {
          // Credit purchase completed
          await addCredits(
            metadata.userId!,
            parseInt(metadata.credits!),
            session.id
          );
        } else if (metadata.type === 'event_checkout') {
          // Event payment completed
          await recordPayment({
            eventId: metadata.eventId!,
            amount: (session.amount_total || 0) / 100,
            recipient: 'platform',
            category: 'other',
            stripeSessionId: session.id,
            status: 'completed',
            type: 'checkout',
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const metadata = intent.metadata || {};

        if (metadata.type === 'ticket') {
          // Ticket payment via Stripe Connect
          await updateAttendeePayment(
            metadata.eventId!,
            metadata.attendeeId!,
            'paid',
            intent.id
          );
        }
        break;
      }

      case 'account.updated': {
        // Stripe Connect onboarding status update
        const account = event.data.object as Stripe.Account;
        console.log(`Stripe Connect account ${account.id} updated:`, account.details_submitted);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
