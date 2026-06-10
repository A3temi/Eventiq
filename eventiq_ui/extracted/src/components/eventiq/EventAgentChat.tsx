import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, X } from "lucide-react";
import type { EventModel } from "@/lib/eventiq/types";

type Msg = { id: string; role: "user" | "agent"; text: string };

interface Props {
  event: EventModel;
  onClose: () => void;
}

const storageKey = (eventId: string) => `eventiq:chat:${eventId}`;

function loadMessages(eventId: string, eventName: string): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(eventId));
    if (raw) {
      const parsed = JSON.parse(raw) as Msg[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore corrupt entries
  }
  return [
    {
      id: "m0",
      role: "agent",
      text: `Hi! I'm here to help you organize ${eventName}. What would you like to discuss?`,
    },
  ];
}

export function EventAgentChat({ event, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>(() => loadMessages(event.id, event.name));
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reload when switching to a different event
  useEffect(() => {
    setMessages(loadMessages(event.id, event.name));
  }, [event.id, event.name]);

  // Persist on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(event.id), JSON.stringify(messages));
    } catch {
      // storage full or unavailable — ignore
    }
  }, [event.id, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text };
    const agentMsg: Msg = {
      id: `a${Date.now()}`,
      role: "agent",
      text: "Thanks for your message! I'll review the details for your event and get back to you shortly.",
    };
    setMessages((m) => [...m, userMsg, agentMsg]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary grid place-items-center">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Event Agent</div>
            <div className="text-xs text-muted-foreground">Organizing {event.name}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "agent" ? (
              <div className="max-w-[80%] text-sm text-foreground leading-relaxed">{m.text}</div>
            ) : (
              <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm">
                {m.text}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2">
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
            placeholder="Type your message..."
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
  );
}
