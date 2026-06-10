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
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
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
              className="absolute inset-0 bg-background border rounded-md shadow-sm"
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
