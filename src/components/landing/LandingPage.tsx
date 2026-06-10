'use client';

import { signIn } from 'next-auth/react';
import { ArrowRight, Zap, Globe, MessageCircle, Calendar, Bot } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/logo-wide.svg" alt="Eventiq" className="h-7" />
          <button
            onClick={() => signIn('google')}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] animate-pulse" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full bg-orange-500/5 blur-[100px] animate-pulse delay-1000" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card/60 text-xs font-medium text-muted-foreground mb-8">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Powered by 9 autonomous AI agents
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Your AI event planner
            <br />
            <span className="text-primary">for Singapore</span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Describe your event. Eventiq researches venues, negotiates with vendors,
            sends invitations, builds schedules, and handles payments — autonomously.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => signIn('google')}
              className="px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              Start Planning <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#how-it-works"
              className="px-6 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">How it works</h2>
            <p className="mt-3 text-muted-foreground">Three steps. Zero manual coordination.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Describe your event"
              description="Tell Eventiq what you need in plain language. Date, headcount, budget — whatever you have."
              icon={<MessageCircle className="h-5 w-5" />}
            />
            <StepCard
              number="2"
              title="Agents take action"
              description="9 specialized AI agents research, negotiate, message vendors, build schedules, and create forms."
              icon={<Bot className="h-5 w-5" />}
            />
            <StepCard
              number="3"
              title="Event is ready"
              description="Track everything on your dashboard. Approve decisions, purchase tickets, share invites."
              icon={<Calendar className="h-5 w-5" />}
            />
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground">Real actions, not just suggestions</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CapabilityPill emoji="🔍" label="Web research via Exa" />
            <CapabilityPill emoji="📱" label="WhatsApp messages" />
            <CapabilityPill emoji="✉️" label="Email outreach" />
            <CapabilityPill emoji="📍" label="Venue scouting" />
            <CapabilityPill emoji="🍽️" label="Catering quotes" />
            <CapabilityPill emoji="📅" label="Schedule building" />
            <CapabilityPill emoji="💳" label="Stripe payments" />
            <CapabilityPill emoji="📋" label="Registration forms" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground">Ready to plan your next event?</h2>
          <p className="mt-4 text-muted-foreground">1,000 free credits to get started. No credit card required.</p>
          <button
            onClick={() => signIn('google')}
            className="mt-8 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity inline-flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            Sign in with Google <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src="/logo-wide.svg" alt="Eventiq" className="h-5 opacity-60" />
          <p className="text-xs text-muted-foreground">Built for NEXT Hackathon • SuperAI Singapore 2026</p>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, title, description, icon }: { number: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="relative p-6 rounded-2xl border border-border bg-card/60 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
          {icon}
        </div>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Step {number}</span>
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function CapabilityPill({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card/60 hover:bg-card transition-colors">
      <span className="text-lg">{emoji}</span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}
