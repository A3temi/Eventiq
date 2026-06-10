'use client';

import { EventSidebar } from '@/components/sidebar/EventSidebar';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { WhiteboardView } from '@/components/whiteboard/WhiteboardView';
import { WhiteboardInput } from '@/components/whiteboard/WhiteboardInput';
import { ModeToggle } from '@/components/layout/ModeToggle';
import { CreditsDisplay } from '@/components/layout/CreditsDisplay';
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
        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {mode === 'chat' ? <ChatPanel /> : <WhiteboardView />}
        </div>
      </main>
    </div>
  );
}
