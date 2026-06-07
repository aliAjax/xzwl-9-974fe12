import {
  format,
  parseISO,
  differenceInDays,
  addDays,
  isAfter,
  isBefore,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const formatDate = (date: string | Date, pattern: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: zhCN });
};

export const formatDateChinese = (date: string | Date): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'M月d日', { locale: zhCN });
};

export const formatFullDateChinese = (date: string | Date): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy年M月d日 EEEE', { locale: zhCN });
};

export const daysBetween = (start: string | Date, end: string | Date): number => {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  return differenceInDays(e, s);
};

export const addDaysToDate = (date: string | Date, days: number): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(addDays(d, days), 'yyyy-MM-dd');
};

export const isDateAfter = (date1: string | Date, date2: string | Date): boolean => {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isAfter(d1, d2);
};

export const isDateBefore = (date1: string | Date, date2: string | Date): boolean => {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isBefore(d1, d2);
};

export const isDateSame = (date1: string | Date, date2: string | Date): boolean => {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isSameDay(d1, d2);
};

export const getDaysInMonth = (date: string | Date): Date[] => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const start = startOfWeek(startOfMonth(d), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(d), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
};

export const getWeekday = (date: string | Date): number => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return getDay(d);
};

export const getToday = (): string => {
  return format(new Date('2026-06-07'), 'yyyy-MM-dd');
};

export const getTodayDate = (): Date => {
  return new Date('2026-06-07');
};

export const isToday = (date: string | Date): boolean => {
  return isDateSame(date, getToday());
};

export const getDaysRemaining = (date: string | Date): number => {
  return daysBetween(getToday(), date);
};
