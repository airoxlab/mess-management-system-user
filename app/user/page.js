'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, getMealTimeStatus, getDayName, MEAL_TYPES } from '@/lib/utils';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { toast } from 'sonner';

// Animated counter hook
function useCountUp(end, duration = 1000, delay = 0) {
  const [count, setCount] = useState(0);
  const startTime = useRef(null);
  const animationFrame = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (timestamp) => {
        if (!startTime.current) startTime.current = timestamp;
        const progress = Math.min((timestamp - startTime.current) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(easeOut * end));

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animate);
        }
      };
      animationFrame.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [end, duration, delay]);

  return count;
}

// Animated number component
function AnimatedNumber({ value, delay = 0 }) {
  const count = useCountUp(value, 1200, delay);
  return <span className="font-mono-number">{count}</span>;
}

// Food icons for meals
const MealIcons = {
  breakfast: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 3a1 1 0 0 1 .993.883L19 4v16a1 1 0 0 1-1.993.117L17 20v-5h-2a1 1 0 0 1-.117-1.993L15 13h2V4a1 1 0 0 1 1-1zM9 2c2.21 0 4 1.79 4 4v1h1a1 1 0 0 1 .993.883L15 8v2a4 4 0 0 1-3.8 3.995L11 14H8v6a1 1 0 0 1-1.993.117L6 20V8a1 1 0 0 1 .883-.993L7 7h1V6a4 4 0 0 1 1-2.83V2zM9 4a2 2 0 0 0-1.995 1.85L7 6v1h4V6a2 2 0 0 0-2-2z"/>
    </svg>
  ),
  lunch: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
    </svg>
  ),
  dinner: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>
    </svg>
  ),
};

