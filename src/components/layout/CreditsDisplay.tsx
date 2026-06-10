'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Sparkles } from 'lucide-react';

export function CreditsDisplay() {
  const { data: session } = useSession();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/credits')
        .then((r) => r.json())
        .then((d) => setCredits(d.balance))
        .catch(() => {});
    }
  }, [session]);

  if (!session || credits === null) return null;

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-card border rounded-full shadow-sm text-xs">
      <Sparkles className="w-3.5 h-3.5 text-primary" />
      <span className="font-medium">{credits}</span>
      <span className="text-muted-foreground">credits</span>
    </div>
  );
}
