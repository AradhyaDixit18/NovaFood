import { TIMEZONE } from './constants';

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface OpeningWindow {
  day: Weekday;
  /** "HH:MM" 24-hour local time. */
  open: string;
  /** "HH:MM"; a close earlier than open means the window runs past midnight. */
  close: string;
}

interface LocalParts {
  weekday: Weekday;
  minutes: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Weekday and minutes-since-midnight in Indian Standard Time. */
export function localParts(date: Date): LocalParts {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday').toLowerCase().slice(0, 3) as Weekday;
  return { weekday, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True when `date` falls inside any opening window (IST), including windows that cross midnight. */
export function isOpenAt(hours: OpeningWindow[], date: Date): boolean {
  if (hours.length === 0) return false;
  const { weekday, minutes } = localParts(date);
  const dayIndex = WEEKDAYS.indexOf(weekday);
  const yesterday = WEEKDAYS[(dayIndex + 6) % 7];

  return hours.some((w) => {
    const open = toMinutes(w.open);
    const close = toMinutes(w.close);
    const crossesMidnight = close <= open;
    if (w.day === weekday) {
      return crossesMidnight ? minutes >= open : minutes >= open && minutes < close;
    }
    // Late-night window that started yesterday and is still running.
    return crossesMidnight && w.day === yesterday && minutes < close;
  });
}

export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner' | 'late-night';

export function mealSlot(date: Date): MealSlot {
  const { minutes } = localParts(date);
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 19) return 'snacks';
  if (hour >= 19 && hour < 23) return 'dinner';
  return 'late-night';
}

export function weekdayOf(date: Date): Weekday {
  return localParts(date).weekday;
}

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};
