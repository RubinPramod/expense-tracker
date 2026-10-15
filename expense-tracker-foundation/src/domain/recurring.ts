import { addDays } from './dates';

export type RecurringCadence = 'weekly' | 'monthly' | 'yearly';
export type RecurringStatus = 'suggested' | 'active' | 'paused' | 'ended';

export interface RecurringItem {
  id: string;
  label: string;
  amountMinor: number | null;
  cadence: RecurringCadence;
  dueDay: number | null;
  leadDays: number;
  nextDueAt: string | null;
  status: RecurringStatus;
  requiresConfirmation: boolean;
}

/** Calendar arithmetic stays on the YYYY-MM-DD date, so the result does not shift with the device timezone. */
export function notificationDate(dueDate: string, leadDays: number, hour = 9): string {
  const fireDate = addDays(dueDate.slice(0, 10), -Math.max(0, leadDays));
  return `${fireDate}T${String(hour).padStart(2, '0')}:00:00`;
}

export function shouldSchedule(item: RecurringItem): boolean {
  return item.status === 'active' && !item.requiresConfirmation && Boolean(item.nextDueAt);
}

export function remindersToSchedule(items: RecurringItem[]): { id: string; fireAt: string }[] {
  return items.filter(shouldSchedule).map((item) => ({
    id: item.id,
    fireAt: notificationDate(item.nextDueAt ?? '', item.leadDays),
  }));
}

export function nextDueDate(cadence: RecurringCadence, dueDay: number, fromDate: string): string {
  const date = fromDate.slice(0, 10);
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) throw new Error('A due date must be a calendar date.');
  if (cadence === 'weekly') return addDays(date, 7);
  if (cadence === 'yearly') {
    const thisYear = `${year}-${String(month).padStart(2, '0')}-${String(clampDay(year, month, dueDay)).padStart(2, '0')}`;
    if (thisYear >= date) return thisYear;
    return `${year + 1}-${String(month).padStart(2, '0')}-${String(clampDay(year + 1, month, dueDay)).padStart(2, '0')}`;
  }
  const thisMonth = `${year}-${String(month).padStart(2, '0')}-${String(clampDay(year, month, dueDay)).padStart(2, '0')}`;
  if (thisMonth >= date) return thisMonth;
  const nextMonthIndex = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonthIndex).padStart(2, '0')}-${String(clampDay(nextYear, nextMonthIndex, dueDay)).padStart(2, '0')}`;
}

function clampDay(year: number, month: number, dueDay: number): number {
  const last = new Date(year, month, 0).getDate();
  return Math.min(Math.max(dueDay, 1), last);
}

export function localFireDate(fireAt: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fireAt);
  if (!match) throw new Error('Reminder time is invalid.');
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0);
}
