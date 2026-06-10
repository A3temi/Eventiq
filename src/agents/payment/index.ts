import Stripe from 'stripe';
import type { AgentTask } from '@/types/agents';
import type { EventBrief } from '@/types/event';
import { CREDIT_PACKAGES, type CreditPackageId } from '@/types/payment';
import { getCreditBalance } from '@/lib/db/credits';
import { getEventPayments } from '@/lib/db/payments';
import { formatCurrency } from '@/lib/utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export async function handlePaymentTask(
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  switch (task.action) {
    case 'purchase_credits':
      return handleCreditPurchase(userId, task.parameters);
    case 'make_payment':
      return handleEventCheckout(event, userId);
    case 'connect_stripe':
      return handleStripeConnect(userId);
    default:
      return handleBudgetStatus(event);
  }
}

async function handleCreditPurchase(
  userId: string,
  params: Record<string, unknown>
): Promise<DelegationResult> {
  const packageId = (params.packageId as CreditPackageId) || 'credits-200';
  const pkg = CREDIT_PACKAGES[packageId];

  if (!pkg) {
    return {
      success: true,
      summary: `Available credit packages:\n• 50 credits — $5 SGD\n• 200 credits — $18 SGD\n• 500 credits — $40 SGD\n\nWhich package would you like?`,
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'sgd',
        product_data: { name: `${pkg.credits} Credits` },
        unit_amount: pkg.pricesgd * 100,
      },
      quantity: 1,
    }],
    metadata: { type: 'credits', userId, credits: String(pkg.credits) },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits/cancel`,
  });

  return {
    success: true,
    summary: `I've generated a checkout for ${pkg.credits} credits (${formatCurrency(pkg.pricesgd)}). [Click here to complete purchase](${session.url})`,
    data: { checkoutUrl: session.url, sessionId: session.id },
  };
}

async function handleEventCheckout(event: EventBrief, userId: string): Promise<DelegationResult> {
  const payments = await getEventPayments(event.id);
  const unpaid = payments.filter((p) => p.status === 'pending');

  if (unpaid.length === 0) {
    return {
      success: true,
      summary: 'No pending payments for this event. All costs are either paid or no vendor agreements have been confirmed yet.',
    };
  }

  const lineItems = unpaid.map((p) => ({
    price_data: {
      currency: 'sgd',
      product_data: { name: `${p.category}: ${p.recipient}` },
      unit_amount: Math.round(p.amount * 100),
    },
    quantity: 1,
  }));

  const total = unpaid.reduce((sum, p) => sum + p.amount, 0);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    metadata: { type: 'event_checkout', eventId: event.id, userId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/event/${event.id}/payment-success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/event/${event.id}`,
  });

  return {
    success: true,
    summary: `Your event checkout is ready with ${unpaid.length} items totaling ${formatCurrency(total)}.\n\n[Complete Payment](${session.url})`,
    data: { checkoutUrl: session.url, total },
  };
}

async function handleStripeConnect(userId: string): Promise<DelegationResult> {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'SG',
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  });

  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/stripe/refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/stripe/success`,
    type: 'account_onboarding',
  });

  return {
    success: true,
    summary: `To receive ticket payments directly, connect your Stripe account: [Connect Stripe](${link.url})\n\nThis lets attendees pay for tickets directly to your account.`,
    data: { connectUrl: link.url, accountId: account.id },
  };
}

async function handleBudgetStatus(event: EventBrief): Promise<DelegationResult> {
  const budget = event.budget;
  if (!budget || budget.total === 0) {
    return {
      success: true,
      summary: 'No budget has been set for this event yet. Would you like to set a total budget?',
    };
  }

  const categories = budget.categories.length > 0
    ? budget.categories.map((c) =>
        `• ${c.name}: ${formatCurrency(c.allocated)} allocated, ${formatCurrency(c.spent)} spent, ${formatCurrency(c.committed)} committed, ${formatCurrency(c.remaining)} remaining (${c.utilizationPercent}%)`
      ).join('\n')
    : 'No category breakdown yet.';

  const totalSpent = budget.categories.reduce((s, c) => s + c.spent, 0);
  const totalCommitted = budget.categories.reduce((s, c) => s + c.committed, 0);
  const utilization = Math.round(((totalSpent + totalCommitted) / budget.total) * 100);

  return {
    success: true,
    summary: `**Budget Overview — ${event.name}**\nTotal: ${formatCurrency(budget.total)}\nUtilization: ${utilization}%\n\n${categories}`,
  };
}
