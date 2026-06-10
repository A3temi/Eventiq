import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import type { EventModel, EventType } from "@/lib/eventiq/types";
import { eventTypeMeta } from "@/lib/eventiq/meta";

type Msg = { id: string; role: "user" | "agent"; text: string };

interface Props {
  onCancel: () => void;
  onCreate: (evt: EventModel) => void;
}

const SCRIPT: { agent: string; field?: "name" | "type" | "date" | "guests" }[] = [
  {
    agent: "Hi! I'm your Eventiq planning agent. Let's set up a new event together — what would you like to call it?",
    field: "name",
  },
  {
    agent: "Great name! What type of event is this? (wedding, corporate, birthday, launch, social, other)",
    field: "type",
  },
  {
    agent: "When is it? Share a date (YYYY-MM-DD works best).",
    field: "date",
  },
  {
    agent: "Roughly how many guests are you expecting?",
    field: "guests",
  },
  {
    agent: "Perfect — I have everything I need. Tap Create event below and I'll spin up your workspace.",
  },
];

function parseType(input: string): EventType {
  const v = input.toLowerCase().trim();
  const keys = Object.keys(eventTypeMeta) as EventType[];
  const hit = keys.find((k) => v.includes(k));
  return hit ?? "other";
}

export function NewEventChat({ onCancel, onCreate }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "m0", role: "agent", text: SCRIPT[0].agent },
  ]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<{ name?: string; type?: EventType; date?: string; guests?: number }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || step >= SCRIPT.length - 1) return;
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text };

    const current = SCRIPT[step];
    const nextDraft = { ...draft };
    if (current.field === "name") nextDraft.name = text;
    if (current.field === "type") nextDraft.type = parseType(text);
    if (current.field === "date") nextDraft.date = text;
    if (current.field === "guests") {
      const n = parseInt(text.replace(/\D/g, ""), 10);
      if (!Number.isNaN(n)) nextDraft.guests = n;
    }

    const nextStep = step + 1;
    const agentMsg: Msg = {
      id: `a${Date.now()}`,
      role: "agent",
      text: SCRIPT[nextStep].agent,
    };

    setMessages((m) => [...m, userMsg, agentMsg]);
    setInput("");
    setDraft(nextDraft);
    setStep(nextStep);
  };

  const ready = step >= SCRIPT.length - 1;

  const create = () => {
    const id = `evt-${Date.now()}`;
    let iso = new Date(Date.now() + 30 * 86400000).toISOString();
    if (draft.date) {
      const d = new Date(draft.date);
      if (!Number.isNaN(d.getTime())) iso = d.toISOString();
    }
    const evt: EventModel = {
      id,
      name: draft.name || "Untitled event",
      status: "draft",
      type: draft.type ?? "other",
      date: iso,
      updatedAt: new Date().toISOString(),
      attendees: draft.guests ? { count: draft.guests, confirmed: 0 } : undefined,
      vendors: [],
      milestones: [],
    };
    onCreate(evt);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary grid place-items-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">New event with Eventiq</div>
            <div className="text-xs text-muted-foreground">Chat with the agent to set up your event</div>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "agent" ? (
              <div className="max-w-[80%] text-sm text-foreground leading-relaxed">
                {m.text}
              </div>
            ) : (
              <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm">
                {m.text}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border p-4">
        {ready ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Draft: <span className="text-foreground font-medium">{draft.name || "Untitled"}</span>
              {draft.type && <> · {eventTypeMeta[draft.type].label}</>}
              {draft.date && <> · {draft.date}</>}
              {draft.guests && <> · {draft.guests} guests</>}
            </div>
            <button
              onClick={create}
              className="rounded-xl bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              Create event
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}