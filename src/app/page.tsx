'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Moon, Sun, Menu, Trash2 } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { Sidebar } from '@/components/layout/Sidebar';
import { MyEventsPage } from '@/components/events/MyEventsPage';
import { EventOverview } from '@/components/events/EventOverview';
import { CalendarPage } from '@/components/events/CalendarPage';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { UserMenu } from '@/components/sidebar/UserMenu';

export type Tab = 'events' | 'calendar' | 'billing';

export default function Home() {
  const { data: session } = useSession();
  const { events, activeEventId, setActiveEvent, fetchEvents, deleteEvent } = useAppStore();
  const loadConversation = useChatStore((s) => s.loadConversation);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const [tab, setTab] = useState<Tab>('events');
  const [chatMode, setChatMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeEvent = events.find(e => e.id === activeEventId);

  // When a new event gets created via chat, switch to chat mode for that event
  useEffect(() => {
    if (activeEventId && creating) {
      setCreating(false);
      setChatMode(true);
    }
  }, [activeEventId, creating]);

  // Theme
  useEffect(() => {
    const stored = localStorage.getItem('eventiq-theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(stored ? stored === 'dark' : prefers);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('eventiq-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Fetch events on auth
  useEffect(() => {
    if (session?.user?.email) fetchEvents();
  }, [session, fetchEvents]);

  const handleNewEvent = () => {
    setActiveEvent(null);
    clearMessages();
    setCreating(true);
    setChatMode(true);
  };

  const handleSelectEvent = (id: string) => {
    setActiveEvent(id);
    loadConversation(id);
    setChatMode(false);
    setCreating(false);
  };

  const handleBack = () => {
    setActiveEvent(null);
    setChatMode(false);
    setCreating(false);
    clearMessages();
  };

  const handleDeleteEvent = async () => {
    if (!activeEventId) return;
    await deleteEvent(activeEventId);
    setConfirmDelete(false);
    handleBack();
  };

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        active={tab}
        onChange={(t) => {
          setTab(t);
          if (t !== 'events') { setActiveEvent(null); setChatMode(false); setCreating(false); }
        }}
        onNew={handleNewEvent}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden h-9 w-9 grid place-items-center rounded-xl hover:bg-muted text-muted-foreground"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              {activeEvent && (
                <button
                  onClick={handleBack}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}
              <h1 className="text-lg font-bold tracking-tight truncate">
                {activeEvent ? activeEvent.name : creating ? 'New Event' : tab === 'events' ? 'My Events' : tab === 'calendar' ? 'Calendar' : 'Billing'}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeEvent && (
                <div className="inline-flex rounded-xl border border-border p-0.5 bg-muted/40">
                  <button
                    onClick={() => setChatMode(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${!chatMode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setChatMode(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${chatMode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Agent Chat
                  </button>
                </div>
              )}
              {activeEvent && (
                <div className="relative">
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="h-9 w-9 grid place-items-center rounded-xl border border-border hover:bg-destructive/10 hover:border-destructive/30 text-muted-foreground hover:text-destructive transition"
                    aria-label="Delete event"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {confirmDelete && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setConfirmDelete(false)} />
                      <div className="absolute top-full right-0 mt-2 z-50 bg-popover border rounded-xl shadow-lg p-4 w-56">
                        <p className="text-sm font-medium mb-1">Delete this event?</p>
                        <p className="text-xs text-muted-foreground mb-3">This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border hover:bg-muted transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDeleteEvent}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={() => setDark(d => !d)}
                className="h-9 w-9 grid place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {creating && !activeEvent ? (
            <ChatPanel />
          ) : chatMode && activeEvent ? (
            <ChatPanel />
          ) : activeEvent ? (
            <EventOverview event={activeEvent} />
          ) : tab === 'events' ? (
            <MyEventsPage events={events} onSelect={handleSelectEvent} onNew={handleNewEvent} />
          ) : tab === 'calendar' ? (
            <CalendarPage events={events} onSelectEvent={handleSelectEvent} />
          ) : (
            <BillingSection />
          )}
        </div>
      </main>
    </div>
  );
}

function BillingSection() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <p className="text-sm text-muted-foreground">Credits and billing managed in Settings.</p>
      <a href="/settings" className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90">
        Go to Settings
      </a>
    </div>
  );
}
