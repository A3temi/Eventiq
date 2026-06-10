'use client';

import { EventSidebar } from '@/components/sidebar/EventSidebar';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { WhiteboardView } from '@/components/whiteboard/WhiteboardView';
import { ModeToggle } from '@/components/layout/ModeToggle';
import { useAppStore } from '@/stores/app-store';

export default function Home() {
  const mode = useAppStore((s) => s.mode);

  return (
    <div className="flex h-screen overflow-hidden">
      <EventSidebar />
      <main className="flex-1 flex flex-col">
        {/* Top bar with mode toggle */}
        <div className="flex items-center justify-end px-4 py-2 border-b bg-card shrink-0">
          <ModeToggle />
        </div>
        {/* Content area — both panels stay mounted for real-time updates */}
        <div className="flex-1 overflow-hidden relative">
          <div className={mode === 'chat' ? 'h-full' : 'hidden'}>
            <ChatPanel />
          </div>
          <div className={mode === 'whiteboard' ? 'h-full' : 'hidden'}>
            <WhiteboardView />
          </div>
        </div>
      </main>
    </div>
  );
}
