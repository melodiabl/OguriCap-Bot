import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const APP_LOCALE = 'es-AR';
export const APP_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatDateTime(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '-';

  return value.toLocaleString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatDate(date: string | Date): string {
  return formatDateTime(date, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
