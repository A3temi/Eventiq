import type { AgentTask } from '@/types/agents';
import type { EventBrief } from '@/types/event';
import type { CheckInResult } from '@/types/attendee';
import {
  createAttendee,
  findByQRCode,
  checkIn,
  getAttendeeStats as getStats,
  getEventAttendees,
} from '@/lib/db/attendees';

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export async function handleAttendeeTask(
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  const params = task.parameters;

  switch (task.action) {
    case 'manage_attendees':
      if (params.subAction === 'checkin') {
        return handleCheckIn(event.id, params.qrCode as string);
      }
      if (params.subAction === 'stats') {
        return handleStats(event);
      }
      if (params.subAction === 'register') {
        return handleRegistration(event, params);
      }
      return handleStats(event);
    default:
      return handleStats(event);
  }
}

async function handleCheckIn(eventId: string, qrCode: string): Promise<DelegationResult> {
  if (!qrCode) {
    return { success: false, summary: 'No QR code provided for check-in.' };
  }

  try {
    const attendee = await findByQRCode(qrCode);

    if (!attendee) {
      return {
        success: false,
        summary: '❌ Invalid QR code — this code is not registered for this event.',
        data: { error: 'invalid_code' },
      };
    }

    if (attendee.checkedIn) {
      return {
        success: false,
        summary: `⚠️ ${attendee.name} has already checked in at ${attendee.checkedInAt}.`,
        data: { error: 'duplicate_checkin', attendee },
      };
    }

    await checkIn(attendee.eventId, attendee.id);

    return {
      success: true,
      summary: `✅ ${attendee.name} checked in successfully!\nTicket: ${attendee.ticketType}\nEmail: ${attendee.email}`,
      data: {
        attendee: { ...attendee, checkedIn: true, checkedInAt: new Date().toISOString() },
        badge: {
          attendeeName: attendee.name,
          ticketType: attendee.ticketType,
          format: 'digital',
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      summary: '⚠️ System temporarily unavailable. Please retry in a moment.',
      data: { error: 'system_unavailable' },
    };
  }
}

async function handleStats(event: EventBrief): Promise<DelegationResult> {
  const stats = await getStats(event.id);

  const typeBreakdown = Object.entries(stats.ticketsByType)
    .map(([type, count]) => `• ${type}: ${count}`)
    .join('\n');

  return {
    success: true,
    summary: `**Attendee Status — ${event.name}**\n\n` +
      `Total registered: ${stats.totalRegistered}\n` +
      `Checked in: ${stats.checkedIn}\n` +
      `Pending arrivals: ${stats.pendingArrivals}\n\n` +
      `By ticket type:\n${typeBreakdown || '• No registrations yet'}\n\n` +
      `Revenue: $${stats.revenue} SGD`,
    data: { stats: stats as unknown as Record<string, unknown> },
  };
}

async function handleRegistration(
  event: EventBrief,
  params: Record<string, unknown>
): Promise<DelegationResult> {
  const name = params.name as string;
  const email = params.email as string;
  const ticketType = (params.ticketType as string) || 'general';

  if (!name || !email) {
    return {
      success: false,
      summary: 'I need the attendee name and email to complete registration.',
    };
  }

  // Check capacity (simplified — in production, check per ticket type)
  const attendees = await getEventAttendees(event.id);
  if (event.attendeeCount && attendees.length >= event.attendeeCount) {
    return {
      success: false,
      summary: `Registration is full — ${event.attendeeCount} spots have been taken.`,
    };
  }

  const attendee = await createAttendee(event.id, {
    name,
    email,
    ticketType,
    paymentStatus: 'free', // Would check ticket price in production
  });

  return {
    success: true,
    summary: `✅ ${name} registered for "${event.name}"!\n` +
      `Ticket: ${ticketType}\n` +
      `QR Code: ${attendee.qrCode}\n\n` +
      `A confirmation email with the check-in QR code will be sent to ${email}.`,
    data: { attendee },
  };
}
