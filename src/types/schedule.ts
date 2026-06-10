export interface SessionInput {
  topic: string;
  speakerName: string;
  type: SessionType;
  track?: string;
  constraints?: TimeConstraint[];
}

export type SessionType = 'keynote' | 'talk' | 'workshop' | 'break';

/** Default durations in minutes per session type */
export const SESSION_DURATIONS: Record<SessionType, number> = {
  keynote: 45,
  talk: 20,
  workshop: 60,
  break: 15,
};

export const TRANSITION_BUFFER_MINUTES = 5;

export interface Agenda {
  id: string;
  eventId: string;
  sessions: ScheduledSession[];
  startTime: string;
  endTime: string;
  status: 'draft' | 'finalized';
}

export interface ScheduledSession {
  id: string;
  topic: string;
  speaker: string;
  type: SessionType;
  startTime: string;
  endTime: string;
  duration: number;
  track: string;
  room?: string;
  transitionBuffer: number;
  confirmed: boolean;
  confirmedAt?: string;
}

export interface TimeConstraint {
  type: 'unavailable' | 'preferred';
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface ConflictResult {
  sessionA: string;
  sessionB: string;
  track: string;
  overlapMinutes: number;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  track: string;
  room?: string;
  conflictFree: boolean;
}

export interface FinalizedAgenda {
  publicPage: string; // HTML content
  runOfShow: RunOfShowEntry[];
}

export interface RunOfShowEntry {
  time: string;
  duration: number;
  type: SessionType | 'transition';
  title: string;
  speaker?: string;
  room: string;
  notes?: string;
}
