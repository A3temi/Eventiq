'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Menu, Moon, Sun } from 'lucide-react';
import { Sidebar } from '@/components/eventiq/Sidebar';
import { type Tab } from '@/components/eventiq/TabBar';
import { OverviewTab } from '@/components/eventiq/OverviewTab';
import { CalendarPage } from '@/components/eventiq/CalendarPage';
import { BillingPage } from '@/components/eventiq/BillingPage';
import { ProvidersPage } from '@/components/eventiq/ProvidersPage';
import { MyEventsPage } from '@/components/eventiq/MyEventsPage';
import { VendorDetailPanel } from '@/components/eventiq/VendorDetailPanel';
import { NewEventChat } from '@/components/eventiq/NewEventChat';
import { EventAgentChat } from '@/components/eventiq/EventAgentChat';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import {
  useEventModelsStore,
  useEventModel,
  useAllEventModels,
} from '@/stores/event-models-store';

type EventView = 'dashboard' | 'chat';

export default function Home() {
  const { data: session } = useSession();

  // Active event lives in the app-store so whiteboard/chat logic keeps working.
  const activeEventId = useAppStore((s) => s.activeEventId);
  const setActiveEvent = useAppStore((s) => s.setActiveEvent);
  const fetchEvents = useAppStore((s) => s.fetchEvents);

  const clearMessages = useChatStore((s) => s.clearMessages);
  const loadConversation = useChatStore((s) => s.loadConversation);

  const fetchAllDetails = useEventModelsStore((s) => s.fetchAllDetails);
  const startPolling = useEventModelsStore((s) => s.startPolling);
  const stopPolling = useEventModelsStore((s) => s.stopPolling);

  const [tab, setTab] = useState<Tab>('events');
  const [openVendorId, setOpenVendorId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dark, setDark] = useState(false);
  const [eventView, setEventView] = useState<EventView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // theme bootstrap
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('eventiq-theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enable = stored ? stored === 'dark' : prefers;
    setDark(enable);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('eventiq-theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);

  // Fetch events once the user is authenticated (mirrors old EventSidebar).
  useEffect(() => {
    if (session?.user?.email) {
      fetchEvents();
    }
  }, [session, fetchEvents]);

  // Adapted view models for every event (summary + cached details).
  const events = useAllEventModels();

  // Hydrate details for all known events so summaries/calendar/providers are rich.
  const idsKey = events.map((e) => e.id).join(',');
  useEffect(() => {
    if (idsKey) void fetchAllDetails(idsKey.split(','));
  }, [idsKey, fetchAllDetails]);

  // Poll event details every 5s for the active event.
  useEffect(() => {
    if (activeEventId) startPolling(activeEventId);
    return () => stopPolling();
  }, [activeEventId, startPolling, stopPolling]);

  const activeEvent = useEventModel(activeEventId);
  const openVendor = useMemo(
    () => activeEvent?.vendors.find((v) => v.id === openVendorId) ?? null,
    [activeEvent, openVendorId],
  );

  const handleNewEvent = () => {
    setActiveEvent(null);
    clearMessages();
    setOpenVendorId(null);
    setTab('events');
    setEventView('dashboard');
    setCreating(true);
  };

  const openEvent = (id: string) => {
    setActiveEvent(id);
    void loadConversation(id);
    setTab('events');
    setOpenVendorId(null);
    setEventView('dashboard');
    setCreating(false);
  };

  const handleBack = () => {
    setActiveEvent(null);
    clearMessages();
    setEventView('dashboard');
    setOpenVendorId(null);
  };

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
      <Sidebar
        active={tab}
        onChange={(t) => {
          setTab(t);
          if (t !== 'events') {
            setActiveEvent(null);
            clearMessages();
          }
          setOpenVendorId(null);
          setCreating(false);
          setEventView('dashboard');
        }}
        onNew={handleNewEvent}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden absolute top-3 left-3 z-20 h-9 w-9 grid place-items-center rounded-xl border border-border bg-background/80 backdrop-blur hover:bg-muted text-muted-foreground shadow-sm"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          {/* Theme toggle (top-right) */}
          <button
            onClick={() => setDark((d) => !d)}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 h-9 w-9 grid place-items-center rounded-xl border border-border bg-background/80 backdrop-blur hover:bg-muted text-muted-foreground shadow-sm"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="flex-1 overflow-y-auto">
            {creating && (
              <NewEventChat
                onCancel={() => setCreating(false)}
                onCreated={(id) => {
                  setCreating(false);
                  openEvent(id);
                }}
              />
            )}
            {!creating && (
              <>
                {tab === 'calendar' && (
                  <CalendarPage events={events} onSelectEvent={openEvent} />
                )}
                {tab === 'providers' && (
                  <ProvidersPage events={events} onOpenEvent={openEvent} />
                )}
                {tab === 'events' &&
                  (activeEvent ? (
                    // h-full column so the chat composer / whiteboard input pin
                    // to the bottom and their message panes scroll internally.
                    <div className="h-full flex flex-col">
                      <div className="shrink-0 px-4 sm:px-6 pt-4 flex flex-col sm:flex-row items-center gap-3">
                        <button
                          onClick={handleBack}
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 sm:absolute sm:left-6"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Back
                        </button>
                        <div className="mx-auto inline-flex rounded-lg border border-border p-1 bg-muted/40">
                          <button
                            onClick={() => setEventView('dashboard')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                              eventView === 'dashboard'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Dashboard
                          </button>
                          <button
                            onClick={() => setEventView('chat')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                              eventView === 'chat'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Agent Chat
                          </button>
                        </div>
                      </div>
                      {eventView === 'chat' && (
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <EventAgentChat
                            event={activeEvent}
                            onClose={() => setEventView('dashboard')}
                          />
                        </div>
                      )}
                      {eventView === 'dashboard' && (
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                          <OverviewTab event={activeEvent} onOpenVendor={setOpenVendorId} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <MyEventsPage events={events} onSelect={openEvent} onNew={handleNewEvent} />
                  ))}
                {tab === 'billing' && <BillingPage />}
              </>
            )}
          </div>
        </div>

        {openVendor && !creating && activeEvent && (
          <VendorDetailPanel
            key={openVendor.id}
            eventId={activeEvent.id}
            vendor={openVendor}
            onClose={() => setOpenVendorId(null)}
          />
        )}
      </main>
    </div>
  );
}
