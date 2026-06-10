'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, Suspense } from 'react';
import { ArrowLeft, CreditCard, Mail, MessageCircle, Save, Sparkles, Check, Zap } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface UserSettings {
  customEmail: string;
  customWhatsApp: string;
  useCustomEmail: boolean;
  useCustomWhatsApp: boolean;
}

const CREDIT_TIERS = [
  { tier: '5', price: '$5', credits: '500', perDollar: '100/$ ', popular: false },
  { tier: '10', price: '$10', credits: '1,100', perDollar: '110/$', popular: true },
  { tier: '20', price: '$20', credits: '2,500', perDollar: '125/$', popular: false },
  { tier: '50', price: '$50', credits: '7,000', perDollar: '140/$', popular: false },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState<number | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    customEmail: '',
    customWhatsApp: '',
    useCustomEmail: false,
    useCustomWhatsApp: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const justPurchased = searchParams.get('purchased') === 'true';

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/credits')
        .then((r) => r.json())
        .then((d) => setCredits(d.balance))
        .catch(() => {});

      fetch('/api/settings')
        .then((r) => r.json())
        .then((d) => {
          if (d.settings) setSettings(d.settings);
        })
        .catch(() => {});
    }
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handlePurchase = async (tier: string) => {
    setPurchasing(tier);
    try {
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setPurchasing(null);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="p-2 rounded-md hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>

        {/* Success Banner */}
        {justPurchased && (
          <div className="mb-6 p-4 rounded-xl bg-status-success/10 border border-status-success/20 flex items-center gap-3">
            <Check className="w-5 h-5 text-status-success" />
            <span className="text-sm font-medium">Credits added to your account!</span>
          </div>
        )}

        {/* Profile Section */}
        <section className="mb-8 p-5 border rounded-xl bg-card">
          <div className="flex items-center gap-4">
            {session.user?.image ? (
              <img src={session.user.image} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-medium">
                {session.user?.name?.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="font-medium text-lg">{session.user?.name}</h2>
              <p className="text-sm text-muted-foreground">{session.user?.email}</p>
            </div>
          </div>
        </section>

        {/* Credits Section */}
        <section id="credits" className="mb-8 p-5 border rounded-xl bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-medium text-lg">Credits</h2>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold">{credits ?? '...'}</span>
            <span className="text-muted-foreground text-sm">credits remaining</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Each AI operation costs 1–5 credits. New accounts start with 1,000 free credits.
          </p>

          {/* Purchase Grid */}
          <div className="grid grid-cols-2 gap-3">
            {CREDIT_TIERS.map((plan) => (
              <button
                key={plan.tier}
                onClick={() => handlePurchase(plan.tier)}
                disabled={purchasing !== null}
                className={`relative p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50 hover:shadow-sm ${
                  plan.popular ? 'border-primary/30 bg-primary/5' : 'border-border'
                } ${purchasing === plan.tier ? 'opacity-70' : ''}`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-3 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-medium rounded-full">
                    POPULAR
                  </span>
                )}
                <div className="text-2xl font-bold">{plan.price}</div>
                <div className="text-sm font-medium mt-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-primary" />
                  {plan.credits} credits
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {plan.perDollar}
                </div>
                {purchasing === plan.tier && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                    <span className="text-xs">Redirecting...</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Payments processed securely via Stripe. Credits never expire.
          </p>
        </section>

        {/* Email Settings */}
        <section className="mb-8 p-5 border rounded-xl bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-medium text-lg">Email</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            By default, Eventiq sends emails from the platform email. You can use your own Gmail for personalized communication.
          </p>
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useCustomEmail}
              onChange={(e) => setSettings({ ...settings, useCustomEmail: e.target.checked })}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Use my own email address</span>
          </label>
          {settings.useCustomEmail && (
            <input
              type="email"
              value={settings.customEmail}
              onChange={(e) => setSettings({ ...settings, customEmail: e.target.value })}
              placeholder="your-email@gmail.com"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
        </section>

        {/* WhatsApp Settings */}
        <section className="mb-8 p-5 border rounded-xl bg-card">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5 text-green-500" />
            <h2 className="font-medium text-lg">WhatsApp</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            By default, Eventiq uses the platform WhatsApp. You can connect your own for direct messaging.
          </p>
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useCustomWhatsApp}
              onChange={(e) => setSettings({ ...settings, useCustomWhatsApp: e.target.checked })}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Use my own WhatsApp number</span>
          </label>
          {settings.useCustomWhatsApp && (
            <input
              type="tel"
              value={settings.customWhatsApp}
              onChange={(e) => setSettings({ ...settings, customWhatsApp: e.target.value })}
              placeholder="+65 1234 5678"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
