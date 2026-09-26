import { formatINR } from '@novafood/shared';

export const money = formatINR;

const relative = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, 'second');
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86_400), 'day');
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export const clock = (iso: string) => timeFmt.format(new Date(iso));
export const shortDate = (iso: string) => dateFmt.format(new Date(iso));
export const dateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function minutesUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - now) / 60_000);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
