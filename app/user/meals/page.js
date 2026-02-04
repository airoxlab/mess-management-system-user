'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, MEAL_TYPES, getDayName } from '@/lib/utils';
import { toast } from 'sonner';
import supabase from '@/lib/supabase';

export default function MealSchedulePage() {
  const { memberData, memberType } = useAuth();
  const [memberPackage, setMemberPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [selections, setSelections] = useState({});
  const [saving, setSaving] = useState(false);
  const [todayTokens, setTodayTokens] = useState([]);
  const [skipping, setSkipping] = useState(null);

  // Generate next 14 days for selection
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const selectableDates = generateDates();

  // Get only enabled meals from package
  const getEnabledMeals = () => {
    if (!memberPackage) return [];
    return MEAL_TYPES.filter(meal => memberPackage[`${meal.value}_enabled`]);
  };

  const enabledMeals = getEnabledMeals();

  // Check if a meal is available on a specific date based on the days array
  const isMealAvailableOnDate = (mealValue, date) => {
    if (!memberPackage) return false;

    const isEnabled = memberPackage[`${mealValue}_enabled`];
    if (!isEnabled) return false;

    const mealDays = memberPackage[`${mealValue}_days`] || [];

    // If no days specified, meal is available every day
    if (mealDays.length === 0) return true;

    // Get day name (lowercase) from the date
    const dayName = getDayName(date).toLowerCase();

    // Check if this day is in the allowed days
    return mealDays.map(d => d.toLowerCase()).includes(dayName);
  };

  const fetchData = useCallback(async () => {
    if (!memberData?.id) return;

    try {
      setLoading(true);

      // Fetch member package
      try {
        const packageRes = await fetch(
          `/api/member-package?memberId=${memberData.id}&memberType=${memberType}`
        );
        if (packageRes.ok) {
          const packageData = await packageRes.json();
          setMemberPackage(packageData.package || null);
        }
      } catch (pkgError) {
        console.log('No package assigned:', pkgError);
        setMemberPackage(null);
      }

      // Fetch today's tokens
      const today = new Date().toISOString().split('T')[0];
      try {
        const tokensRes = await fetch(
          `/api/meal-tokens?memberId=${memberData.id}&startDate=${today}&endDate=${today}`
        );
        if (tokensRes.ok) {
          const tokensData = await tokensRes.json();
          setTodayTokens(tokensData.tokens || []);
        }
      } catch (tokenError) {
        console.log('No tokens found');
        setTodayTokens([]);
      }

      // Fetch existing meal selections
      await fetchSelections();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [memberData?.id, memberType]);

  useEffect(() => {
    if (memberData?.id) {
      fetchData();

      // Set up real-time subscription for tokens, selections, and packages
      const channel = supabase
        .channel('meals-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meal_tokens',
            filter: `member_id=eq.${memberData.id}`,
          },
          (payload) => {
            console.log('Token update:', payload.eventType);
            fetchData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meal_selections',
            filter: `member_id=eq.${memberData.id}`,
          },
          (payload) => {
            console.log('Selection update:', payload.eventType);
            fetchSelections();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'member_meal_packages',
            filter: `member_id=eq.${memberData.id}`,
          },
          (payload) => {
            console.log('Package update:', payload.eventType);
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [memberData?.id, fetchData]);

  const fetchSelections = async () => {
    if (!memberData?.id) return;

    try {
      const startDate = selectableDates[0].toISOString().split('T')[0];
      const endDate = selectableDates[selectableDates.length - 1].toISOString().split('T')[0];

      const selectionsRes = await fetch(
        `/api/meal-selections?memberId=${memberData.id}&memberType=${memberType}&startDate=${startDate}&endDate=${endDate}`
      );

      if (selectionsRes.ok) {
        const selectionsData = await selectionsRes.json();
        const selectionsMap = {};

        selectableDates.forEach((date) => {
          const dateStr = date.toISOString().split('T')[0];
          const existing = selectionsData.selections?.find((s) => s.date === dateStr);
          selectionsMap[dateStr] = {
            breakfast: existing?.breakfast_needed ?? true,
            lunch: existing?.lunch_needed ?? true,
            dinner: existing?.dinner_needed ?? true,
          };
        });

        setSelections(selectionsMap);
      }
    } catch (error) {
      console.log('Error fetching selections:', error);
    }
  };

  // Skip a meal for today (saves to backend)
  const handleSkipMeal = async (mealType) => {
    try {
      setSkipping(mealType);

      const today = new Date().toISOString().split('T')[0];

      // First, update the selection
      const response = await fetch('/api/meal-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: memberData.id,
          memberType: memberType,
          selections: [{
            date: today,
            breakfast: mealType === 'breakfast' ? false : selections[today]?.breakfast ?? true,
            lunch: mealType === 'lunch' ? false : selections[today]?.lunch ?? true,
            dinner: mealType === 'dinner' ? false : selections[today]?.dinner ?? true,
          }],
        }),
      });

      if (response.ok) {
        // Update local state
        setSelections((prev) => ({
          ...prev,
          [today]: {
            ...prev[today],
            [mealType]: false,
          },
        }));

        // Also try to skip the token if it exists
        try {
          await fetch('/api/meal-tokens/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: memberData.id,
              memberType: memberType,
              date: today,
              mealType: mealType.toUpperCase(),
              action: 'skip',
            }),
          });
        } catch (skipError) {
          // Token might not exist yet, that's okay
          console.log('Token skip skipped:', skipError);
        }

        toast.success(`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} skipped for today`);
        fetchData(); // Refresh data
      } else {
        toast.error('Failed to skip meal');
      }
    } catch (error) {
      console.error('Error skipping meal:', error);
      toast.error('Failed to skip meal');
    } finally {
      setSkipping(null);
    }
  };

  // Get token status for a specific meal today
  const getTodayMealStatus = (mealValue) => {
    const token = todayTokens.find(t => t.meal_type.toLowerCase() === mealValue);
    return token ? token.status : null;
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

  const toggleAllMealsForDate = (dateStr, date, value) => {
    const updates = {};
    enabledMeals.forEach((meal) => {
      if (isMealAvailableOnDate(meal.value, date)) {
        updates[meal.value] = value;
      }
    });
    setSelections((prev) => ({
      ...prev,
      [dateStr]: { ...prev[dateStr], ...updates },
    }));
  };

  const handleSaveSelections = async () => {
    try {
      setSaving(true);

      const selectionsArray = Object.entries(selections).map(([date, meals]) => ({
        date,
        breakfast: meals.breakfast ?? true,
        lunch: meals.lunch ?? true,
        dinner: meals.dinner ?? true,
      }));

      const response = await fetch('/api/meal-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: memberData.id,
          memberType: memberType,
          selections: selectionsArray,
        }),
      });

      if (response.ok) {
        toast.success('Meal preferences saved successfully!');
        setShowSelectionModal(false);
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving selections:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Get today's date and available meals
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];
  const availableMealsToday = enabledMeals.filter(meal => isMealAvailableOnDate(meal.value, todayDate));

  // Check if today's meals are all selected
  const getTodaySelectionStatus = () => {
    const todaySelection = selections[todayStr];
    if (!todaySelection) return { allSelected: true, someSelected: true };

    let selected = 0;
    let total = 0;

    availableMealsToday.forEach(meal => {
      total++;
      if (todaySelection[meal.value] !== false) selected++;
    });

    return {
      allSelected: selected === total,
      someSelected: selected > 0,
      selected,
      total
    };
  };

  const todayStatus = getTodaySelectionStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // No package - show message
  if (!memberPackage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Package</h2>
        <p className="text-gray-500">You need an active meal package to view meals.</p>
      </div>
    );
  }

  // No enabled meals
  if (enabledMeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Meals in Package</h2>
        <p className="text-gray-500">Your package doesn&apos;t have any meals enabled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      {/* Compact White Header */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold text-gray-900">My Meals</h1>
            <p className="text-xs text-gray-600 mt-0.5">{formatDate(todayDate, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Compact Remaining Meals - Show ALL meal types */}
        {memberPackage && (
          <div className="grid grid-cols-3 gap-2">
            {MEAL_TYPES.map((meal) => {
              const isEnabled = memberPackage[`${meal.value}_enabled`];
              const stats = memberPackage.tokenStats?.[meal.value] || { collected: 0, total: 0 };
              const remaining = stats.total - stats.collected;
              return (
                <div
                  key={meal.value}
                  className={`rounded-lg p-2 text-center border ${
                    isEnabled && remaining > 0
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-gray-100 border-gray-300 opacity-60'
                  }`}
                >
                  <p className={`text-lg font-bold ${isEnabled && remaining > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                    {remaining}
                  </p>
                  <p className="text-[10px] text-gray-600">{meal.label} Left</p>
                  {!isEnabled && <p className="text-[8px] text-gray-400 mt-0.5">Not in plan</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Skip Meals Button */}
      <button
        onClick={() => setShowSelectionModal(true)}
        className="w-full bg-white rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition-all flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 text-sm">Manage Preferences</h3>
            <p className="text-xs text-gray-500">Skip meals for upcoming days</p>
          </div>
        </div>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Compact Today's Meals */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Today&apos;s Meals
          </h2>
        </div>

        <div className="p-4">
          {availableMealsToday.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-700">No Meals Today</h3>
              <p className="text-xs text-gray-500 mt-1">No meals scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableMealsToday.map((meal) => {
                const isSelected = selections[todayStr]?.[meal.value] !== false;
                const tokenStatus = getTodayMealStatus(meal.value);
                const isCollected = tokenStatus === 'COLLECTED';
                const isCancelled = tokenStatus === 'CANCELLED' || tokenStatus === 'SKIPPED';

                return (
                  <div
                    key={meal.value}
                    className={`p-3 rounded-lg border transition-all ${
                      isCollected
                        ? 'bg-green-50 border-green-200'
                        : isCancelled || !isSelected
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isCollected ? '#dcfce7' : isSelected ? `${meal.color}20` : '#fee2e2' }}
                      >
                        <span className="text-lg font-bold" style={{ color: isCollected ? '#22c55e' : isSelected ? meal.color : '#ef4444' }}>
                          {meal.label.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{meal.label}</h4>
                        <p className="text-xs text-gray-500">{meal.time}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Compact Status */}
                        {isCollected ? (
                          <span className="text-[9px] bg-green-600 text-white px-2 py-1 rounded font-semibold">Done</span>
                        ) : isCancelled || !isSelected ? (
                          <span className="text-[9px] bg-red-600 text-white px-2 py-1 rounded font-semibold">Skipped</span>
                        ) : (
                          <span className="text-[9px] bg-amber-600 text-white px-2 py-1 rounded font-semibold">Waiting</span>
                        )}
                      </div>
                    </div>

                    {/* Compact Skip Button */}
                    {!isCollected && !isCancelled && isSelected && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => handleSkipMeal(meal.value)}
                          disabled={skipping === meal.value}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                          {skipping === meal.value ? (
                            <>
                              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              Skipping...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Skip This Meal
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Compact unavailable meals */}
              {enabledMeals.filter(meal => !isMealAvailableOnDate(meal.value, todayDate)).map((meal) => (
                <div
                  key={meal.value}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-200">
                    <span className="text-lg font-bold text-gray-400">
                      {meal.label.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-500 text-sm">{meal.label}</h4>
                    <p className="text-xs text-gray-400">{meal.time}</p>
                  </div>
                  <span className="text-[9px] bg-gray-200 text-gray-500 px-2 py-1 rounded font-semibold">
                    Off
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compact Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Weekly Schedule
          </h2>
        </div>

        <div className="p-4 space-y-3">
          {enabledMeals.map((meal) => {
            const days = memberPackage[`${meal.value}_days`] || [];
            const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            return (
              <div key={meal.value} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${meal.color}20` }}
                  >
                    <span className="text-sm font-bold" style={{ color: meal.color }}>
                      {meal.label.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs">{meal.label}</p>
                    <p className="text-[10px] text-gray-500">{meal.time}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {allDays.map((day, idx) => {
                    const isActive = days.length === 0 || days.map(d => d.toLowerCase()).includes(fullDays[idx].toLowerCase());
                    return (
                      <span
                        key={day}
                        className={`px-2 py-1 text-[10px] font-semibold rounded ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {day}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meal Selection Modal */}
      {showSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Manage Meal Preferences</h3>
                <p className="text-sm text-gray-500 mt-1">Select which meals you want for each day</p>
              </div>
              <button
                onClick={() => setShowSelectionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                {selectableDates.map((date, index) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isToday = index === 0;
                  const daySelection = selections[dateStr] || {};
                  const availableMealsForDay = enabledMeals.filter(meal => isMealAvailableOnDate(meal.value, date));

                  // Skip days with no available meals
                  if (availableMealsForDay.length === 0) return null;

                  // Count selected meals
                  let selectedCount = 0;
                  availableMealsForDay.forEach(meal => {
                    if (daySelection[meal.value] !== false) selectedCount++;
                  });
                  const allSelected = selectedCount === availableMealsForDay.length;

                  return (
                    <div
                      key={dateStr}
                      className={`p-4 rounded-xl border transition-all ${
                        isToday
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      {/* Date Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isToday ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <span className="text-sm font-bold">{date.getDate()}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {formatDate(date, 'EEEE')}
                              {isToday && <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Today</span>}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(date, 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAllMealsForDate(dateStr, date, !allSelected)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            allSelected
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {allSelected ? 'Skip All' : 'Want All'}
                        </button>
                      </div>

                      {/* Meal Toggles */}
                      <div className="space-y-2">
                        {availableMealsForDay.map((meal) => {
                          const isSelected = daySelection[meal.value] !== false;

                          return (
                            <div
                              key={meal.value}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-green-50 border border-green-200'
                                  : 'bg-red-50 border border-red-200'
                              }`}
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${meal.color}20` }}
                              >
                                <span className="text-sm font-bold" style={{ color: meal.color }}>
                                  {meal.label.charAt(0)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">{meal.label}</p>
                                <p className="text-xs text-gray-500">{meal.time}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${
                                  isSelected ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {isSelected ? 'Wanted' : 'Skipped'}
                                </span>
                                {/* Toggle Switch */}
                                <button
                                  onClick={() => toggleMeal(dateStr, meal.value)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isSelected
                                      ? 'bg-green-600 focus:ring-green-500'
                                      : 'bg-red-400 focus:ring-red-300'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      isSelected ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowSelectionModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSelections}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Preferences
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
