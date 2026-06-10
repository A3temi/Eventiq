'use client';

import { useAppStore, type ViewMode } from '@/stores/app-store';
import { MessageSquare, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function ModeToggle() {
  const { mode, setMode } = useAppStore();

  const modes: { id: ViewMode; label: string; icon: typeof MessageSquare }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'whiteboard', label: 'Whiteboard', icon: LayoutGrid },
  ];

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-card border rounded-lg p-1 shadow-sm">
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          className={cn(
            'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
            mode === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {mode === id && (
            <motion.div
              layoutId="mode-indicator"
              className="absolute inset-0 bg-primary/10 rounded-md"
              transition={{ type: 'spring', duration: 0.3 }}
            />
          )}
          <Icon className="w-4 h-4 relative z-10" />
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  );
}
