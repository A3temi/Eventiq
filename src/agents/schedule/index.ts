import { generateText } from 'ai';
import { fastModel } from '@/lib/ai-gateway';
import type { AgentTask } from '@/types/agents';
import type { EventBrief } from '@/types/event';
import { SESSION_DURATIONS, TRANSITION_BUFFER_MINUTES } from '@/types/schedule';
import type { ScheduledSession, Agenda, ConflictResult } from '@/types/schedule';

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export async function handleScheduleTask(
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  const params = task.parameters;

  if (params.sessions) {
    return createAgenda(event, params);
  }

  return {
    success: true,
    summary: 'To build your agenda, tell me the session topics and speakers. I\'ll allocate time slots based on session type:\n• Keynote: 45 min\n• Talk: 20 min\n• Workshop: 60 min\n• Break: 15 min\n\nAll with 5-minute transition buffers.',
  };
}

async function createAgenda(
  event: EventBrief,
  params: Record<string, unknown>
): Promise<DelegationResult> {
  const sessions = params.sessions as Array<{
    topic: string;
    speaker: string;
    type: keyof typeof SESSION_DURATIONS;
  }>;

  if (!sessions || sessions.length === 0) {
    return {
      success: false,
      summary: 'Please provide at least one session with topic, speaker, and type (keynote/talk/workshop/break).',
    };
  }

  // Build agenda with automatic time allocation
  const startTime = new Date(`${event.date || new Date().toISOString().split('T')[0]}T09:00:00+08:00`);
  let currentTime = new Date(startTime);

  const scheduled: ScheduledSession[] = sessions.map((s, i) => {
    const duration = SESSION_DURATIONS[s.type] || 20;
    const start = new Date(currentTime);
    const end = new Date(currentTime.getTime() + duration * 60000);

    currentTime = new Date(end.getTime() + TRANSITION_BUFFER_MINUTES * 60000);

    return {
      id: `session-${i + 1}`,
      topic: s.topic,
      speaker: s.speaker,
      type: s.type,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration,
      track: 'main',
      transitionBuffer: TRANSITION_BUFFER_MINUTES,
      confirmed: false,
    };
  });

  // Detect conflicts
  const conflicts = detectConflicts(scheduled);

  // Format agenda
  const agendaText = scheduled.map((s) => {
    const start = new Date(s.startTime).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' });
    const end = new Date(s.endTime).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' });
    return `${start}–${end} | ${s.type.toUpperCase()} | ${s.topic} (${s.speaker}) [${s.duration}min]`;
  }).join('\n');

  const conflictWarning = conflicts.length > 0
    ? `\n\n⚠️ Time conflicts detected:\n${conflicts.map((c) => `• "${c.sessionA}" overlaps with "${c.sessionB}" by ${c.overlapMinutes} min`).join('\n')}`
    : '';

  return {
    success: true,
    summary: `**Draft Agenda — ${event.name}**\n\n${agendaText}${conflictWarning}\n\nAll times in SGT (UTC+8). Want me to adjust any slots or notify the speakers?`,
    data: { agenda: { sessions: scheduled, conflicts } },
  };
}

function detectConflicts(sessions: ScheduledSession[]): ConflictResult[] {
  const conflicts: ConflictResult[] = [];

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];

      if (a.track !== b.track) continue;

      const aStart = new Date(a.startTime).getTime();
      const aEnd = new Date(a.endTime).getTime();
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();

      if (aStart < bEnd && bStart < aEnd) {
        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

        conflicts.push({
          sessionA: a.topic,
          sessionB: b.topic,
          track: a.track,
          overlapMinutes,
        });
      }
    }
  }

  return conflicts;
}
