export const MEMBER_TYPES = {
  STUDENT: 'student',
  FACULTY: 'faculty',
  STAFF: 'staff',
};

export const MEAL_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  confirmed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
  completed: 'bg-green-100 text-green-800',
};

export const MEAL_COLORS = {
  breakfast: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    accent: 'bg-amber-500',
  },
  lunch: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    accent: 'bg-orange-500',
  },
  dinner: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    accent: 'bg-indigo-500',
  },
};
