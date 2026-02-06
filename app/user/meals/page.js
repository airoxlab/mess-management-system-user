'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, MEAL_TYPES, getDayName, parseOrgData } from '@/lib/utils';
import { toast } from 'sonner';
import supabase from '@/lib/supabase';

// Format time string "HH:MM" or "HH:MM:SS" to "h:mm AM/PM"
function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Parse time string to today's Date object
function parseTimeToDate(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export default function MealSchedulePage() {
  const { memberData, memberType } = useAuth();
  const [memberPackage, setMemberPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [selections, setSelections] = useState({});
  const [saving, setSaving] = useState(false);
  const [todayTokens, setTodayTokens] = useState([]);
  const [skipping, setSkipping] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [mealHistory, setMealHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyMealFilter, setHistoryMealFilter] = useState('all');
  const [orgSettings, setOrgSettings] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time clock for deadline tracking
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Get meal time display from org settings (organizations table)
  const getMealTimeDisplay = (mealValue) => {
    const times = orgSettings?.mealTimes?.[mealValue];
    if (!times?.start || !times?.end) return 'Loading...';
    return `${formatTimeDisplay(times.start)} - ${formatTimeDisplay(times.end)}`;
  };

  // Get the skip deadline time for a meal
  const getDeadlineTime = (mealValue) => {
    if (!orgSettings?.mealTimes?.[mealValue]) return null;
    const startTime = orgSettings.mealTimes[mealValue].start;
    const deadlineMinutes = orgSettings.mealSkipDeadline || 30;
    const mealStart = parseTimeToDate(startTime);
    if (!mealStart) return null;
    const deadline = new Date(mealStart);
    deadline.setMinutes(deadline.getMinutes() - deadlineMinutes);
    return deadline;
  };

  // Check if a meal toggle is locked (past the skip deadline for today)
  const isMealLocked = (mealValue) => {
    const deadline = getDeadlineTime(mealValue);
    if (!deadline) return false;
    return currentTime >= deadline;
  };

  // Get remaining time until deadline
  const getTimeUntilDeadline = (mealValue) => {
    const deadline = getDeadlineTime(mealValue);
    if (!deadline) return null;
    const diff = deadline.getTime() - currentTime.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  // Check if a meal is available on a specific date based on the days array
  const isMealAvailableOnDate = (mealValue, date) => {
    if (!memberPackage) return false;
    const isEnabled = memberPackage[`${mealValue}_enabled`];
    if (!isEnabled) return false;
    const mealDays = memberPackage[`${mealValue}_days`] || [];
    if (mealDays.length === 0) return true;
    const dayName = getDayName(date).toLowerCase();
    return mealDays.map(d => d.toLowerCase()).includes(dayName);
  };

  const fetchMealHistory = useCallback(async () => {
    if (!memberData?.id) return;
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const startDateStr = startDate.toISOString().split('T')[0];
      const tokensRes = await fetch(
        `/api/meal-tokens?memberId=${memberData.id}&startDate=${startDateStr}&endDate=${endDate}`
      );
      if (tokensRes.ok) {
        const tokensData = await tokensRes.json();
        setMealHistory(tokensData.tokens || []);
      }
    } catch (error) {
      console.log('Error fetching meal history:', error);
    }
  }, [memberData?.id]);

  const fetchData = useCallback(async () => {
    if (!memberData?.id) return;
    try {
      setLoading(true);

      // Fetch organization settings directly from organizations table
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, settings, meal_skip_deadline')
          .eq('is_active', true)
          .limit(1)
          .single();
        setOrgSettings(parseOrgData(org));
      } catch (orgError) {
        console.log('Failed to fetch org settings:', orgError);
      }

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

      await fetchSelections();
      await fetchMealHistory();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [memberData?.id, memberType, fetchMealHistory]);

  useEffect(() => {
    if (memberData?.id) {
      fetchData();

      const channel = supabase
        .channel('meals-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meal_tokens', filter: `member_id=eq.${memberData.id}` },
          () => { fetchData(); fetchMealHistory(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meal_selections', filter: `member_id=eq.${memberData.id}` },
          () => { fetchSelections(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'member_packages', filter: `member_id=eq.${memberData.id}` },
          () => { fetchData(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'organizations' },
          (payload) => {
            if (payload.new) {
              setOrgSettings(parseOrgData(payload.new));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [memberData?.id, fetchData, fetchMealHistory]);

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

  // Toggle a meal for today (skip/want - saves to backend)
  const handleToggleMeal = async (mealType) => {
    // Check if locked
    if (isMealLocked(mealType)) {
      toast.error(`Cannot change ${mealType} - skip deadline has passed`);
      return;
    }

    try {
      setSkipping(mealType);
      const today = new Date().toISOString().split('T')[0];
      const currentState = selections[today]?.[mealType] !== false;
      const newState = !currentState;

      const response = await fetch('/api/meal-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: memberData.id,
          memberType: memberType,
          selections: [{
            date: today,
            breakfast: mealType === 'breakfast' ? newState : selections[today]?.breakfast ?? true,
            lunch: mealType === 'lunch' ? newState : selections[today]?.lunch ?? true,
            dinner: mealType === 'dinner' ? newState : selections[today]?.dinner ?? true,
          }],
        }),
      });

      if (response.ok) {
        setSelections((prev) => ({
          ...prev,
          [today]: { ...prev[today], [mealType]: newState },
        }));

        if (!newState) {
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
            console.log('Token skip skipped:', skipError);
          }
        }

        toast.success(
          newState
            ? `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} confirmed`
            : `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} skipped for today`
        );
      } else {
        toast.error('Failed to update meal');
      }
    } catch (error) {
      console.error('Error toggling meal:', error);
      toast.error('Failed to update meal');
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
      [dateStr]: { ...prev[dateStr], [mealType]: !prev[dateStr]?.[mealType] },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

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

  const skipDeadlineMinutes = orgSettings?.mealSkipDeadline || 30;

  return (
    <div className="space-y-3 pb-6">
      {/* Header */}
      <div className="bg-white border border-gray-200">
        <div className="flex items-center justify-between p-2.5 lg:p-3 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 lg:w-4.5 lg:h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm lg:text-base font-bold text-gray-900">My Meals</h1>
              <p className="text-[9px] lg:text-[10px] text-gray-500">{formatDate(todayDate, 'EEEE, MMM d')}</p>
            </div>
          </div>
          {/* Skip deadline info badge */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white/80 border border-gray-200 rounded-md">
            <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[9px] lg:text-[10px] font-semibold text-gray-600">
              Skip deadline: {skipDeadlineMinutes} min before
            </span>
          </div>
        </div>

        {/* Meal Stats Pills */}
        {memberPackage && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 lg:px-3 lg:py-2.5 border-t border-gray-100 overflow-x-auto">
            {MEAL_TYPES.map((meal) => {
              const isEnabled = memberPackage[`${meal.value}_enabled`];
              const stats = memberPackage.mealStats?.[meal.value] || { consumed: 0, total: 0, remaining: 0 };
              return (
                <div
                  key={meal.value}
                  className={`flex items-center gap-1 px-2 py-1 lg:px-2.5 lg:py-1.5 rounded-md flex-shrink-0 border ${
                    isEnabled && stats.remaining > 0
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-200 opacity-50'
                  }`}
                >
                  <span className="text-[10px] lg:text-xs font-bold" style={{ color: isEnabled ? meal.color : '#9ca3af' }}>
                    {meal.label.charAt(0)}:
                  </span>
                  <span className={`text-xs lg:text-sm font-extrabold ${isEnabled && stats.remaining > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    {stats.remaining}
                  </span>
                  <span className="text-[8px] lg:text-[9px] text-gray-500">left</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowSelectionModal(true)}
          className="bg-white border border-indigo-200 p-2 lg:p-2.5 hover:bg-indigo-50 transition-all flex items-center gap-2"
        >
          <div className="w-7 h-7 lg:w-8 lg:h-8 bg-indigo-600 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="text-left flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-[11px] lg:text-xs truncate">Skip Meals</h3>
            <p className="text-[9px] lg:text-[10px] text-gray-500 truncate">Manage days</p>
          </div>
        </button>

        <button
          onClick={() => setShowHistoryModal(true)}
          className="bg-white border border-green-200 p-2 lg:p-2.5 hover:bg-green-50 transition-all flex items-center gap-2"
        >
          <div className="w-7 h-7 lg:w-8 lg:h-8 bg-green-600 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="text-left flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-[11px] lg:text-xs truncate">History</h3>
            <p className="text-[9px] lg:text-[10px] text-gray-500 truncate">View past meals</p>
          </div>
        </button>
      </div>

      {/* Today's Meals */}
      <div className="bg-white border border-gray-200">
        <div className="px-3 py-2.5 lg:px-4 lg:py-3 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50">
          <h2 className="font-bold text-gray-900 text-xs lg:text-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            Today&apos;s Meals
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {availableMealsToday.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
              <h3 className="text-xs lg:text-sm font-semibold text-gray-700">No Meals Today</h3>
              <p className="text-[10px] lg:text-xs text-gray-500 mt-0.5">No meals scheduled for today.</p>
            </div>
          ) : (
            <>
              {availableMealsToday.map((meal) => {
                const isSelected = selections[todayStr]?.[meal.value] !== false;
                const tokenStatus = getTodayMealStatus(meal.value);
                const isCollected = tokenStatus === 'COLLECTED';
                const isCancelled = tokenStatus === 'CANCELLED' || tokenStatus === 'SKIPPED';
                const locked = isMealLocked(meal.value);
                const deadlineTime = getDeadlineTime(meal.value);
                const timeLeft = getTimeUntilDeadline(meal.value);
                const mealTime = getMealTimeDisplay(meal.value);

                // Determine status
                let statusText = 'Confirmed';
                let statusColor = 'bg-green-600';
                if (isCollected) {
                  statusText = 'Done';
                  statusColor = 'bg-green-600';
                } else if (isCancelled || !isSelected) {
                  statusText = 'Skipped';
                  statusColor = 'bg-red-600';
                } else if (locked) {
                  statusText = 'Locked';
                  statusColor = 'bg-indigo-600';
                }

                return (
                  <div key={meal.value} className="p-2.5 lg:p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      {/* Icon */}
                      <div
                        className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: isCollected ? '#dcfce7' : isSelected ? `${meal.color}15` : '#fee2e2',
                          border: `1.5px solid ${isCollected ? '#86efac' : isSelected ? meal.color + '40' : '#fecaca'}`
                        }}
                      >
                        <span className="text-base lg:text-lg font-bold" style={{ color: isCollected ? '#22c55e' : isSelected ? meal.color : '#ef4444' }}>
                          {meal.label.charAt(0)}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-xs lg:text-sm">{meal.label}</h4>
                        <p className="text-[10px] lg:text-xs text-gray-500">{mealTime}</p>
                        {/* Deadline info */}
                        {!isCollected && deadlineTime && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {locked ? (
                              <span className="text-[9px] lg:text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Deadline passed ({formatTimeDisplay(orgSettings?.mealTimes?.[meal.value]?.start?.slice(0, 5))})
                              </span>
                            ) : (
                              <span className="text-[9px] lg:text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Deadline: {formatTimeDisplay(`${deadlineTime.getHours().toString().padStart(2, '0')}:${deadlineTime.getMinutes().toString().padStart(2, '0')}`)} ({timeLeft})
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Toggle Switch */}
                      {!isCollected && (
                        <button
                          onClick={() => handleToggleMeal(meal.value)}
                          disabled={skipping === meal.value || locked}
                          className={`relative inline-flex h-6 w-11 lg:h-7 lg:w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex-shrink-0 ${
                            locked
                              ? 'opacity-50 cursor-not-allowed'
                              : 'disabled:opacity-50'
                          } ${
                            isSelected && !isCancelled ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          title={
                            locked
                              ? 'Deadline passed - cannot change'
                              : isSelected && !isCancelled
                              ? 'Click to skip'
                              : 'Click to confirm'
                          }
                        >
                          {locked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          <span
                            className={`inline-block h-4 w-4 lg:h-5 lg:w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                              isSelected && !isCancelled ? 'translate-x-6 lg:translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}

                      {/* Status Badge */}
                      <span className={`text-[9px] lg:text-[10px] ${statusColor} text-white px-2 py-1 rounded-md font-bold flex-shrink-0`}>
                        {statusText}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Unavailable meals */}
              {enabledMeals.filter(meal => !isMealAvailableOnDate(meal.value, todayDate)).map((meal) => (
                <div key={meal.value} className="flex items-center gap-2.5 p-2.5 lg:p-3 bg-gray-50 opacity-60">
                  <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-200 border border-gray-300">
                    <span className="text-base lg:text-lg font-bold text-gray-400">
                      {meal.label.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-500 text-xs lg:text-sm">{meal.label}</h4>
                    <p className="text-[10px] lg:text-xs text-gray-400">{getMealTimeDisplay(meal.value)}</p>
                  </div>
                  <span className="text-[9px] lg:text-[10px] bg-gray-300 text-gray-600 px-2 py-1 rounded-md font-bold">
                    Off
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Weekly Schedule */}
      <div className="bg-white border border-gray-200">
        <div className="px-2.5 py-2 lg:px-3 lg:py-2.5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="font-bold text-gray-900 text-[11px] lg:text-xs flex items-center gap-1.5">
            <svg className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Weekly Schedule
          </h2>
        </div>

        <div className="p-2.5 lg:p-3 space-y-2">
          {enabledMeals.map((meal) => {
            const days = memberPackage[`${meal.value}_days`] || [];
            const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            return (
              <div key={meal.value} className="p-2 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div
                    className="w-6 h-6 lg:w-7 lg:h-7 rounded-md flex items-center justify-center border"
                    style={{ backgroundColor: `${meal.color}15`, borderColor: `${meal.color}40` }}
                  >
                    <span className="text-[10px] lg:text-xs font-bold" style={{ color: meal.color }}>
                      {meal.label.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-[10px] lg:text-[11px]">{meal.label}</p>
                    <p className="text-[8px] lg:text-[9px] text-gray-500">{getMealTimeDisplay(meal.value)}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {allDays.map((day, idx) => {
                    const isActive = days.length === 0 || days.map(d => d.toLowerCase()).includes(fullDays[idx].toLowerCase());
                    return (
                      <span
                        key={day}
                        className={`px-1.5 py-0.5 text-[8px] lg:text-[9px] font-bold rounded-sm ${
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

      {/* Meal Preferences Modal */}
      {showSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 lg:p-4">
          <div className="bg-white rounded-lg lg:rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
            <div className="p-3 lg:p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h3 className="font-bold text-sm lg:text-base text-gray-900">Manage Meal Preferences</h3>
                <p className="text-[10px] lg:text-xs text-gray-500 mt-0.5">Select meals for each day</p>
              </div>
              <button
                onClick={() => setShowSelectionModal(false)}
                className="p-1.5 hover:bg-white/50 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 lg:p-4">
              <div className="space-y-2.5">
                {selectableDates.map((date, index) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isToday = index === 0;
                  const daySelection = selections[dateStr] || {};
                  const availableMealsForDay = enabledMeals.filter(meal => isMealAvailableOnDate(meal.value, date));

                  if (availableMealsForDay.length === 0) return null;

                  let selectedCount = 0;
                  availableMealsForDay.forEach(meal => {
                    if (daySelection[meal.value] !== false) selectedCount++;
                  });
                  const allSelected = selectedCount === availableMealsForDay.length;

                  return (
                    <div
                      key={dateStr}
                      className={`border ${
                        isToday
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between p-2.5 lg:p-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 lg:w-9 lg:h-9 rounded-md flex items-center justify-center ${
                            isToday ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <span className="text-xs lg:text-sm font-bold">{date.getDate()}</span>
                          </div>
                          <div>
                            <p className="font-bold text-xs lg:text-sm text-gray-900">
                              {formatDate(date, 'EEEE')}
                              {isToday && <span className="ml-1.5 text-[9px] lg:text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                            </p>
                            <p className="text-[9px] lg:text-[10px] text-gray-500">{formatDate(date, 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAllMealsForDate(dateStr, date, !allSelected)}
                          className={`px-2.5 py-1 lg:px-3 lg:py-1.5 text-[10px] lg:text-xs font-bold rounded-md transition-colors ${
                            allSelected
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {allSelected ? 'Skip All' : 'Want All'}
                        </button>
                      </div>

                      <div className="divide-y divide-gray-100">
                        {availableMealsForDay.map((meal) => {
                          const isSelected = daySelection[meal.value] !== false;

                          return (
                            <label
                              key={meal.value}
                              className={`flex items-center gap-2.5 p-2.5 lg:p-3 cursor-pointer transition-all hover:bg-gray-50 ${
                                isSelected ? 'bg-green-50/50' : 'bg-red-50/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleMeal(dateStr, meal.value)}
                                className="sr-only"
                              />
                              <div
                                className={`w-5 h-5 lg:w-6 lg:h-6 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                                  isSelected ? 'bg-green-500' : 'bg-red-500'
                                }`}
                              >
                                {isSelected ? (
                                  <svg className="w-3 h-3 lg:w-4 lg:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 lg:w-4 lg:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </div>
                              <div
                                className="w-7 h-7 lg:w-8 lg:h-8 rounded-md flex items-center justify-center flex-shrink-0 border"
                                style={{ backgroundColor: `${meal.color}15`, borderColor: `${meal.color}40` }}
                              >
                                <span className="text-xs lg:text-sm font-bold" style={{ color: meal.color }}>
                                  {meal.label.charAt(0)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 text-[11px] lg:text-xs">{meal.label}</p>
                                <p className="text-[9px] lg:text-[10px] text-gray-500">{getMealTimeDisplay(meal.value)}</p>
                              </div>
                              <span className={`text-[9px] lg:text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isSelected ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                              }`}>
                                {isSelected ? 'Wanted' : 'Skipped'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 lg:p-4 border-t border-gray-100 flex gap-2 lg:gap-3 flex-shrink-0">
              <button
                onClick={() => setShowSelectionModal(false)}
                className="flex-1 px-3 py-2 lg:px-4 lg:py-2.5 bg-gray-100 text-gray-700 rounded-md lg:rounded-lg text-xs lg:text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSelections}
                disabled={saving}
                className="flex-1 px-3 py-2 lg:px-4 lg:py-2.5 bg-green-600 text-white rounded-md lg:rounded-lg text-xs lg:text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Meal History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Meal History</h3>
                <p className="text-sm text-gray-500 mt-1">Last 30 days of meal activity</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 space-y-3 flex-shrink-0">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
                    { value: 'COLLECTED', label: 'Collected', color: 'bg-green-100 text-green-700' },
                    { value: 'PENDING', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
                    { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
                    { value: 'EXPIRED', label: 'Missed', color: 'bg-gray-100 text-gray-700' },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setHistoryFilter(filter.value)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        historyFilter === filter.value
                          ? filter.color + ' ring-2 ring-offset-1 ring-current'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block">Meal Type</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'all', label: 'All Meals' },
                    { value: 'BREAKFAST', label: 'Breakfast' },
                    { value: 'LUNCH', label: 'Lunch' },
                    { value: 'DINNER', label: 'Dinner' },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setHistoryMealFilter(filter.value)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        historyMealFilter === filter.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {(() => {
                let filteredHistory = mealHistory;
                if (historyFilter !== 'all') {
                  filteredHistory = filteredHistory.filter((token) => token.status === historyFilter);
                }
                if (historyMealFilter !== 'all') {
                  filteredHistory = filteredHistory.filter((token) => token.meal_type === historyMealFilter);
                }

                const groupedByDate = filteredHistory.reduce((acc, token) => {
                  const date = token.token_date;
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(token);
                  return acc;
                }, {});

                const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

                if (sortedDates.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">No Results</h3>
                      <p className="text-xs text-gray-500">No meal history found with the selected filters.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {sortedDates.map((date) => {
                      const tokens = groupedByDate[date];
                      const dateObj = new Date(date);

                      return (
                        <div key={date} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-bold text-white">{dateObj.getDate()}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {formatDate(dateObj, 'EEEE')}
                              </p>
                              <p className="text-xs text-gray-500">{formatDate(dateObj, 'MMM d, yyyy')}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {tokens.map((token) => {
                              const meal = MEAL_TYPES.find((m) => m.value === token.meal_type.toLowerCase());
                              const statusConfig = {
                                COLLECTED: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-600', text: 'Collected' },
                                PENDING: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600', text: 'Pending' },
                                CANCELLED: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', text: 'Cancelled' },
                                SKIPPED: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', text: 'Skipped' },
                                EXPIRED: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-600', text: 'Missed' },
                              };

                              const status = statusConfig[token.status] || statusConfig.PENDING;

                              return (
                                <div
                                  key={token.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border ${status.bg} ${status.border}`}
                                >
                                  {meal && (
                                    <div
                                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{ backgroundColor: `${meal.color}20` }}
                                    >
                                      <span className="text-sm font-bold" style={{ color: meal.color }}>
                                        {meal.label.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-900 text-sm">{token.meal_type}</h4>
                                    <p className="text-xs text-gray-500">
                                      Token #{token.token_no}
                                      {token.collected_at && (
                                        <> • Collected at {new Date(token.collected_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</>
                                      )}
                                    </p>
                                  </div>
                                  <span className={`text-[10px] ${status.badge} text-white px-2 py-1 rounded font-semibold`}>
                                    {status.text}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
