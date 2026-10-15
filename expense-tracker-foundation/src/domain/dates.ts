export function dateKey(value: string): string {
  return value.slice(0, 10);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (dmy) return validDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return formatLocalDate(date);
}

export interface CalendarMonth {
  key: string;
  start: string;
  end: string;
  label: string;
  partial: boolean;
}

export function monthWindow(today: string, offset = 0): CalendarMonth {
  const [yearText, monthText, dayText] = today.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1 + offset;
  const cursor = new Date(year, monthIndex, 1);
  const startDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const endDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = formatLocalDate(startDate);
  const end = formatLocalDate(endDate);
  const key = start.slice(0, 7);
  const partial = offset === 0 && today < end && Number(dayText) < endDate.getDate();
  const label = startDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return { key, start, end, label, partial };
}

export function addDays(dateKeyValue: string, days: number): string {
  const [year, month, day] = dateKeyValue.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function displayDate(value: string): string {
  const key = dateKey(value);
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
