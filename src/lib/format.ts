import {
  differenceInMinutes,
  format,
  formatDistanceToNowStrict,
  isThisWeek,
  parseISO,
} from 'date-fns';

export function formatShortDate(value?: string) {
  if (!value) return 'No date';
  return format(parseISO(value), 'dd MMM');
}

export function formatLongDateTime(value?: string) {
  if (!value) return 'Not set';
  return format(parseISO(value), 'dd MMM yyyy, h:mm a');
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRelativeTime(value?: string) {
  if (!value) return 'Just now';
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

export function minutesBetween(startIso: string, endIso: string) {
  return differenceInMinutes(parseISO(endIso), parseISO(startIso));
}

export function formatMinutesAsHours(minutes: number) {
  const hours = minutes / 60;
  return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
}

export function isWithinCurrentWeek(value: string) {
  return isThisWeek(parseISO(value), { weekStartsOn: 1 });
}
