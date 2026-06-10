import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';
import { addCredits, getCreditBalance } from '@/lib/db/credits';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Confirm a Stripe checkout session and add credits.
 * Called from the settings page after successful payment.
 * This is the fallback for when webhooks aren't configured.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify it's completed and belongs to this user
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    if (checkoutSession.customer_email !== session.user.email) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
    }

    // Check metadata
    const metadata = checkoutSession.metadata || {};
    if (metadata.type !== 'credits' || !metadata.credits) {
      return NextResponse.json({ error: 'Invalid session type' }, { status: 400 });
    }

    const creditsToAdd = parseInt(metadata.credits);

    // Add credits (addCredits is idempotent if we use sessionId as dedup key)
    await addCredits(session.user.email, creditsToAdd, checkoutSession.id);

    // Get updated balance
    const balance = await getCreditBalance(session.user.email);

    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
      newBalance: balance.balance,
    });
  } catch (error) {
    console.error('Credit confirm error:', error);
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
  }
}
