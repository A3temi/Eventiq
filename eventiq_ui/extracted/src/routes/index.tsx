import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Menu, Moon, Sun } from "lucide-react";
import { Sidebar } from "@/components/eventiq/Sidebar";
import { type Tab } from "@/components/eventiq/TabBar";
import { OverviewTab } from "@/components/eventiq/OverviewTab";
import { CalendarPage } from "@/components/eventiq/CalendarPage";
import { BillingPage } from "@/components/eventiq/BillingPage";
import { MyEventsPage } from "@/components/eventiq/MyEventsPage";

import { VendorDetailPanel } from "@/components/eventiq/VendorDetailPanel";
import { NewEventChat } from "@/components/eventiq/NewEventChat";
import { EventAgentChat } from "@/components/eventiq/EventAgentChat";
import { FloatingAgentChat } from "@/components/eventiq/FloatingAgentChat";
import { mockEvents } from "@/lib/eventiq/mock-data";
import type { EventModel, VendorContact } from "@/lib/eventiq/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eventiq — AI Event Planning" },
      { name: "description", content: "Plan any event with a conversational AI agent and a real-time visual overview." },
      { property: "og:title", content: "Eventiq — AI Event Planning" },
      { property: "og:description", content: "Plan any event with a conversational AI agent." },
    ],
  }),
  component: Index,
});

function Index() {
  const [events, setEvents] = useState<EventModel[]>(mockEvents);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("events");
  const [openVendorId, setOpenVendorId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dark, setDark] = useState(false);
  const [eventChatOpen, setEventChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // theme bootstrap
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("eventiq-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enable = stored ? stored === "dark" : prefers;
    setDark(enable);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("eventiq-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeId) ?? null,
    [events, activeId],
  );
  const openVendor = useMemo(
    () => activeEvent?.vendors.find((v) => v.id === openVendorId) ?? null,
    [activeEvent, openVendorId],
  );

  const handleNewEvent = () => {
    setActiveId(null);
    setOpenVendorId(null);
    setTab("events");
    setCreating(true);
    setEventChatOpen(false);
  };

  const handleCreateFromChat = (evt: EventModel) => {
    setEvents((prev) => [evt, ...prev]);
    setCreating(false);
    setActiveId(evt.id);
  };

  const handleVendorUpdate = (patch: Partial<VendorContact>) => {
    if (!activeEvent || !openVendor) return;
    setEvents((prev) =>
      prev.map((e) =>
        e.id === activeEvent.id
          ? {
              ...e,
              vendors: e.vendors.map((v) => (v.id === openVendor.id ? { ...v, ...patch } : v)),
            }
          : e,
      ),
    );
  };

  const handleEventUpdate = (patch: Partial<EventModel>) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => (e.id === activeEvent.id ? { ...e, ...patch } : e)),
    );
  };

  const openEvent = (id: string) => {
    setActiveId(id);
    setTab("events");
    setOpenVendorId(null);
    setEventChatOpen(false);
  };

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
      <Sidebar
        active={tab}
        onChange={(t) => {
          setTab(t);
          if (t !== "events") setActiveId(null);
          setOpenVendorId(null);
          setCreating(false);
          setEventChatOpen(false);
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
                onCreate={handleCreateFromChat}
              />
            )}
            {!creating && (
              <>
            {tab === "calendar" && (
              <CalendarPage events={events} onSelectEvent={openEvent} />
            )}
            {tab === "events" && (
              activeEvent ? (
                <div>
                  <div className="px-4 sm:px-6 pt-4 flex items-center justify-between gap-3 flex-wrap">
                    <button
                      onClick={() => {
                        setActiveId(null);
                        setEventChatOpen(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to all events
                    </button>
                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                      <button
                        onClick={() => setEventChatOpen(false)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                          !eventChatOpen ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Dashboard
                      </button>
                      <button
                        onClick={() => setEventChatOpen(true)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                          eventChatOpen ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Agent chat
                      </button>
                    </div>
                  </div>
                  {eventChatOpen ? (
                    <EventAgentChat event={activeEvent} onClose={() => setEventChatOpen(false)} />
                  ) : (
                    <OverviewTab
                      event={activeEvent}
                      onOpenVendor={setOpenVendorId}
                      onUpdateEvent={handleEventUpdate}
                    />
                  )}
                </div>
              ) : (
                <MyEventsPage events={events} onSelect={openEvent} onNew={handleNewEvent} />
              )
            )}
            {tab === "billing" && <BillingPage />}
              </>
            )}
          </div>
        </div>

        {openVendor && !creating && (
          <VendorDetailPanel
            key={openVendor.id}
            vendor={openVendor}
            onClose={() => setOpenVendorId(null)}
            onUpdate={handleVendorUpdate}
          />
        )}
      </main>

      <FloatingAgentChat events={events} activeEventId={activeId} />
    </div>
  );
}
