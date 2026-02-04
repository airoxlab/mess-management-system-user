import { format, parseISO, isValid } from 'date-fns';

export function formatDate(date, formatStr = 'MMM dd, yyyy') {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? format(parsedDate, formatStr) : '';
}

export function formatTime(date, formatStr = 'hh:mm a') {
  if (!date) return '';

  // Handle time-only strings like "12:30:00"
  if (typeof date === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(date)) {
    const today = new Date();
    const [hours, minutes, seconds = '00'] = date.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds));
    return format(today, formatStr);
  }

  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? format(parsedDate, formatStr) : '';
}

export function formatDateTime(date, formatStr = 'MMM dd, yyyy hh:mm a') {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? format(parsedDate, formatStr) : '';
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function getInitials(name) {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getMealTimeStatus() {
  const now = new Date();
  const hours = now.getHours();

  if (hours >= 6 && hours < 10) {
    return { meal: 'breakfast', label: 'Breakfast Time', status: 'active' };
  } else if (hours >= 11 && hours < 15) {
    return { meal: 'lunch', label: 'Lunch Time', status: 'active' };
  } else if (hours >= 17 && hours < 21) {
    return { meal: 'dinner', label: 'Dinner Time', status: 'active' };
  } else {
    return { meal: 'none', label: 'No Meal Time', status: 'inactive' };
  }
}

export function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

export function getDayShortName(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

export const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
];

export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', time: '6:00 AM - 10:00 AM', color: '#F59E0B' },
  { value: 'lunch', label: 'Lunch', time: '11:00 AM - 3:00 PM', color: '#F97316' },
  { value: 'dinner', label: 'Dinner', time: '5:00 PM - 9:00 PM', color: '#6366F1' },
];
