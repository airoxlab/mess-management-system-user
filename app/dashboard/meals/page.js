'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, DAYS_OF_WEEK, MEAL_TYPES, classNames } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

export default function MealSelectionPage() {
  const { memberData, memberType } = useAuth();
  const [memberPackage, setMemberPackage] = useState(null);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'

  // Generate dates for next 7 days or 30 days
  const generateDates = (days) => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = viewMode === 'week' ? generateDates(7) : generateDates(30);

  useEffect(() => {
    if (memberData?.id) {
      fetchData();
    }
  }, [memberData, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch member package
      const packageRes = await fetch(
        `/api/member-package?memberId=${memberData.id}&memberType=${memberType}`
      );
      const packageData = await packageRes.json();
      setMemberPackage(packageData.package);

      // Fetch existing selections
      const startDate = dates[0].toISOString().split('T')[0];
      const endDate = dates[dates.length - 1].toISOString().split('T')[0];

      const selectionsRes = await fetch(
        `/api/meal-selections?memberId=${memberData.id}&memberType=${memberType}&startDate=${startDate}&endDate=${endDate}`
      );
      const selectionsData = await selectionsRes.json();

      // Convert to map by date
      const selectionsMap = {};
      dates.forEach((date) => {
        const dateStr = date.toISOString().split('T')[0];
        const existing = selectionsData.selections?.find(
          (s) => s.date === dateStr
        );
        selectionsMap[dateStr] = {
          breakfast: existing?.breakfast_needed ?? true,
          lunch: existing?.lunch_needed ?? true,
          dinner: existing?.dinner_needed ?? true,
        };
      });
      setSelections(selectionsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleMeal = (dateStr, mealType) => {
    setSelections((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [mealType]: !prev[dateStr]?.[mealType],
      },
    }));
  };

  const toggleAllForDay = (dateStr, value) => {
    setSelections((prev) => ({
      ...prev,
      [dateStr]: {
        breakfast: value,
        lunch: value,
        dinner: value,
      },
    }));
  };

  const toggleAllForMeal = (mealType, value) => {
    setSelections((prev) => {
      const newSelections = { ...prev };
      dates.forEach((date) => {
        const dateStr = date.toISOString().split('T')[0];
        newSelections[dateStr] = {
          ...newSelections[dateStr],
          [mealType]: value,
        };
      });
      return newSelections;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const selectionsArray = Object.entries(selections).map(([date, meals]) => ({
        date,
        breakfast: meals.breakfast,
        lunch: meals.lunch,
        dinner: meals.dinner,
      }));

      const response = await fetch('/api/meal-selections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: memberData.id,
          memberType: memberType,
          selections: selectionsArray,
        }),
      });

      if (response.ok) {
        toast.success('Meal selections saved successfully!');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save selections');
      }
    } catch (error) {
      console.error('Error saving selections:', error);
      toast.error('Failed to save selections');
    } finally {
      setSaving(false);
    }
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meal Selection</h1>
          <p className="text-gray-600 mt-1">
            Select which meals you need for the upcoming days
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('week')}
              className={classNames(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={classNames(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Month
            </button>
          </div>

          <Button onClick={handleSave} loading={saving}>
            Save Selections
          </Button>
        </div>
      </div>

      {/* Package Info */}
      {memberPackage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-blue-800">
              Your package includes:{' '}
              <strong>
                {[
                  memberPackage.breakfast_enabled && 'Breakfast',
                  memberPackage.lunch_enabled && 'Lunch',
                  memberPackage.dinner_enabled && 'Dinner',
                ].filter(Boolean).join(', ')}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Quick Select</h3>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((meal) => (
            <div key={meal.value} className="flex items-center gap-2">
              <button
                onClick={() => toggleAllForMeal(meal.value, true)}
                className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
              >
                All {meal.label}
              </button>
              <button
                onClick={() => toggleAllForMeal(meal.value, false)}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                No {meal.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Date
                </th>
                {MEAL_TYPES.map((meal) => (
                  <th key={meal.value} className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                    <div className="flex flex-col items-center gap-1">
                      <span>{meal.label}</span>
                      <span className="text-xs font-normal text-gray-500">{meal.time}</span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                  All
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dates.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const daySelection = selections[dateStr] || {
                  breakfast: true,
                  lunch: true,
                  dinner: true,
                };
                const allSelected =
                  daySelection.breakfast &&
                  daySelection.lunch &&
                  daySelection.dinner;
                const noneSelected =
                  !daySelection.breakfast &&
                  !daySelection.lunch &&
                  !daySelection.dinner;

                return (
                  <tr
                    key={dateStr}
                    className={classNames(
                      isToday(date) ? 'bg-primary-50' : '',
                      isPast(date) ? 'opacity-50' : ''
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isToday(date) && (
                          <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatDate(date, 'EEE, MMM d')}
                          </p>
                          {isToday(date) && (
                            <p className="text-xs text-primary-600">Today</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {MEAL_TYPES.map((meal) => {
                      const isEnabled =
                        !memberPackage ||
                        memberPackage[`${meal.value}_enabled`];
                      const isSelected = daySelection[meal.value];

                      return (
                        <td key={meal.value} className="px-4 py-3">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleMeal(dateStr, meal.value)}
                              disabled={!isEnabled || isPast(date)}
                              className={classNames(
                                'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                                !isEnabled
                                  ? 'bg-gray-100 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-primary-500 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              )}
                            >
                              {isSelected ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => toggleAllForDay(dateStr, true)}
                          disabled={isPast(date)}
                          className={classNames(
                            'p-1.5 rounded transition-colors',
                            allSelected
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                          )}
                          title="Select all"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleAllForDay(dateStr, false)}
                          disabled={isPast(date)}
                          className={classNames(
                            'p-1.5 rounded transition-colors',
                            noneSelected
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
                          )}
                          title="Deselect all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span>Meal Needed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span>Not Needed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
