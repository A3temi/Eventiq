'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { User, LogOut, Settings, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  // Loading skeleton
  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 p-3 border-t">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-2 w-28 bg-muted rounded animate-pulse mt-1" />
        </div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-2 p-3 border-t w-full hover:bg-accent transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">Sign in</div>
          <div className="text-xs text-muted-foreground">with Google</div>
        </div>
      </button>
    );
  }

  // Logged in
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 p-3 border-t w-full hover:bg-accent transition-colors"
      >
        {session.user?.image ? (
          <img
            src={session.user.image}
            alt=""
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
            {session.user?.name?.charAt(0) || 'U'}
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium truncate">{session.user?.name}</div>
          <div className="text-xs text-muted-foreground truncate">{session.user?.email}</div>
        </div>
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border rounded-lg shadow-lg z-50 p-1">
            <a
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Settings
            </a>
            <a
              href="/settings#credits"
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <CreditCard className="w-4 h-4" />
              Credits
            </a>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors w-full text-left text-destructive"
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
