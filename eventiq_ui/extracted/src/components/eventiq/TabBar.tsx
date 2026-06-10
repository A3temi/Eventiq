import { Menu, Moon, Sun } from "lucide-react";

export type Tab = "calendar" | "events" | "billing";

interface TabBarProps {
  title: string;
  subtitle?: string;
  rightTitle?: string;
  dark: boolean;
  onToggleDark: () => void;
  onMenu?: () => void;
}

export function TabBar({ title, subtitle, rightTitle, dark, onToggleDark, onMenu }: TabBarProps) {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {onMenu && (
            <button
              onClick={onMenu}
              className="md:hidden h-9 w-9 -ml-1 grid place-items-center rounded-xl hover:bg-muted text-muted-foreground shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {rightTitle && (
            <span className="hidden sm:inline text-base sm:text-xl font-bold tracking-tight text-muted-foreground truncate">{rightTitle}</span>
          )}
          <button
            onClick={onToggleDark}
            className="h-9 w-9 grid place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {rightTitle && (
        <div className="sm:hidden px-4 pb-2 text-sm font-semibold text-muted-foreground">{rightTitle}</div>
      )}
    </div>
  );
}