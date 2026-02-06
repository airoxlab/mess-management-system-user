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

export function getMealTimeStatus(orgSettings = null) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const mealTimes = orgSettings?.mealTimes;

  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  // Use org settings if available, otherwise fall back to defaults
  const meals = [
    {
      key: 'breakfast',
      label: 'Breakfast Time',
      start: parseTime(mealTimes?.breakfast?.start) ?? 360,  // 6:00
      end: parseTime(mealTimes?.breakfast?.end) ?? 600,      // 10:00
    },
    {
      key: 'lunch',
      label: 'Lunch Time',
      start: parseTime(mealTimes?.lunch?.start) ?? 660,      // 11:00
      end: parseTime(mealTimes?.lunch?.end) ?? 900,          // 15:00
    },
    {
      key: 'dinner',
      label: 'Dinner Time',
      start: parseTime(mealTimes?.dinner?.start) ?? 1020,    // 17:00
      end: parseTime(mealTimes?.dinner?.end) ?? 1260,        // 21:00
    },
  ];

  for (const meal of meals) {
    if (currentMinutes >= meal.start && currentMinutes < meal.end) {
      return { meal: meal.key, label: meal.label, status: 'active' };
    }
  }

  return { meal: 'none', label: 'No Meal Time', status: 'inactive' };
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
  { value: 'breakfast', label: 'Breakfast', color: '#F59E0B' },
  { value: 'lunch', label: 'Lunch', color: '#F97316' },
  { value: 'dinner', label: 'Dinner', color: '#6366F1' },
];

// Parse organizations table row into orgSettings shape
// Uses: settings jsonb (breakfast_start, breakfast_end, etc.) + meal_skip_deadline column
export function parseOrgData(org) {
  if (!org) return null;
  const s = org.settings || {};
  return {
    id: org.id,
    name: org.name,
    mealSkipDeadline: org.meal_skip_deadline ?? 30,
    mealTimes: {
      breakfast: { start: s.breakfast_start, end: s.breakfast_end },
      lunch: { start: s.lunch_start, end: s.lunch_end },
      dinner: { start: s.dinner_start, end: s.dinner_end },
    },
    settings: s,
  };
}
