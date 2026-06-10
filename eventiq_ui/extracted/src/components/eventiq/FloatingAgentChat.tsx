import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageSquare, X, Sparkles, Link2 } from "lucide-react";
import type { EventModel } from "@/lib/eventiq/types";

type Msg = { id: string; role: "user" | "agent"; text: string };

interface Props {
  events: EventModel[];
  activeEventId?: string | null;
}

const GLOBAL_KEY = "eventiq:chat:global";
const eventKey = (id: string) => `eventiq:chat:${id}`;

function loadMessages(key: string, greeting: string): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Msg[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [{ id: "m0", role: "agent", text: greeting }];
}

function detectEvent(text: string, events: EventModel[]): EventModel | null {
  const lower = text.toLowerCase();
  // Prefer longer names first to avoid partial collisions
  const sorted = [...events].sort((a, b) => b.name.length - a.name.length);
  for (const ev of sorted) {
    if (ev.name.length < 3) continue;
    if (lower.includes(ev.name.toLowerCase())) return ev;
  }
  return null;
}

export function FloatingAgentChat({ events, activeEventId }: Props) {
  const [open, setOpen] = useState(false);
  const [linkedId, setLinkedId] = useState<string | null>(activeEventId ?? null);
  const linkedEvent = useMemo(
    () => events.find((e) => e.id === linkedId) ?? null,
    [events, linkedId],
  );

  const currentKey = linkedEvent ? eventKey(linkedEvent.id) : GLOBAL_KEY;
  const greeting = linkedEvent
    ? `Hi! I'm here to help you organize ${linkedEvent.name}. What would you like to discuss?`
    : "Hi! I'm your event assistant. Ask me anything, or mention an event by name to focus our conversation on it.";

  const [messages, setMessages] = useState<Msg[]>(() => loadMessages(currentKey, greeting));
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync linked event when the user navigates into an event
  useEffect(() => {
    if (activeEventId) setLinkedId(activeEventId);
  }, [activeEventId]);

  // Reload thread when key changes
  useEffect(() => {
    setMessages(loadMessages(currentKey, greeting));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(currentKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [currentKey, messages]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text) return;

    // Detect event mention to (re)link the conversation
    const detected = detectEvent(text, events);
    const switching = detected && detected.id !== linkedId;

    if (switching && detected) {
      // Move into that event's thread
      setLinkedId(detected.id);
      const eventMsgs = loadMessages(eventKey(detected.id), `Hi! I'm here to help you organize ${detected.name}.`);
      const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text };
      const agentMsg: Msg = {
        id: `a${Date.now()}`,
        role: "agent",
        text: `Got it — linking this conversation to "${detected.name}". How can I help?`,
      };
      const next = [...eventMsgs, userMsg, agentMsg];
      setMessages(next);
      try {
        window.localStorage.setItem(eventKey(detected.id), JSON.stringify(next));
      } catch {}
      setInput("");
      return;
    }

    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text };
    const agentMsg: Msg = {
      id: `a${Date.now()}`,
      role: "agent",
      text: linkedEvent
        ? `Thanks! I'll look into that for ${linkedEvent.name} and get back to you shortly.`
        : "Thanks! Tell me which event this relates to, or ask me anything to get started.",
    };
    setMessages((m) => [...m, userMsg, agentMsg]);
    setInput("");
  };

  const unlink = () => setLinkedId(null);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 h-14 w-14 grid place-items-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
          aria-label="Open event assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(92vw,380px)] h-[min(80vh,560px)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary-soft text-primary grid place-items-center shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">Event Agent</div>
                <div className="text-xs text-muted-foreground truncate">
                  {linkedEvent ? `Linked to ${linkedEvent.name}` : "General chat"}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {linkedEvent && (
            <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="truncate">Conversation linked to "{linkedEvent.name}"</span>
              </div>
              <button
                onClick={unlink}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                Unlink
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "agent" ? (
                  <div className="max-w-[85%] text-sm text-foreground leading-relaxed">{m.text}</div>
                ) : (
                  <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm">
                    {m.text}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Mention an event by name to link it…"
                className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5 max-h-32"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="h-8 w-8 grid place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}