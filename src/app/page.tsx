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
      <main className="flex-1 flex flex-col relative">
        <ModeToggle />
        {mode === 'chat' ? <ChatPanel /> : <WhiteboardView />}
      </main>
    </div>
  );
}
