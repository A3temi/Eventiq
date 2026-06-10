'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Mail, MessageCircle, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface UserSettings {
  customEmail: string;
  customWhatsApp: string;
  useCustomEmail: boolean;
  useCustomWhatsApp: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    customEmail: '',
    customWhatsApp: '',
    useCustomEmail: false,
    useCustomWhatsApp: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-medium text-lg">Credits</h2>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{credits ?? '...'}</span>
            <span className="text-muted-foreground">credits remaining</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            New accounts start with 1,000 free credits. Each AI operation costs 1–5 credits.
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
              className="w-4 h-4 rounded border-border"
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
              className="w-4 h-4 rounded border-border"
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
