import { CalendarDays, CreditCard, LayoutGrid, LogOut, Plus, X } from "lucide-react";
import type { Tab } from "./TabBar";
import logoAsset from "@/assets/eventiq-logo.svg.asset.json";

interface SidebarProps {
  active: Tab;
  onChange: (t: Tab) => void;
  onNew: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const nav: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: "events", label: "My Events", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "billing", label: "Billing", icon: CreditCard },
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
        className={`fixed md:static z-40 top-0 left-0 h-full w-[260px] md:w-[240px] shrink-0 border-r border-border bg-card md:bg-card/40 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 flex items-center justify-between">
          <img src={logoAsset.url} alt="Eventiq" className="h-8 w-auto" />
          <button
            onClick={onMobileClose}
            className="md:hidden h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onChange(item.id);
                onMobileClose?.();
              }}
              className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:translate-x-0.5 ${
                isActive
                  ? "bg-primary-soft text-primary glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <button
          onClick={() => {
            onNew();
            onMobileClose?.();
          }}
          className="w-full rounded-xl bg-primary text-primary-foreground font-medium text-sm py-2.5 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition"
        >
          <Plus className="h-4 w-4" /> New Event
        </button>
      </div>

      <div className="p-3 border-t border-border flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-info grid place-items-center text-xs text-primary-foreground font-semibold">
          JD
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">Jamie Doe</div>
          <div className="text-xs text-muted-foreground truncate">jamie@eventiq.app</div>
        </div>
        <button className="h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      </aside>
    </>
  );
}