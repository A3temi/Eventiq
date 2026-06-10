'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogOut, Settings } from 'lucide-react';
import { useState } from 'react';

export function UserMenu() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="p-3 border-t border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-2.5 w-28 bg-muted/60 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-3 p-3 border-t border-border w-full hover:bg-muted/60 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium">?</div>
        <div className="text-left">
          <div className="text-sm font-medium">Sign in</div>
          <div className="text-[11px] text-muted-foreground">with Google</div>
        </div>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-3 p-3 border-t border-border w-full hover:bg-muted/60 transition-colors"
      >
        {session.user?.image ? (
          <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-xs text-primary-foreground font-semibold">
            {session.user?.name?.charAt(0) || 'U'}
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium truncate">{session.user?.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{session.user?.email}</div>
        </div>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-popover border rounded-xl shadow-lg z-50 p-1">
            <a
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              Settings & Credits
            </a>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors w-full text-left text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
