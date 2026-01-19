export type TaskDeadlineStatus = 'overdue' | 'soon' | 'ok' | 'none';

export function parseLocalDateToEndOfDayISO(dateValue: string): string | null {
  const trimmed = (dateValue || '').trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;

  const localEndOfDay = new Date(year, monthIndex, day, 23, 59, 59, 999);
  if (Number.isNaN(localEndOfDay.getTime())) return null;

  return localEndOfDay.toISOString();
}

export function getDeadlineStatus(dueDateISO?: string | null, nowMs: number = Date.now()): TaskDeadlineStatus {
  if (!dueDateISO) return 'none';
  const due = new Date(dueDateISO);
  if (Number.isNaN(due.getTime())) return 'none';

  const diffMs = due.getTime() - nowMs;
  if (diffMs < 0) return 'overdue';

  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  if (diffMs <= threeDaysMs) return 'soon';

  return 'ok';
}

export function isUnseenActivity(lastActivityAt?: string | null, lastSeenAt?: string | null): boolean {
  if (!lastActivityAt) return false;
  const activityMs = new Date(lastActivityAt).getTime();
  if (Number.isNaN(activityMs)) return false;

  const seenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
  if (Number.isNaN(seenMs)) return true;

  return activityMs > seenMs;
}