export default function UserDashboardPage() {
  const { memberData, memberType } = useAuth();
  const [memberPackage, setMemberPackage] = useState(null);
  const [todaySelections, setTodaySelections] = useState(null);
  const [todayTokens, setTodayTokens] = useState([]);
  const [weeklyTokens, setWeeklyTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const mealTimeStatus = getMealTimeStatus();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    if (!memberData?.id) return;

    try {
      // Auto-generate tokens for today
      try {
        const genRes = await fetch('/api/generate-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: memberData.id,
            memberType: memberType,
            date: new Date().toISOString().split('T')[0],
          }),
        });
        const genData = await genRes.json();
        if (!genRes.ok) {
          toast.error(genData.error || 'Failed to generate tokens');
        }
      } catch (genError) {
        toast.error('Token generation failed');
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

      // Set up real-time subscription
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
          () => fetchData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'member_meal_packages',
            filter: `member_id=eq.${memberData.id}`,
          },
          () => fetchData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meal_selections',
            filter: `member_id=eq.${memberData.id}`,
          },
          () => fetchData()
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

  const getEnabledMeals = () => {
    if (!memberPackage) return [];
    return MEAL_TYPES.filter(meal => memberPackage[`${meal.value}_enabled`]);
  };

  const isMealAvailableToday = (mealValue) => {
    if (!memberPackage) return false;
    const isEnabled = memberPackage[`${mealValue}_enabled`];
    if (!isEnabled) return false;

    const mealDays = memberPackage[`${mealValue}_days`] || [];
    if (mealDays.length === 0) return true;

    const todayName = getDayName(new Date()).toLowerCase();
    return mealDays.map(d => d.toLowerCase()).includes(todayName);
  };

  const enabledMeals = getEnabledMeals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  // Calculate total meal stats
  const getTotalMealStats = () => {
    if (!memberPackage) return { total: 0, consumed: 0, remaining: 0 };

    // For daily_basis packages, stats are different (balance-based)
    if (memberPackage.package_type === 'daily_basis') {
      return {
        total: 0,
        consumed: 0,
        remaining: 0,
        balance: memberPackage.balance
      };
    }

    let total = 0, consumed = 0;
    const meals = ['breakfast', 'lunch', 'dinner'];

    meals.forEach((meal) => {
      if (memberPackage[`${meal}_enabled`]) {
        const mealTotal = memberPackage.mealStats?.[meal]?.total || 0;
        const mealConsumed = memberPackage.mealStats?.[meal]?.consumed || 0;
        total += mealTotal;
        consumed += mealConsumed;
      }
    });

    return { total, consumed, remaining: total - consumed };
  };

  const totalStats = getTotalMealStats();

  // Weekly calendar data
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
    <div className="space-y-3 lg:space-y-6 pb-6 lg:pb-8">
      {/* Modern Flat Header - Mobile First */}
      <div className="bg-white">
        {/* Top Bar - Compact */}
        <div className="flex items-center justify-between p-3 lg:p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Small Profile */}
            <div className="relative">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm lg:text-lg font-bold shadow-sm">
                {memberData?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 lg:w-4 lg:h-4 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            {/* Name & Type */}
            <div>
              <h1 className="text-base lg:text-xl font-bold text-gray-900">
                {memberData?.full_name?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-[10px] lg:text-xs text-gray-500 capitalize">{memberType}</p>
            </div>
          </div>

          {/* Time & Status - Minimal */}
          <div className="text-right">
            <p className="text-sm lg:text-base font-semibold text-gray-900">{formatPakistanTime(currentTime).slice(0, -3)}</p>
            <div className="flex items-center justify-end gap-1 lg:gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${mealTimeStatus.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span className="text-[10px] lg:text-xs text-gray-500">{mealTimeStatus.label}</span>
            </div>
          </div>
        </div>

        {/* Stats Bar - Inline */}
        {memberPackage && (
          <div className="px-3 py-2 lg:px-4 lg:py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 lg:gap-4">
                {/* Meal Balance */}
                <div>
                  <p className="text-[10px] lg:text-xs text-gray-500 font-medium">Meals Left</p>
                  <p className="text-2xl lg:text-3xl font-extrabold text-indigo-600">
                    <AnimatedNumber value={totalStats.remaining} delay={100} />
                  </p>
                </div>

                {/* Package Type */}
                <div className="border-l border-gray-200 pl-3 lg:pl-4">
                  <p className="text-[10px] lg:text-xs text-gray-500 font-medium">Package</p>
                  <p className="text-xs lg:text-sm font-bold text-gray-900">{memberPackage.packageTypeLabel}</p>
                </div>
              </div>

              {/* Validity Badge */}
              {memberPackage.package_type !== 'daily_basis' && (
                <div>
                  {memberPackage.isExpired ? (
                    <span className="px-2 py-1 lg:px-3 lg:py-1.5 bg-red-100 text-red-700 rounded-md text-[10px] lg:text-xs font-semibold">
                      Expired
                    </span>
                  ) : memberPackage.isUnlimited ? (
                    <span className="px-2 py-1 lg:px-3 lg:py-1.5 bg-green-100 text-green-700 rounded-md text-[10px] lg:text-xs font-semibold">
                      Unlimited
                    </span>
                  ) : memberPackage.daysRemaining <= 7 ? (
                    <span className="px-2 py-1 lg:px-3 lg:py-1.5 bg-amber-100 text-amber-700 rounded-md text-[10px] lg:text-xs font-semibold">
                      {memberPackage.daysRemaining}d left
                    </span>
                  ) : (
                    <span className="px-2 py-1 lg:px-3 lg:py-1.5 bg-blue-100 text-blue-700 rounded-md text-[10px] lg:text-xs font-semibold">
                      {memberPackage.daysRemaining}d
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Meal Breakdown - Horizontal Pills */}
            {memberPackage.package_type !== 'daily_basis' && (
              <div className="flex items-center gap-2 mt-2 lg:mt-3 overflow-x-auto pb-1">
                {memberPackage.breakfast_enabled && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-amber-200 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                    <span className="text-[10px] lg:text-xs font-semibold text-gray-700">B: {memberPackage.mealStats.breakfast.remaining}/{memberPackage.mealStats.breakfast.total}</span>
                  </div>
                )}
                {memberPackage.lunch_enabled && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-green-200 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span className="text-[10px] lg:text-xs font-semibold text-gray-700">L: {memberPackage.mealStats.lunch.remaining}/{memberPackage.mealStats.lunch.total}</span>
                  </div>
                )}
                {memberPackage.dinner_enabled && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-blue-200 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-[10px] lg:text-xs font-semibold text-gray-700">D: {memberPackage.mealStats.dinner.remaining}/{memberPackage.mealStats.dinner.total}</span>
                  </div>
                )}
              </div>
            )}

            {/* Daily Basis Balance */}
            {memberPackage.package_type === 'daily_basis' && (
              <div className="flex items-center justify-between mt-2 lg:mt-3">
                <div>
                  <p className="text-[10px] lg:text-xs text-gray-500">Balance</p>
                  <p className="text-lg lg:text-xl font-bold text-gray-900">Rs. {memberPackage.balance.toLocaleString()}</p>
                </div>
                <div className="flex gap-2 text-[10px] lg:text-xs">
                  {memberPackage.breakfast_enabled && <span className="text-gray-600">B: Rs.{memberPackage.breakfast_price}</span>}
                  {memberPackage.lunch_enabled && <span className="text-gray-600">L: Rs.{memberPackage.lunch_price}</span>}
                  {memberPackage.dinner_enabled && <span className="text-gray-600">D: Rs.{memberPackage.dinner_price}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Stats Cards - Hidden on mobile, shown on desktop */}
      {memberPackage && memberPackage.package_type !== 'daily_basis' && (
        <div className="hidden lg:grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-delay-1">
          {/* Total Meals Card */}
          <div className="stats-card bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-blue-100 shadow-soft">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-9 h-9 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-[10px] lg:text-xs font-semibold text-blue-600 bg-blue-100 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full">Total</span>
            </div>
            <p className="text-2xl lg:text-4xl font-extrabold text-gray-900 animate-count-up">
              <AnimatedNumber value={totalStats.total} delay={100} />
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Total Meals</p>
          </div>

          {/* Consumed Card */}
          <div className="stats-card bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-green-100 shadow-soft">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-9 h-9 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[10px] lg:text-xs font-semibold text-green-600 bg-green-100 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full">
                {totalStats.total > 0 ? Math.round((totalStats.consumed / totalStats.total) * 100) : 0}%
              </span>
            </div>
            <p className="text-2xl lg:text-4xl font-extrabold text-gray-900">
              <AnimatedNumber value={totalStats.consumed} delay={200} />
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Consumed</p>
          </div>

          {/* Available Card */}
          <div className="stats-card bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-amber-100 shadow-soft">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-9 h-9 lg:w-12 lg:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-[10px] lg:text-xs font-semibold text-amber-600 bg-amber-100 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full">Left</span>
            </div>
            <p className="text-2xl lg:text-4xl font-extrabold text-gray-900">
              <AnimatedNumber value={totalStats.total - totalStats.consumed} delay={300} />
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Available</p>
          </div>

          {/* Remaining Card */}
          <div className="stats-card bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-purple-100 shadow-soft">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-9 h-9 lg:w-12 lg:h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span className="text-[10px] lg:text-xs font-semibold text-purple-600 bg-purple-100 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full">Total</span>
            </div>
            <p className="text-2xl lg:text-4xl font-extrabold text-gray-900">
              <AnimatedNumber value={totalStats.remaining} delay={400} />
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Remaining</p>
          </div>
        </div>
      )}

      {/* Today's Meals - Modern Flat Design */}
      {memberPackage && enabledMeals.length > 0 ? (
        <div className="bg-white border border-gray-200">
          <div className="flex items-center justify-between p-3 lg:p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <h2 className="text-sm lg:text-base font-bold text-gray-900">Today&apos;s Meals</h2>
            </div>
            <Link
              href="/user/meals"
              className="text-[10px] lg:text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
            >
              Manage
              <svg className="w-3 h-3 lg:w-3.5 lg:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {enabledMeals.map((meal) => {
              const isAvailableToday = isMealAvailableToday(meal.value);
              const isSelected = todaySelections?.[`${meal.value}_needed`] !== false;
              const isCurrentMeal = mealTimeStatus.meal === meal.value && isAvailableToday;
              const todayStatus = memberPackage.todayMealStatus?.[meal.value];
              const stats = memberPackage.mealStats?.[meal.value] || { total: 0, consumed: 0, remaining: 0 };

              // Status
              let statusText = 'Available';
              let statusColor = 'bg-amber-600';
              let statusBg = 'bg-amber-50';

              if (!isAvailableToday) {
                statusText = 'Off';
                statusColor = 'bg-gray-400';
                statusBg = 'bg-gray-50';
              } else if (todayStatus === 'COLLECTED') {
                statusText = 'Done';
                statusColor = 'bg-green-600';
                statusBg = 'bg-green-50';
              } else if (todayStatus === 'CANCELLED' || !isSelected) {
                statusText = 'Skip';
                statusColor = 'bg-red-600';
                statusBg = 'bg-red-50';
              }

              return (
                <div key={meal.value} className={`p-2.5 lg:p-3 hover:bg-gray-50 transition-colors ${!isAvailableToday ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    {/* Icon - Ultra Compact */}
                    <div
                      className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
                      style={{
                        backgroundColor: todayStatus === 'COLLECTED' ? '#dcfce7' : isAvailableToday && isSelected ? `${meal.color}15` : '#fee2e2',
                        borderColor: todayStatus === 'COLLECTED' ? '#86efac' : isAvailableToday && isSelected ? `${meal.color}40` : '#fecaca'
                      }}
                    >
                      <span className="text-base lg:text-lg font-bold" style={{
                        color: todayStatus === 'COLLECTED' ? '#22c55e' : isAvailableToday && isSelected ? meal.color : '#ef4444'
                      }}>
                        {meal.label.charAt(0)}
                      </span>
                    </div>

                    {/* Info - Compact */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-xs lg:text-sm font-bold text-gray-900">{meal.label}</h3>
                        {isCurrentMeal && (
                          <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-bold rounded-sm">
                            NOW
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] lg:text-xs text-gray-500">{meal.time}</p>
                      <p className="text-[9px] lg:text-[10px] text-gray-400 mt-0.5">
                        {stats.consumed}/{stats.total} consumed
                      </p>
                    </div>

                    {/* Status Badge - Modern */}
                    <span className={`text-[9px] lg:text-[10px] ${statusColor} text-white px-2 py-1 rounded-md font-bold flex-shrink-0`}>
                      {statusText}
                    </span>

                    {/* Count - Bold */}
                    <div className="text-right flex-shrink-0 min-w-[40px] lg:min-w-[45px]">
                      <p className="text-xl lg:text-2xl font-extrabold text-gray-900">{stats.remaining}</p>
                      <p className="text-[9px] lg:text-[10px] text-gray-500">left</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* No Package State */
        <div className="glass rounded-3xl p-12 text-center animate-fade-in-delay-1">
          <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-900 text-2xl mb-3">No Active Package</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            You don&apos;t have an active meal package. Please contact the cafeteria admin to get a package assigned.
          </p>
          <Link
            href="/user/profile"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            View Profile
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {/* Weekly Activity - Compact on mobile */}
      {memberPackage && (
        <div className="glass rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-soft animate-fade-in-delay-3">
          <div className="flex items-center justify-between mb-3 lg:mb-5">
            <h3 className="font-bold text-gray-900 text-base lg:text-lg">Weekly Activity</h3>
            <Link
              href="/user/history"
              className="text-xs lg:text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View All
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1.5 lg:gap-3">
            {weeklyCalendar.map((day) => (
              <div
                key={day.dateStr}
                className={`calendar-day rounded-lg lg:rounded-xl p-2 lg:p-3 text-center transition-all cursor-default ${
                  day.isToday
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg'
                    : day.collected > 0 && day.collected === day.total
                    ? 'bg-green-100 border-2 border-green-300'
                    : day.collected > 0
                    ? 'bg-green-50 border border-green-200'
                    : day.hasActivity
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <p className={`text-[10px] lg:text-xs font-semibold ${day.isToday ? 'text-white/80' : 'text-gray-500'}`}>
                  {day.dayName}
                </p>
                <p className={`text-base lg:text-xl font-bold ${day.isToday ? 'text-white' : 'text-gray-900'}`}>
                  {day.dayNum}
                </p>
                {day.hasActivity && !day.isToday && (
                  <div className="flex justify-center gap-0.5 lg:gap-1 mt-1 lg:mt-1.5">
                    {day.collected > 0 && (
                      <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-500 rounded-full" title={`${day.collected} collected`}></span>
                    )}
                    {day.pending > 0 && (
                      <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-amber-500 rounded-full" title={`${day.pending} pending`}></span>
                    )}
                    {day.cancelled > 0 && (
                      <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-red-500 rounded-full" title={`${day.cancelled} skipped`}></span>
                    )}
                  </div>
                )}
                {day.isToday && day.hasActivity && (
                  <div className="flex justify-center gap-0.5 lg:gap-1 mt-1 lg:mt-1.5">
                    <span className="text-[9px] lg:text-[10px] text-white/80">{day.collected}/{day.total}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legend - Compact on mobile */}
          <div className="flex justify-center gap-3 lg:gap-6 mt-3 lg:mt-5 text-[10px] lg:text-xs text-gray-500">
            <div className="flex items-center gap-1 lg:gap-1.5">
              <span className="w-2 h-2 lg:w-3 lg:h-3 bg-green-500 rounded-full"></span>
              <span>Collected</span>
            </div>
            <div className="flex items-center gap-1 lg:gap-1.5">
              <span className="w-2 h-2 lg:w-3 lg:h-3 bg-amber-500 rounded-full"></span>
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1 lg:gap-1.5">
              <span className="w-2 h-2 lg:w-3 lg:h-3 bg-red-500 rounded-full"></span>
              <span>Skipped</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions - Compact on mobile */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4 animate-fade-in-delay-4">
        <Link
          href="/user/meals"
          className="card-hover glass rounded-xl lg:rounded-2xl p-3 lg:p-5 flex flex-col items-center gap-2 lg:gap-3 border border-gray-100"
        >
          <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <span className="text-xs lg:text-sm font-bold text-gray-900">Schedule</span>
            <p className="text-[10px] lg:text-xs text-gray-500">Manage meals</p>
          </div>
        </Link>

        <Link
          href="/user/history"
          className="card-hover glass rounded-xl lg:rounded-2xl p-3 lg:p-5 flex flex-col items-center gap-2 lg:gap-3 border border-gray-100"
        >
          <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="text-center">
            <span className="text-xs lg:text-sm font-bold text-gray-900">History</span>
            <p className="text-[10px] lg:text-xs text-gray-500">Past meals</p>
          </div>
        </Link>

        <Link
          href="/user/profile"
          className="card-hover glass rounded-xl lg:rounded-2xl p-3 lg:p-5 flex flex-col items-center gap-2 lg:gap-3 border border-gray-100"
        >
          <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="text-center">
            <span className="text-xs lg:text-sm font-bold text-gray-900">Profile</span>
            <p className="text-[10px] lg:text-xs text-gray-500">Your info</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
