'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, getMealTimeStatus, getDayName, MEAL_TYPES } from '@/lib/utils';
import Link from 'next/link';
import supabase from '@/lib/supabase';

export default function UserDashboardPage() {
  const { memberData, memberType } = useAuth();
  const [memberPackage, setMemberPackage] = useState(null);
  const [todaySelections, setTodaySelections] = useState(null);
  const [todayTokens, setTodayTokens] = useState([]);
  const [weeklyTokens, setWeeklyTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dateFilter, setDateFilter] = useState('today'); // 'today', '7days', '30days'
  const mealTimeStatus = getMealTimeStatus();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    if (!memberData?.id) return;

    try {
      // Auto-generate tokens for today (runs silently in background)
      try {
        await fetch('/api/generate-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: memberData.id,
            memberType: memberType,
            date: new Date().toISOString().split('T')[0],
          }),
        });
      } catch (genError) {
        console.log('Token generation skipped');
      }

      // Fetch member package with stats
      try {
        const packageRes = await fetch(
          `/api/member-package?memberId=${memberData.id}&memberType=${memberType}`
        );
        if (packageRes.ok) {
          const packageData = await packageRes.json();
          setMemberPackage(packageData.package || null);
        }
      } catch (pkgError) {
        console.log('No package assigned');
        setMemberPackage(null);
      }

      // Fetch today's meal selections
      const today = new Date().toISOString().split('T')[0];
      try {
        const selectionsRes = await fetch(
          `/api/meal-selections?memberId=${memberData.id}&memberType=${memberType}&startDate=${today}&endDate=${today}`
        );
        if (selectionsRes.ok) {
          const selectionsData = await selectionsRes.json();
          setTodaySelections(selectionsData.selections?.[0] || null);
        }
      } catch (selError) {
        console.log('No selections found');
        setTodaySelections(null);
      }

      // Fetch today's tokens for real-time status
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

      // Fetch weekly tokens for weekly status
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      try {
        const weeklyRes = await fetch(
          `/api/meal-tokens?memberId=${memberData.id}&startDate=${weekAgo.toISOString().split('T')[0]}&endDate=${today}`
        );
        if (weeklyRes.ok) {
          const weeklyData = await weeklyRes.json();
          setWeeklyTokens(weeklyData.tokens || []);
        }
      } catch (weekError) {
        console.log('No weekly tokens');
        setWeeklyTokens([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [memberData?.id, memberType]);

  useEffect(() => {
    if (memberData?.id) {
      fetchData();

      // Set up real-time subscription for meal_tokens and member_meal_packages changes
      const channel = supabase
        .channel('dashboard-realtime')
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
            table: 'member_meal_packages',
            filter: `member_id=eq.${memberData.id}`,
          },
          (payload) => {
            console.log('Package update:', payload.eventType);
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
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [memberData?.id, fetchData]);

  const formatPakistanTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Get only enabled meals from package
  const getEnabledMeals = () => {
    if (!memberPackage) return [];
    return MEAL_TYPES.filter(meal => memberPackage[`${meal.value}_enabled`]);
  };

  // Check if a meal is available on a specific day based on *_days arrays
  const isMealAvailableToday = (mealValue) => {
    if (!memberPackage) return false;
    const isEnabled = memberPackage[`${mealValue}_enabled`];
    if (!isEnabled) return false;

    const mealDays = memberPackage[`${mealValue}_days`] || [];
    // If no days specified, meal is available every day
    if (mealDays.length === 0) return true;

    const todayName = getDayName(new Date()).toLowerCase();
    return mealDays.map(d => d.toLowerCase()).includes(todayName);
  };

  const enabledMeals = getEnabledMeals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // Calculate total meal stats based on filter
  const getTotalMealStats = () => {
    if (!memberPackage) return { total: 0, collected: 0, remaining: 0, pending: 0 };
    let total = 0, collected = 0, pending = 0;
    enabledMeals.forEach((meal) => {
      const stats = memberPackage.tokenStats?.[meal.value] || { collected: 0, pending: 0, total: 0 };
      total += stats.total;
      collected += stats.collected;
      pending += stats.pending;
    });
    return { total, collected, remaining: total - collected, pending };
  };

  const totalStats = getTotalMealStats();

  // Get token status for a specific meal today
  const getTodayMealStatus = (mealValue) => {
    const token = todayTokens.find(t => t.meal_type.toLowerCase() === mealValue);
    return token ? token.status : null;
  };

  // Generate weekly calendar data
  const getWeeklyCalendarData = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayTokens = weeklyTokens.filter(t => t.token_date === dateStr);
      const collected = dayTokens.filter(t => t.status === 'COLLECTED').length;
      const pending = dayTokens.filter(t => t.status === 'PENDING').length;
      const cancelled = dayTokens.filter(t => t.status === 'CANCELLED').length;
      const total = dayTokens.length;

      days.push({
        date,
        dateStr,
        dayName: getDayName(date).slice(0, 3),
        dayNum: date.getDate(),
        isToday: i === 0,
        collected,
        pending,
        cancelled,
        total,
        hasActivity: total > 0,
      });
    }
    return days;
  };

  const weeklyCalendar = getWeeklyCalendarData();

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-primary-600 to-emerald-500 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white text-xl font-bold">
              {memberData?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-lg font-bold">
                {getGreeting()}, {memberData?.full_name?.split(' ')[0]}!
              </h1>
              <p className="text-white/80 text-sm">{formatDate(currentTime, 'EEE, MMM d')} • <span className="capitalize">{memberType}</span></p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-mono font-bold">{formatPakistanTime(currentTime)}</p>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${mealTimeStatus.status === 'active' ? 'bg-white animate-pulse' : 'bg-white/50'}`}></div>
              <span className="text-xs text-white/80">{mealTimeStatus.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Meal Summary - Only show if package exists */}
      {memberPackage ? (
        <>
          {/* Total Meals Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">Meals Overview</h3>
              <div className="flex items-center gap-2">
                {memberPackage.isUnlimited ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                    Unlimited
                  </span>
                ) : memberPackage.daysRemaining !== null && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    {memberPackage.daysRemaining} days left
                  </span>
                )}
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 mb-4">
              {[
                { key: 'today', label: 'Today' },
                { key: '7days', label: '7 Days' },
                { key: '30days', label: '30 Days' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setDateFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    dateFilter === f.key
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Summary Stats Row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{totalStats.total}</p>
                <p className="text-[10px] text-gray-500">Total</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-600">{totalStats.collected}</p>
                <p className="text-[10px] text-gray-500">Collected</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-amber-600">{totalStats.pending}</p>
                <p className="text-[10px] text-gray-500">Pending</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-600">{totalStats.remaining}</p>
                <p className="text-[10px] text-gray-500">Remaining</p>
              </div>
            </div>

            {/* Individual Meals with Real-time Status */}
            <div className="space-y-3">
              {enabledMeals.map((meal) => {
                const stats = memberPackage.tokenStats?.[meal.value] || { collected: 0, pending: 0, total: 0 };
                const remaining = stats.total - stats.collected;
                const isAvailableToday = isMealAvailableToday(meal.value);
                const isSelected = todaySelections?.[`${meal.value}_needed`] !== false;
                const isCurrentMeal = mealTimeStatus.meal === meal.value && isAvailableToday;
                const todayStatus = getTodayMealStatus(meal.value);

                return (
                  <div
                    key={meal.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isCurrentMeal
                        ? 'bg-gradient-to-r from-primary-50 to-emerald-50 border-primary-200'
                        : todayStatus === 'COLLECTED'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    {/* Meal Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${meal.color}20` }}
                    >
                      <span className="text-lg font-bold" style={{ color: meal.color }}>
                        {meal.label.charAt(0)}
                      </span>
                    </div>

                    {/* Meal Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 text-sm">{meal.label}</h4>
                        {isCurrentMeal && (
                          <span className="text-[10px] bg-primary-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                            NOW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{meal.time}</p>
                    </div>

                    {/* Meal Stats */}
                    <div className="flex items-center gap-3 text-center">
                      <div>
                        <p className="text-sm font-bold text-green-600">{stats.collected}</p>
                        <p className="text-[10px] text-gray-400">Used</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-600">{remaining}</p>
                        <p className="text-[10px] text-gray-400">Left</p>
                      </div>
                    </div>

                    {/* Today Status - Real-time */}
                    <div className="flex-shrink-0">
                      {!isAvailableToday ? (
                        <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-1 rounded font-medium">Off</span>
                      ) : todayStatus === 'COLLECTED' ? (
                        <span className="text-[10px] bg-green-500 text-white px-2 py-1 rounded font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Done
                        </span>
                      ) : todayStatus === 'CANCELLED' || !isSelected ? (
                        <span className="text-[10px] bg-red-500 text-white px-2 py-1 rounded font-medium">Skipped</span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">Waiting</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Overall Progress</span>
                <span>{totalStats.total > 0 ? Math.round((totalStats.collected / totalStats.total) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${totalStats.total > 0 ? (totalStats.collected / totalStats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Weekly Status Cards */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Weekly Status</h3>
            <div className="grid grid-cols-7 gap-2">
              {weeklyCalendar.map((day) => (
                <div
                  key={day.dateStr}
                  className={`p-2 rounded-lg text-center transition-all ${
                    day.isToday
                      ? 'bg-primary-500 text-white'
                      : day.collected > 0 && day.collected === day.total
                      ? 'bg-green-100 border-2 border-green-400'
                      : day.collected > 0
                      ? 'bg-green-50 border border-green-200'
                      : day.hasActivity
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-gray-50'
                  }`}
                >
                  <p className={`text-[10px] font-medium ${day.isToday ? 'text-white/80' : 'text-gray-500'}`}>
                    {day.dayName}
                  </p>
                  <p className={`text-lg font-bold ${day.isToday ? 'text-white' : 'text-gray-900'}`}>
                    {day.dayNum}
                  </p>
                  {day.hasActivity && !day.isToday && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {day.collected > 0 && (
                        <span className="w-2 h-2 bg-green-500 rounded-full" title={`${day.collected} collected`}></span>
                      )}
                      {day.pending > 0 && (
                        <span className="w-2 h-2 bg-amber-500 rounded-full" title={`${day.pending} pending`}></span>
                      )}
                      {day.cancelled > 0 && (
                        <span className="w-2 h-2 bg-red-500 rounded-full" title={`${day.cancelled} skipped`}></span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-3 text-[10px] text-gray-500">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Collected</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                <span>Pending</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span>Skipped</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* No Package State */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-900 text-xl mb-2">No Active Package</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            You don&apos;t have an active meal package. Please contact the cafeteria admin to get a package assigned.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/user/meals"
          className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-gray-100"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-700">Schedule</span>
        </Link>

        <Link
          href="/user/history"
          className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-gray-100"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-700">History</span>
        </Link>

        <Link
          href="/user/profile"
          className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-gray-100"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center shadow">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-700">Profile</span>
        </Link>
      </div>
    </div>
  );
}
