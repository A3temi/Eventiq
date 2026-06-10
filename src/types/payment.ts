import type { BudgetCategory, CategoryBudget } from './event';

export interface BudgetStatus {
  totalBudget: number;
  categories: CategoryBudget[];
  totalCommitted: number;
  totalSpent: number;
  totalRemaining: number;
  utilizationPercent: number;
  checkoutReady: boolean;
}

export interface CreditBalance {
  userId: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastUpdated: string;
}

export interface CheckoutLineItem {
  description: string;
  amount: number;
  category: BudgetCategory;
  vendorName?: string;
}

export interface EventCheckoutParams {
  eventId: string;
  lineItems: CheckoutLineItem[];
  currency: 'SGD';
}

export interface CreditPurchaseParams {
  userId: string;
  packageId: CreditPackageId;
  amount: number;
  credits: number;
}

export type CreditPackageId = 'credits-50' | 'credits-200' | 'credits-500';

export const CREDIT_PACKAGES: Record<CreditPackageId, { credits: number; pricesgd: number }> = {
  'credits-50': { credits: 50, pricesgd: 5 },
  'credits-200': { credits: 200, pricesgd: 18 },
  'credits-500': { credits: 500, pricesgd: 40 },
};

export interface TicketCheckoutParams {
  eventId: string;
  attendeeEmail: string;
  ticketType: string;
  amount: number;
  connectedAccountId: string;
}

export interface PaymentRecord {
  eventId: string;
  transactionId: string;
  amount: number;
  recipient: string;
  category: BudgetCategory | 'credits';
  stripeSessionId: string;
  status: 'pending' | 'completed' | 'failed' | 'abandoned';
  type: 'checkout' | 'credits' | 'ticket';
  lineItems?: CheckoutLineItem[];
  connectedAccountId?: string;
  timestamp: string;
}

/** Credit costs per operation type */
export const CREDIT_COSTS: Record<string, number> = {
  exa_search: 2,
  stagehand_session: 5,
  email_send: 1,
  whatsapp_send: 1,
  llm_call: 1,
};
