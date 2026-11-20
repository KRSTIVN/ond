import type { CalendarEvent } from '../types';

export interface CalendarCell {
  readonly isoDate: string;
  readonly day: number;
  readonly inCurrentMonth: boolean;
  readonly isToday: boolean;
}

export function getTodayIsoDate(): string {
  return Temporal.Now.plainDateISO().toString();
}

export function isValidPlainDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    Temporal.PlainDate.from(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidPlainTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  try {
    Temporal.PlainTime.from(value);
    return true;
  } catch {
    return false;
  }
}

export function buildMonthGrid(
  yearMonth: Temporal.PlainYearMonth,
  weekStartsOn: 1 | 7,
  todayIso: string,
): readonly CalendarCell[] {
  const firstOfMonth = yearMonth.toPlainDate({ day: 1 });
  const daysInMonth = yearMonth.daysInMonth;
  const leadOffset =
    weekStartsOn === 1 ? firstOfMonth.dayOfWeek - 1 : firstOfMonth.dayOfWeek % 7;

  const totalCells = leadOffset + daysInMonth > 35 ? 42 : 35;
  const gridStart = firstOfMonth.subtract({ days: leadOffset });
  const cells: CalendarCell[] = [];

  for (let i = 0; i < totalCells; i += 1) {
    const date = gridStart.add({ days: i });
    const isoDate = date.toString();
    cells.push({
      isoDate,
      day: date.day,
      inCurrentMonth: date.year === yearMonth.year && date.month === yearMonth.month,
      isToday: isoDate === todayIso,
    });
  }

  return cells;
}

export function getWeekdayLabels(weekStartsOn: 1 | 7): readonly string[] {
  const mondayFirst = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (weekStartsOn === 1) return mondayFirst;
  return ['Sun', ...mondayFirst.slice(0, 6)];
}

export function formatMonthHeading(yearMonth: Temporal.PlainYearMonth, locale = 'en-US'): string {
  const anchor = yearMonth.toPlainDate({ day: 1 });
  return anchor.toLocaleString(locale, { month: 'long', year: 'numeric' });
}

export function formatDayHeading(isoDate: string, locale = 'en-US'): string {
  if (!isValidPlainDate(isoDate)) return isoDate;
  const date = Temporal.PlainDate.from(isoDate);
  return date.toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function compareCalendarEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.startTime === null && b.startTime !== null) return -1;
  if (a.startTime !== null && b.startTime === null) return 1;
  if (a.startTime !== null && b.startTime !== null) {
    const cmp = a.startTime.localeCompare(b.startTime);
    if (cmp !== 0) return cmp;
  }
  return a.title.localeCompare(b.title);
}

export function isValidTimeRange(startTime: string | null, endTime: string | null): boolean {
  if (!startTime || !endTime) return true;
  if (!isValidPlainTime(startTime) || !isValidPlainTime(endTime)) return false;
  const start = Temporal.PlainTime.from(startTime);
  const end = Temporal.PlainTime.from(endTime);
  return Temporal.PlainTime.compare(end, start) > 0;
}
