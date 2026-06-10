'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { CreditCard, Loader2, Receipt, Sparkles, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { toneClasses } from '@/lib/eventiq/meta';
import type { CreditBalance } from '@/types/payment';

type TierKey = '5' | '10' | '20' | '50';

const tiers: { key: TierKey; price: string; credits: string }[] = [
  { key: '5', price: 'S$5', credits: '500' },
  { key: '10', price: 'S$10', credits: '1,100' },
  { key: '20', price: 'S$20', credits: '2,500' },
  { key: '50', price: 'S$50', credits: '7,000' },
];

export function BillingPage() {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<TierKey | null>(null);

  useEffect(() => {
    if (!session?.user?.email) {
      setBalance(null);
      setLoading(status === 'loading');
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch('/api/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.balance === 'number') setBalance(d as CreditBalance);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, status]);

  const handlePurchase = async (tier: TierKey) => {
    if (!session?.user?.email) {
      signIn('google');
      return;
    }
    setPurchasing(tier);
    try {
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, returnPath: '/settings' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start checkout');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Billing & Account</h2>

      {/* Credits balance */}
      <div className="card-soft p-5 space-y-4 animate-card-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Credits balance</div>
            <div className="text-xs text-muted-foreground">Credits power the Eventiq agents</div>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-28 bg-muted rounded-lg animate-pulse" />
            <div className="h-3 w-48 bg-muted rounded animate-pulse" />
          </div>
        ) : !session ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sign in to see your credits balance.</p>
            <button
              onClick={() => signIn('google')}
              className="rounded-xl bg-primary text-primary-foreground font-medium text-sm px-4 py-2 hover:opacity-90 active:scale-[0.98] transition"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {(balance?.balance ?? 0).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">credits</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              total purchased {(balance?.totalPurchased ?? 0).toLocaleString()} • total used{' '}
              {(balance?.totalUsed ?? 0).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Buy credits */}
      <div className="card-soft p-5 space-y-4 animate-card-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Buy credits</div>
            <div className="text-xs text-muted-foreground">Stripe PayNow sandbox checkout with QR authorization</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiers.map((tier) => (
            <button
              key={tier.key}
              onClick={() => handlePurchase(tier.key)}
              disabled={purchasing !== null}
              className="rounded-xl border border-border bg-card p-3 flex flex-col items-center gap-1.5 text-sm hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98] transition disabled:opacity-60 disabled:pointer-events-none"
            >
              {purchasing === tier.key ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <span className="text-lg font-bold">{tier.price}</span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${toneClasses.success}`}
              >
                <Sparkles className="h-3 w-3" />
                {tier.credits} credits
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div className="card-soft p-5 space-y-3 animate-card-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold">Usage</div>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
            <div className="h-4 w-56 bg-muted rounded animate-pulse" />
          </div>
        ) : !session ? (
          <p className="text-sm text-muted-foreground">Sign in to see your usage.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
              <span className="text-muted-foreground">Total credits used</span>
              <span className="font-medium tabular-nums">
                {(balance?.totalUsed ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm py-2">
              <span className="text-muted-foreground">Last updated</span>
              <span className="font-medium">
                {balance?.lastUpdated
                  ? format(new Date(balance.lastUpdated), 'd MMM yyyy, h:mm a')
                  : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
