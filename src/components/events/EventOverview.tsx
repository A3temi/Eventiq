'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Users, Wallet, Clock, UtensilsCrossed, MapPin, Camera, ImagePlus, CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useChatStore } from '@/stores/chat-store';
import type { EventSummary } from '@/types/event';

interface Props {
  event: EventSummary;
}

interface EventDetail {
  attendeeCount: number;
  location?: string;
  type?: string;
  date: string;
  status: string;
}

const STEPS = [
  { key: 'planning', label: 'Planning' },
  { key: 'venue', label: 'Venues confirmed' },
  { key: 'vendors', label: 'Vendors booked' },
  { key: 'payments', label: 'Payments done' },
  { key: 'ready', label: 'Ready' },
];

export function EventOverview({ event }: Props) {
  const messages = useChatStore((s) => s.messages);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load cover image
  useEffect(() => {
    const saved = localStorage.getItem(`eventiq:cover:${event.id}`);
    if (saved) setCoverImage(saved);
  }, [event.id]);

  // Fetch full event detail
  useEffect(() => {
    fetch(`/api/events/${event.id}/detail`)
      .then(r => r.json())
      .then(d => { if (d.event) setDetail(d.event); })
      .catch(() => {});
  }, [event.id, messages.length]); // re-fetch when messages change

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCoverImage(result);
      localStorage.setItem(`eventiq:cover:${event.id}`, result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Extract data from chat messages ────────────────────────────────────

  const schedule: { time: string; title: string }[] = [];
  const vendors: { name: string; type: string; url?: string }[] = [];
  let cateringName = '';
  let venueName = '';
  const budgetItems: { label: string; value: string }[] = [];
  let budgetTotal = '';

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    const content = msg.content || '';

    // Extract schedule from ALL messages (use the last/most complete one)
    const msgSchedule: { time: string; title: string }[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const cleanLine = line.replace(/\*+/g, '').trim();
      if (!cleanLine) continue;
      
      let m: RegExpMatchArray | null = null;

      // "| 09:00 - 10:00 | Title | Details |" (markdown table)
      m = cleanLine.match(/\|\s*(\d{1,2}[:.]\d{2})\s*[-–]\s*\d{1,2}[:.]\d{2}\s*\|\s*(.+?)\s*\|/);
      if (m) { msgSchedule.push({ time: m[1], title: m[2].trim() }); continue; }

      // "9:00 AM - 10:00 AM | Title" or "9:00 - 10:00 | Title"
      m = cleanLine.match(/(\d{1,2}[:.]\d{2})\s*(?:AM|PM)?\s*[-–]\s*\d{1,2}[:.]\d{2}\s*(?:AM|PM)?\s*\|\s*(.+)/i);
      if (m) { msgSchedule.push({ time: m[1], title: m[2].replace(/\|.*$/, '').trim() }); continue; }

      // "9:00 AM - Title" or "9:00AM - Title" (most common agent format)
      m = cleanLine.match(/^(\d{1,2}[:.]\d{2})\s*(?:AM|PM)\s*[-–]\s*(.{4,})/i);
      if (m && !m[2].match(/^\d{1,2}[:.]\d{2}/)) { msgSchedule.push({ time: m[1], title: m[2].trim() }); continue; }

      // "9:00 - 10:00: Title" or "9:00: Title"
      m = cleanLine.match(/^(\d{1,2}[:.]\d{2})\s*(?:[-–]\s*\d{1,2}[:.]\d{2})?\s*:\s*(.{4,})/);
      if (m) { msgSchedule.push({ time: m[1], title: m[2].trim() }); continue; }

      // "9:00 | Title"
      m = cleanLine.match(/^(\d{1,2}[:.]\d{2})\s*(?:AM|PM)?\s*\|\s*(.{4,})/i);
      if (m) { msgSchedule.push({ time: m[1], title: m[2].replace(/\|.*$/, '').trim() }); continue; }
    }
    // Use the longest schedule found (most complete)
    if (msgSchedule.length > schedule.length) {
      schedule.length = 0;
      schedule.push(...msgSchedule);
    }

    // Collect vendors from options metadata
    if (msg.metadata?.options && Array.isArray(msg.metadata.options)) {
      for (const opt of msg.metadata.options as any[]) {
        if (opt.name && opt.url && !vendors.find(v => v.name === opt.name)) {
          vendors.push({ name: opt.name, type: opt.type || 'vendor', url: opt.url });
        }
      }
    }

    // Parse vendors from numbered lists in content (fallback)
    // ONLY accept items that have a URL — real vendors always have websites
    const contentLines = content.split('\n');
    for (const line of contentLines) {
      const nameMatch = line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[-–—:]\s*(.+)/);
      if (nameMatch) {
        const name = nameMatch[1].replace(/\*+/g, '').trim();
        if (name.match(/^\d{1,2}[:.]\d{2}/) || name.length < 4 || name.length > 60) continue;
        if (name.match(/^(Book|Confirm|Secure|Send|Get|Find|Check|Review|Finalize|Order|Arrange|Contact|Follow|Set up|Create|Plan|Prepare|Schedule|Hire|Research|Notify|Place|Next|Immediate|Your|The |This |Here|Monitor|Backup|Payment|Coordinate|Call|Prepare|Total)/i)) continue;
        if (!name.match(/^[A-Z0-9]/)) continue;
        
        // REQUIRE a URL to be a real vendor
        const urlInLine = line.match(/(https?:\/\/[^\s)>"]+)/);
        if (!urlInLine) continue;
        
        const desc = nameMatch[2].replace(/\*+/g, '').trim();
        let type = 'vendor';
        if (/venue|space|room|hall|auditorium|expo|hotel|mansion/i.test(name + ' ' + desc)) type = 'venue';
        else if (/cater|food|buffet|menu|cuisine|kitchen|bbq|roast/i.test(name + ' ' + desc)) type = 'food';
        else if (/AV|audio|visual|rental|screen|LED/i.test(name + ' ' + desc)) type = 'av';

        if (!vendors.find(v => v.name === name)) {
          vendors.push({ name, type, url: urlInLine?.[1] });
        }
      }
    }
  }

  // ─── Extract budget from messages ──────────────────────────────────────

  if (budgetItems.length === 0) {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      const content = msg.content || '';
      
      // Skip messages without budget-related content
      if (!/budget|cost|total|SGD|\$\d/i.test(content)) continue;
      
      const lines = content.split('\n');
      for (const line of lines) {
        // Match markdown table: "| Venue | 8,000 |" or "| Venue | SGD $8,000 |" or "| Venue | SGD 8,000 |"
        const tableMatch = line.match(/\|\s*([A-Za-z\s&()]+?)\s*\|\s*(?:SGD\s*)?(?:\$\s*)?([\d,]+(?:[-–][\d,]*)?)\s*\|/);
        if (tableMatch) {
          const label = tableMatch[1].trim();
          const amount = tableMatch[2].trim();
          if (/venue|cater|AV|equip|speak|photo|decor|transport|activ|misc|team|contingency|lunch|dinner|coffee|cocktail/i.test(label) && !budgetItems.find(b => b.label === label)) {
            budgetItems.push({ label, value: `SGD $${amount}` });
          }
          if (/total/i.test(label) && !budgetTotal) {
            budgetTotal = `SGD $${amount}`;
          }
          continue;
        }

        // Match: "Venue: SGD $8,000" or "Venue: $8,000" or "Catering (150 pax): SGD 6,000"
        const colonMatch = line.match(/^[•\-*|]?\s*([A-Za-z\s()&]+?):\s*(?:SGD\s*)?(?:\$\s*)?([\d,]+)/);
        if (colonMatch) {
          const label = colonMatch[1].trim();
          const amount = colonMatch[2].trim();
          if (/venue|cater|AV|equip|speak|photo|decor|transport|activ|misc|team|contingency/i.test(label) && !budgetItems.find(b => b.label === label)) {
            budgetItems.push({ label, value: `SGD $${amount}` });
          }
          if (/total/i.test(label) && !budgetTotal) {
            budgetTotal = `SGD $${amount}`;
          }
        }

        // Match "SGD X,XXX" on a line with a category keyword before it
        const sgdMatch = line.match(/([A-Za-z\s&]+?)\s*[-–|:]\s*(?:SGD\s*)?(?:\$\s*)?([\d,]+)/);
        if (sgdMatch && !tableMatch && !colonMatch) {
          const label = sgdMatch[1].trim();
          const amount = sgdMatch[2].trim();
          if (/venue|cater|AV|equip|speak|photo|decor|transport|activ|misc|team|contingency/i.test(label) 
              && parseInt(amount.replace(/,/g, '')) >= 500
              && !budgetItems.find(b => b.label === label)) {
            budgetItems.push({ label, value: `SGD $${amount}` });
          }
        }
      }

      // Also check for "Total: SGD 40,000" pattern
      if (!budgetTotal) {
        const totalMatch = content.match(/TOTAL[:\s|]*(?:SGD\s*)?[\$]?\s*([\d,]+)/i);
        if (totalMatch) budgetTotal = `SGD $${totalMatch[1]}`;
      }

      if (budgetItems.length > 0) break;
    }
  }

  // Fallback: extract total budget from user message if not found in agent responses
  if (!budgetTotal) {
    for (const msg of messages) {
      const content = msg.content || '';
      const budgetMatch = content.match(/budget\s*(?:is|of|:)?\s*(?:SGD\s*)?(?:\$\s*)?([\d,]+)/i);
      if (budgetMatch) {
        budgetTotal = `SGD $${budgetMatch[1]}`;
        break;
      }
    }
  }

  // ─── Extract confirmed choices from user messages ──────────────────────

  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const content = msg.content.toLowerCase();
    
    if (/\b(finalize|go with|book|confirm|select|choose|i'll take|proceed with|create.*with|create.*schedule.*with)\b/i.test(msg.content)) {
      // Match vendor names from the vendors list
      for (const v of vendors) {
        const shortName = v.name.toLowerCase().slice(0, 10);
        if (content.includes(shortName)) {
          if ((v.type === 'food' || /cater|buffet|food|bbq|kitchen/i.test(v.name)) && !cateringName) {
            cateringName = v.name;
          }
          if ((v.type === 'venue' || /hall|expo|space|mansion|room|auditorium/i.test(v.name)) && !venueName) {
            venueName = v.name;
          }
        }
      }

      // Direct name extraction from user text (even if not in vendors list)
      // Match patterns like "with MIT Space" or "and Charlie's Catering"
      const withMatch = msg.content.match(/(?:with|at|use|book)\s+([A-Z][A-Za-z'\s]+?)(?:\s+(?:and|for|but|,)|$)/gi);
      if (withMatch) {
        for (const match of withMatch) {
          const name = match.replace(/^(?:with|at|use|book)\s+/i, '').replace(/\s+(?:and|for|but|,).*$/, '').trim();
          if (name.length < 3 || name.length > 50) continue;
          if (/cater|food|bbq|kitchen|buffet/i.test(name) && !cateringName) cateringName = name;
          else if (!venueName && !/don't|but|and|the|this|that/i.test(name)) venueName = name;
        }
      }

      // Also try "X and Y" or "X for the venue and Y for food" patterns
      const andMatch = msg.content.match(/(?:finalize|with|book|use|at|confirm)\s+(.+?)\s+(?:and|&)\s+(.+?)(?:\s+for|\s+but|\.\s*|\s*$)/i);
      if (andMatch) {
        const part1 = andMatch[1].replace(/\s+for the venue|\s+for venue/i, '').trim();
        const part2 = andMatch[2].replace(/\s+for food|\s+for the food|\s+for catering/i, '').trim();
        // Assign based on keywords in name or the "for X" context
        if (/cater|food|bbq|kitchen|buffet/i.test(part2) && !cateringName) cateringName = part2.slice(0, 50);
        else if (/cater|food|bbq|kitchen|buffet/i.test(part1) && !cateringName) cateringName = part1.slice(0, 50);
        if (/cove|space|venue|hall|expo|mansion|room/i.test(part1) && !venueName) venueName = part1.slice(0, 50);
        else if (!venueName && !/cater|food/i.test(part1)) venueName = part1.slice(0, 50);
      }
    }
  }

  // Also check assistant confirmations (when agent says "VENUE: X" or "MIT Space" in header)
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    const content = msg.content;
    
    if (/\b(confirm|finalize|locked|official|EVENT SCHEDULE)\b/i.test(content)) {
      // Match "| MIT Space" or "Venue: MIT Space" patterns
      const venueMatch = content.match(/(?:VENUE|Location|Venue)[:\s|]+\*?\*?([A-Z][^\n|*]+?)(?:\*\*|\n|\||$)/i);
      if (venueMatch && !venueName) venueName = venueMatch[1].trim();
      
      const cateringMatch = content.match(/(?:CATERING|Catering|caterer)[:\s|]+\*?\*?([A-Z][^\n|*]+?)(?:\*\*|\n|\||$)/i);
      if (cateringMatch && !cateringName) {
        const catName = cateringMatch[1].trim();
        // Skip section headers like "Options", "Available", "Requirements"
        if (!/^(Options|Available|Requirements|Budget|Setup|Confirmed|Service|Menu)/i.test(catName) && catName.length > 3) {
          cateringName = catName;
        }
      }

      // Also match from title line: "Sunday, June 14, 2026 | MIT Space"
      const titleMatch = content.match(/\d{4}\s*\|\s*([A-Z][A-Za-z\s']+?)(?:\n|$)/);
      if (titleMatch && !venueName) venueName = titleMatch[1].trim();
    }
  }

  // Clean up names
  if (venueName) venueName = venueName.replace(/\*+/g, '').replace(/\(.*\)/, '').trim().slice(0, 50);
  if (cateringName) cateringName = cateringName.replace(/\*+/g, '').replace(/\(.*\)/, '').trim().slice(0, 50);

  // Validate venue name — reject if it looks like a description fragment
  if (venueName && /^(with |for |and |the |a |in |at |from |to |by )/i.test(venueName)) {
    venueName = '';
  }
  if (venueName && venueName.length < 4) venueName = '';

  // Use detail data, but user confirmations override
  const guests = detail?.attendeeCount || 0;
  // Ignore DynamoDB location — it's unreliable. Only use user-confirmed venueName.

  // Map/display
  const displayLocation = venueName ? `${venueName}, Singapore` : '';
  const mapQuery = venueName ? `${venueName} Singapore` : '';

  // Checklist
  const hasDate = !!(event.date || detail?.date);
  const hasVenue = !!venueName || vendors.some(v => v.type === 'venue');
  const hasCatering = !!cateringName || vendors.some(v => v.type === 'food');
  const hasSchedule = schedule.length > 0;
  const hasComms = messages.some(m => m.metadata?.toolsUsed && (m.metadata.toolsUsed as string[]).some(t => t === 'send_whatsapp' || t === 'send_email'));

  const checklist = [
    { label: 'Event created', done: true },
    { label: 'Date set', done: hasDate },
    { label: 'Venue confirmed', done: hasVenue },
    { label: 'Catering arranged', done: hasCatering },
    { label: 'Schedule created', done: hasSchedule },
    { label: 'Vendors contacted', done: hasComms || vendors.length > 0 },
  ];

  // Delivery tracker
  const completed = [true, hasVenue, vendors.length > 0 || hasCatering, false, event.status === 'completed'];
  const currentIdx = completed.findIndex(c => !c);
  const lastDone = currentIdx === -1 ? STEPS.length - 1 : currentIdx - 1;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Cover */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/40 h-36 sm:h-48 group">
        {coverImage ? (
          <img src={coverImage} alt={event.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Camera className="h-7 w-7" />
              <span className="text-sm font-medium">Add a picture of your event</span>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium border border-border shadow-sm hover:bg-background transition"
        >
          <ImagePlus className="h-3.5 w-3.5" /> {coverImage ? 'Change photo' : 'Upload photo'}
        </button>
      </div>

      {/* Delivery Tracker */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-center min-w-[480px]">
          {STEPS.map((step, i) => {
            const done = completed[i];
            const current = i === currentIdx;
            return (
              <div key={step.key} className="flex-1 flex items-center last:flex-none">
                <div className="flex flex-col items-center text-center">
                  <div className={cn(
                    'h-8 w-8 rounded-full grid place-items-center text-xs font-semibold',
                    done ? 'bg-primary text-primary-foreground'
                      : current ? 'bg-card border-2 border-primary text-primary'
                      : 'bg-muted text-muted-foreground border border-border'
                  )}>
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className={cn('mt-2 text-xs', done || current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                    {step.label}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mx-2 sm:mx-3 rounded', i <= lastDone ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KeyCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label="Guests"
          value={guests > 0 ? `${guests}` : '—'}
          sub={guests > 0 ? 'expected' : 'Not set'}
        />
        <KeyCard
          icon={<Wallet className="h-5 w-5 text-primary" />}
          label="Budget"
          value={budgetTotal || '—'}
          sub={budgetTotal ? `${budgetItems.length} categories` : 'Not set'}
        />
        <KeyCard
          icon={<UtensilsCrossed className="h-5 w-5 text-primary" />}
          label="Catering"
          value={cateringName || '—'}
          sub={cateringName ? 'Confirmed' : 'Pending'}
        />
      </div>

      {/* Checklist — always shown */}
      <div className="card-soft p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-4">
          <ListChecks className="h-3.5 w-3.5" /> Checklist
        </div>
        <ul className="space-y-2">
          {checklist.map((item, i) => (
            <li key={i} className="flex items-center gap-3 text-sm rounded-lg px-2 py-1.5 hover:bg-muted/40">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={item.done ? 'line-through text-muted-foreground' : ''}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Budget — always shown */}
      <div className="card-soft p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-4">
          <Wallet className="h-3.5 w-3.5" /> Budget Estimate
        </div>
        {budgetItems.length > 0 ? (
          <div className="space-y-2">
            {budgetItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
            {budgetTotal && (
              <div className="flex items-center justify-between text-sm pt-2 font-semibold">
                <span>Total</span>
                <span className="text-primary">{budgetTotal}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ask the agent for a budget estimate to see it here.</p>
        )}
      </div>

      {/* Schedule — always shown */}
      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <Clock className="h-3.5 w-3.5" /> Schedule
          </div>
          <span className="text-xs text-muted-foreground">{event.date ? formatDate(event.date) : ''}</span>
        </div>
        {schedule.length > 0 ? (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {schedule.map((s, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr] gap-3 py-2.5 items-start">
                <div className="text-xs font-mono text-muted-foreground pt-1">{s.time}</div>
                <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2">
                  <div className="text-sm font-medium">{s.title}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ask the agent to create a schedule for this event.</p>
        )}
      </div>

      {/* Location + Map */}
      {mapQuery && (
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
              <MapPin className="h-3.5 w-3.5" /> Location
            </div>
            <span className="text-xs font-medium text-foreground truncate max-w-[180px]">{venueName}</span>
          </div>
          <div className="text-xs text-muted-foreground mb-3">{displayLocation}</div>
          <div className="rounded-xl overflow-hidden border border-border h-64">
            <iframe
              title="Event location"
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}

      {/* Vendor Contacts Table */}
      {vendors.length > 0 && (
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
              <Users className="h-3.5 w-3.5" /> Vendor Contacts
            </div>
            <span className="text-xs text-muted-foreground">{vendors.length} vendors</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Vendor</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium hidden sm:table-cell">Website</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-3 font-medium">{v.name}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground capitalize">{v.type}</td>
                    <td className="py-2.5 pr-3 hidden sm:table-cell">
                      {v.url ? (
                        <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                          {v.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-status-warning/10 text-status-warning ring-1 ring-inset ring-status-warning/20">
                        Awaiting confirmation
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="card-soft p-8 text-center">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="font-semibold mb-1">No confirmed details yet</h3>
          <p className="text-sm text-muted-foreground">Chat with the agent to start planning.</p>
        </div>
      )}
    </div>
  );
}

function KeyCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="relative card-soft p-4 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary/80" />
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
          <div className="mt-0.5 text-lg font-bold truncate">{value}</div>
          {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
