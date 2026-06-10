'use client';

import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Calendar,
  MapPin,
  Utensils,
  Clock,
  Users,
  Lightbulb,
  CheckCircle,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Shared Types
   ───────────────────────────────────────────── */

interface CenterStatusData {
  name: string;
  status: string;
  date?: string;
}

interface DateTimeData {
  confirmedDate?: string;
  confirmedTime?: string;
}

interface VenueData {
  name?: string;
  price?: string;
  url?: string;
  confirmed: boolean;
}

interface CateringData {
  name?: string;
  price?: string;
  confirmed: boolean;
}

interface ScheduleItem {
  time: string;
  title: string;
  speaker?: string;
}

interface ScheduleData {
  items: ScheduleItem[];
}

interface ContactItem {
  name?: string;
  phone?: string;
  email?: string;
  status?: 'confirmed' | 'pending' | 'messaging';
}

interface ContactsData {
  contacts: ContactItem[];
  attendeeCount: number;
}

interface TopicsData {
  topics: string[];
  confirmedTopics?: string[];
}

/* ─────────────────────────────────────────────
   CenterStatusNode
   ───────────────────────────────────────────── */

export const CenterStatusNode = memo(function CenterStatusNode({
  data,
}: {
  data: CenterStatusData;
}) {
  const isConfirmed = data.status === 'confirmed' || data.status === 'completed';
  const isInProgress = data.status === 'in-progress' || data.status === 'planning';

  return (
    <div className="relative">
      {isInProgress && (
        <div className="absolute -inset-2 rounded-2xl border-2 border-blue-400 animate-pulse opacity-50" />
      )}
      <div
        className={cn(
          'min-w-[220px] max-w-[280px] rounded-2xl border-2 p-5 shadow-md bg-card text-center',
          isConfirmed && 'border-green-400 bg-green-50/50',
          isInProgress && 'border-blue-400 bg-blue-50/50',
          !isConfirmed && !isInProgress && 'border-gray-300 bg-card'
        )}
      >
        <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" id="left" />
        <Handle type="target" position={Position.Right} className="!opacity-0 !w-0 !h-0" id="right" />
        <Handle type="target" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" id="bottom" />

        <div className="flex items-center justify-center gap-2 mb-2">
          {isConfirmed ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <Clock className="w-5 h-5 text-blue-500" />
          )}
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              isConfirmed && 'bg-green-100 text-green-700',
              isInProgress && 'bg-blue-100 text-blue-700',
              !isConfirmed && !isInProgress && 'bg-gray-100 text-gray-600'
            )}
          >
            {data.status}
          </span>
        </div>

        <h3 className="font-semibold text-base leading-tight">{data.name}</h3>

        {data.date && (
          <p className="text-xs text-muted-foreground mt-1">{data.date}</p>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   DateTimeNode
   ───────────────────────────────────────────── */

export const DateTimeNode = memo(function DateTimeNode({
  data,
}: {
  data: DateTimeData;
}) {
  const confirmed = !!data.confirmedDate;

  return (
    <div
      className={cn(
        'min-w-[170px] max-w-[220px] rounded-xl border-2 p-3 shadow-sm bg-card',
        confirmed
          ? 'border-green-400 bg-green-50/50'
          : 'border-dashed border-yellow-400 bg-yellow-50/30'
      )}
    >
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />

      <div className="flex items-center gap-2">
        <Calendar
          className={cn(
            'w-4 h-4 shrink-0',
            confirmed ? 'text-green-500' : 'text-yellow-500'
          )}
        />
        <span className="text-sm font-medium">Date & Time</span>
      </div>

      <div className="mt-2 pl-6">
        {confirmed ? (
          <>
            <p className="text-sm font-medium text-foreground">{data.confirmedDate}</p>
            {data.confirmedTime && (
              <p className="text-xs text-muted-foreground">{data.confirmedTime}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Pending</p>
        )}
      </div>

      {confirmed && (
        <div className="mt-2 pl-6">
          <div className="w-full h-1 rounded-full bg-green-200">
            <div className="h-1 rounded-full bg-green-500 w-full" />
          </div>
        </div>
      )}
      {!confirmed && (
        <div className="mt-2 pl-6">
          <div className="w-full h-1 rounded-full bg-yellow-200">
            <div className="h-1 rounded-full bg-yellow-400 w-1/4" />
          </div>
        </div>
      )}
    </div>
  );
});

/* ─────────────────────────────────────────────
   VenueNode
   ───────────────────────────────────────────── */

export const VenueNode = memo(function VenueNode({
  data,
}: {
  data: VenueData;
}) {
  return (
    <div
      className={cn(
        'min-w-[170px] max-w-[220px] rounded-xl border-2 p-3 shadow-sm bg-card',
        data.confirmed
          ? 'border-green-400 bg-green-50/50'
          : 'border-dashed border-yellow-400 bg-yellow-50/30'
      )}
    >
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />

      <div className="flex items-center gap-2">
        <MapPin
          className={cn(
            'w-4 h-4 shrink-0',
            data.confirmed ? 'text-green-500' : 'text-yellow-500'
          )}
        />
        <span className="text-sm font-medium">Venue</span>
      </div>

      <div className="mt-2 pl-6">
        {data.name ? (
          <>
            <p className="text-sm font-medium text-foreground">{data.name}</p>
            {data.price && (
              <p className="text-xs text-muted-foreground">{data.price}</p>
            )}
            {data.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Pending</p>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   CateringNode
   ───────────────────────────────────────────── */

export const CateringNode = memo(function CateringNode({
  data,
}: {
  data: CateringData;
}) {
  return (
    <div
      className={cn(
        'min-w-[170px] max-w-[220px] rounded-xl border-2 p-3 shadow-sm bg-card',
        data.confirmed
          ? 'border-green-400 bg-green-50/50'
          : 'border-dashed border-yellow-400 bg-yellow-50/30'
      )}
    >
      <Handle type="source" position={Position.Left} className="!opacity-0 !w-0 !h-0" />

      <div className="flex items-center gap-2">
        <Utensils
          className={cn(
            'w-4 h-4 shrink-0',
            data.confirmed ? 'text-green-500' : 'text-yellow-500'
          )}
        />
        <span className="text-sm font-medium">Catering</span>
      </div>

      <div className="mt-2 pl-6">
        {data.name ? (
          <>
            <p className="text-sm font-medium text-foreground">{data.name}</p>
            {data.price && (
              <p className="text-xs text-muted-foreground">{data.price}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Pending</p>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   ScheduleNode
   ───────────────────────────────────────────── */

export const ScheduleNode = memo(function ScheduleNode({
  data,
}: {
  data: ScheduleData;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasItems = data.items.length > 0;

  return (
    <div
      className={cn(
        'min-w-[180px] max-w-[240px] rounded-xl border-2 p-3 shadow-sm bg-card',
        hasItems
          ? 'border-green-400 bg-green-50/50'
          : 'border-dashed border-yellow-400 bg-yellow-50/30'
      )}
    >
      <Handle type="source" position={Position.Top} className="!opacity-0 !w-0 !h-0" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock
            className={cn(
              'w-4 h-4 shrink-0',
              hasItems ? 'text-green-500' : 'text-yellow-500'
            )}
          />
          <span className="text-sm font-medium">Agenda</span>
        </div>
        {hasItems && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-muted transition-colors"
          >
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                expanded && 'rotate-180'
              )}
            />
          </button>
        )}
      </div>

      <div className="mt-2 pl-6">
        {hasItems ? (
          <>
            {!expanded && (
              <p className="text-xs text-muted-foreground">
                {data.items.length} item{data.items.length !== 1 ? 's' : ''} scheduled
              </p>
            )}
            {expanded && (
              <div className="space-y-1.5">
                {data.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-muted-foreground whitespace-nowrap">
                      {item.time}
                    </span>
                    <span className="text-foreground">{item.title}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">No agenda yet</p>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   ContactsNode
   ───────────────────────────────────────────── */

export const ContactsNode = memo(function ContactsNode({
  data,
}: {
  data: ContactsData;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContacts = data.contacts.length > 0 || data.attendeeCount > 0;
  const count = data.contacts.length || data.attendeeCount;

  const statusIcon = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return '✓';
      case 'messaging':
        return '📱';
      default:
        return '⏳';
    }
  };

  return (
    <div
      className={cn(
        'min-w-[170px] max-w-[220px] rounded-xl border-2 p-3 shadow-sm bg-card',
        hasContacts
          ? 'border-blue-400 bg-blue-50/50'
          : 'border-dashed border-yellow-400 bg-yellow-50/30'
      )}
    >
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users
            className={cn(
              'w-4 h-4 shrink-0',
              hasContacts ? 'text-blue-500' : 'text-yellow-500'
            )}
          />
          <span className="text-sm font-medium">Contacts</span>
        </div>
        {data.contacts.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-muted transition-colors"
          >
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                expanded && 'rotate-180'
              )}
            />
          </button>
        )}
      </div>

      <div className="mt-2 pl-6">
        {hasContacts ? (
          <>
            {!expanded && (
              <p className="text-xs text-muted-foreground">
                {count} contact{count !== 1 ? 's' : ''}
              </p>
            )}
            {expanded && (
              <div className="space-y-1.5">
                {data.contacts.map((contact, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span>{statusIcon(contact.status)}</span>
                    <span className="text-foreground truncate">
                      {contact.name || contact.phone || contact.email || 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">No contacts</p>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   TopicsNode
   ───────────────────────────────────────────── */

export const TopicsNode = memo(function TopicsNode({
  data,
}: {
  data: TopicsData;
}) {
  const hasTopics = data.topics.length > 0;
  const confirmedSet = new Set(data.confirmedTopics || []);

  return (
    <div
      className={cn(
        'min-w-[170px] max-w-[240px] rounded-xl border-2 p-3 shadow-sm bg-card',
        hasTopics
          ? 'border-green-400 bg-green-50/50'
          : 'border-dashed border-yellow-400 bg-yellow-50/30'
      )}
    >
      <Handle type="source" position={Position.Top} className="!opacity-0 !w-0 !h-0" />

      <div className="flex items-center gap-2">
        <Lightbulb
          className={cn(
            'w-4 h-4 shrink-0',
            hasTopics ? 'text-green-500' : 'text-yellow-500'
          )}
        />
        <span className="text-sm font-medium">Topics</span>
      </div>

      <div className="mt-2 pl-6">
        {hasTopics ? (
          <div className="flex flex-wrap gap-1">
            {data.topics.map((topic, i) => (
              <span
                key={i}
                className={cn(
                  'inline-block text-xs px-2 py-0.5 rounded-full',
                  confirmedSet.has(topic)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                {topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No topics yet</p>
        )}
      </div>
    </div>
  );
});
