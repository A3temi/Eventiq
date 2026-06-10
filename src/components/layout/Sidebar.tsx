'use client';

import { CalendarDays, CreditCard, LayoutGrid, Plus, X } from 'lucide-react';
import type { Tab } from '@/app/page';
import { UserMenu } from '@/components/sidebar/UserMenu';
import { cn } from '@/lib/utils';

interface SidebarProps {
  active: Tab;
  onChange: (t: Tab) => void;
  onNew: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const nav: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'events', label: 'My Events', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

export function Sidebar({ active, onChange, onNew, mobileOpen = false, onMobileClose }: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-foreground/40 backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          'fixed md:static z-40 top-0 left-0 h-full w-[260px] shrink-0 border-r border-border bg-card flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">E</span>
            </div>
            <span className="font-bold text-lg tracking-tight">EVENT<span className="text-primary">IQ</span></span>
          </div>
          <button
            onClick={onMobileClose}
            className="md:hidden h-8 w-8 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onChange(item.id); onMobileClose?.(); }}
                className={cn(
                  'group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:translate-x-0.5',
                  isActive
                    ? 'bg-accent text-primary glow-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* New Event */}
        <div className="px-3 pb-3">
          <button
            onClick={() => { onNew(); onMobileClose?.(); }}
            className="w-full rounded-xl bg-primary text-primary-foreground font-medium text-sm py-2.5 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition"
          >
            <Plus className="h-4 w-4" /> New Event
          </button>
        </div>

        {/* User */}
        <UserMenu />
      </aside>
    </>
  );
}
