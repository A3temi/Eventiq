import type { AgentTask } from '@/types/agents';
import type { EventBrief } from '@/types/event';
import { getEventAttendees, getAttendeeStats } from '@/lib/db/attendees';
import { getEventPayments } from '@/lib/db/payments';
import { formatCurrency } from '@/lib/utils';

interface DelegationResult {
  success: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export async function handleAnalyticsTask(
  task: AgentTask,
  event: EventBrief,
  userId: string
): Promise<DelegationResult> {
  const params = task.parameters;
  const reportType = (params.reportType as string) || 'overview';

  switch (reportType) {
    case 'attendance':
      return generateAttendanceReport(event);
    case 'roi':
      return generateROIReport(event);
    case 'feedback':
      return generateFeedbackReport(event);
    default:
      return generateOverviewReport(event);
  }
}

async function generateOverviewReport(event: EventBrief): Promise<DelegationResult> {
  const stats = await getAttendeeStats(event.id);
  const payments = await getEventPayments(event.id);

  const totalSpent = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRevenue = stats.revenue || 0;

  return {
    success: true,
    summary: `**Event Analytics — ${event.name}**\n\n` +
      `📊 **Attendance**\n` +
      `• Registered: ${stats.totalRegistered}\n` +
      `• Checked in: ${stats.checkedIn}\n` +
      `• No-show rate: ${stats.totalRegistered > 0 ? Math.round(((stats.totalRegistered - stats.checkedIn) / stats.totalRegistered) * 100) : 0}%\n\n` +
      `💰 **Financials**\n` +
      `• Total spent: ${formatCurrency(totalSpent)}\n` +
      `• Ticket revenue: ${formatCurrency(totalRevenue)}\n` +
      `• Budget: ${formatCurrency(event.budget?.total || 0)}\n` +
      `• Budget used: ${event.budget?.total ? Math.round((totalSpent / event.budget.total) * 100) : 0}%\n\n` +
      (stats.totalRegistered > 0
        ? `• Cost per attendee: ${formatCurrency(totalSpent / stats.checkedIn || stats.totalRegistered)}`
        : ''),
    data: { stats, totalSpent, totalRevenue },
  };
}

async function generateAttendanceReport(event: EventBrief): Promise<DelegationResult> {
  const attendees = await getEventAttendees(event.id);
  const stats = await getAttendeeStats(event.id);

  // Calculate check-in distribution (15-min intervals)
  const checkedInAttendees = attendees.filter((a) => a.checkedIn && a.checkedInAt);
  const intervals: Record<string, number> = {};

  for (const a of checkedInAttendees) {
    const time = new Date(a.checkedInAt!);
    const intervalKey = `${time.getHours().toString().padStart(2, '0')}:${(Math.floor(time.getMinutes() / 15) * 15).toString().padStart(2, '0')}`;
    intervals[intervalKey] = (intervals[intervalKey] || 0) + 1;
  }

  const distribution = Object.entries(intervals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => `${time}: ${count} arrivals`)
    .join('\n');

  return {
    success: true,
    summary: `**Attendance Report — ${event.name}**\n\n` +
      `Total registered: ${stats.totalRegistered}\n` +
      `Checked in: ${stats.checkedIn}\n` +
      `No-shows: ${stats.totalRegistered - stats.checkedIn}\n` +
      `No-show rate: ${stats.totalRegistered > 0 ? Math.round(((stats.totalRegistered - stats.checkedIn) / stats.totalRegistered) * 100) : 0}%\n\n` +
      `**Check-in Distribution (15-min intervals):**\n${distribution || 'No check-in data yet.'}`,
    data: { stats, intervals },
  };
}

async function generateROIReport(event: EventBrief): Promise<DelegationResult> {
  const payments = await getEventPayments(event.id);
  const stats = await getAttendeeStats(event.id);

  const totalSpent = payments
    .filter((p) => p.status === 'completed' && p.type !== 'credits')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRevenue = stats.revenue || 0;
  const roi = totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent) * 100 : 0;
  const costPerAttendee = stats.checkedIn > 0 ? totalSpent / stats.checkedIn : 0;

  // Category variance
  const categoryVariance = (event.budget?.categories || []).map((c) => {
    const actualSpent = c.spent + c.committed;
    const variance = c.allocated > 0 ? ((actualSpent - c.allocated) / c.allocated) * 100 : 0;
    return `• ${c.name}: planned ${formatCurrency(c.allocated)}, actual ${formatCurrency(actualSpent)} (${variance > 0 ? '+' : ''}${Math.round(variance)}%)`;
  }).join('\n');

  return {
    success: true,
    summary: `**ROI Report — ${event.name}**\n\n` +
      `💰 Total spend: ${formatCurrency(totalSpent)}\n` +
      `📈 Revenue: ${formatCurrency(totalRevenue)}\n` +
      `📊 ROI: ${roi > 0 ? '+' : ''}${Math.round(roi)}%\n` +
      `👤 Cost per attendee: ${formatCurrency(costPerAttendee)}\n\n` +
      `**Category Variance (actual vs planned):**\n${categoryVariance || 'No budget categories set.'}`,
    data: { totalSpent, totalRevenue, roi, costPerAttendee },
  };
}

async function generateFeedbackReport(event: EventBrief): Promise<DelegationResult> {
  // In production, this would pull from a feedback collection system
  return {
    success: true,
    summary: `**Feedback Report — ${event.name}**\n\n` +
      `⚠️ Feedback collection not yet available. Minimum 5 responses required for analysis.\n\n` +
      `To collect feedback, I can:\n` +
      `• Generate a post-event feedback form\n` +
      `• Send feedback request emails to attendees\n\n` +
      `Would you like me to set that up?`,
  };
}
