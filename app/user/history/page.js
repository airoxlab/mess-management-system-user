'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatTime, classNames, MEAL_TYPES } from '@/lib/utils';
import supabase from '@/lib/supabase';

export default function MealHistoryPage() {
  const { memberData, memberType } = useAuth();
  const [memberPackage, setMemberPackage] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('month');

  // Get only enabled meals from package
  const getEnabledMeals = () => {
    if (!memberPackage) return MEAL_TYPES;
    return MEAL_TYPES.filter(meal => memberPackage[`${meal.value}_enabled`]);
  };

  const enabledMeals = getEnabledMeals();

  // Memoize fetchData to use in real-time subscription
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Auto-generate tokens for today (runs silently)
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
        console.log('No package assigned');
        setMemberPackage(null);
      }

      // Fetch meal tokens
      let startDate = '';
      const endDate = new Date().toISOString().split('T')[0];

      if (dateRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
      } else if (dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
      }

      let url = `/api/meal-tokens?memberId=${memberData.id}`;
      if (startDate) url += `&startDate=${startDate}&endDate=${endDate}`;

      const response = await fetch(url);
      const data = await response.json();
      setTokens(data.tokens || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [memberData?.id, memberType, dateRange]);

  // Initial fetch and real-time subscription
  useEffect(() => {
    if (!memberData?.id) return;

    fetchData();

    // Set up real-time subscription for meal_tokens and member_meal_packages changes
    const channel = supabase
      .channel('history-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
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
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberData?.id, memberType, dateRange, fetchData]);

  // Filter tokens - only show enabled meal types
  const filteredTokens = tokens.filter((token) => {
    const mealType = token.meal_type.toLowerCase();
    const isEnabledMeal = !memberPackage || memberPackage[`${mealType}_enabled`];
    if (!isEnabledMeal) return false;

    const statusMatch = filter === 'all' || token.status === filter.toUpperCase();
    return statusMatch;
  });

  // Sort tokens by date and time (most recent first)
  const sortedTokens = [...filteredTokens].sort((a, b) => {
    const dateA = new Date(`${a.token_date}T${a.token_time || '00:00:00'}`);
    const dateB = new Date(`${b.token_date}T${b.token_time || '00:00:00'}`);
    return dateB - dateA;
  });

  // Group tokens by date for timeline
  const groupedTokens = sortedTokens.reduce((groups, token) => {
    const date = token.token_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(token);
    return groups;
  }, {});

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COLLECTED':
        return (
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'PENDING':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'CANCELLED':
        return (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'EXPIRED':
        return (
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
          </div>
        );
    }
  };

  const getStatusMessage = (token) => {
    const mealName = token.meal_type.charAt(0) + token.meal_type.slice(1).toLowerCase();
    switch (token.status) {
      case 'COLLECTED':
        return `${mealName} collected`;
      case 'PENDING':
        return `${mealName} waiting`;
      case 'CANCELLED':
        return `${mealName} skipped`;
      case 'EXPIRED':
        return `${mealName} expired`;
      default:
        return `${mealName}`;
    }
  };

  const getTimestamp = (token) => {
    if (token.status === 'COLLECTED' && token.collected_at) {
      return formatDate(token.collected_at, 'h:mm a');
    }
    if (token.status === 'CANCELLED' && token.cancelled_at) {
      return formatDate(token.cancelled_at, 'h:mm a');
    }
    if (token.skipped_at) {
      return formatDate(token.skipped_at, 'h:mm a');
    }
    if (token.token_time) {
      return formatTime(token.token_time, 'h:mm a');
    }
    return '-';
  };

  const getDetailedTimestamp = (token) => {
    if (token.status === 'COLLECTED' && token.collected_at) {
      return `Collected at ${formatDate(token.collected_at, 'h:mm a')}`;
    }
    if (token.status === 'CANCELLED') {
      if (token.cancelled_at) {
        return `Cancelled at ${formatDate(token.cancelled_at, 'h:mm a')}`;
      }
      return 'Cancelled';
    }
    if (token.status === 'SKIPPED' && token.skipped_at) {
      return `Skipped at ${formatDate(token.skipped_at, 'h:mm a')}`;
    }
    if (token.status === 'PENDING') {
      return 'Waiting for collection';
    }
    if (token.status === 'EXPIRED') {
      return 'Meal time expired';
    }
    return '';
  };

  const getMealInfo = (mealType) => {
    const meal = MEAL_TYPES.find(m => m.value === mealType.toLowerCase());
    return meal || { label: mealType, color: '#6B7280', time: '' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-primary-600 to-emerald-500 rounded-xl p-3 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">Meal History</h1>
                <span className="flex items-center gap-1 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  Live
                </span>
              </div>
              <p className="text-white/80 text-xs">Real-time meal activity timeline</p>
            </div>
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-xs font-medium text-white focus:outline-none"
          >
            <option value="week" className="text-gray-900">7 days</option>
            <option value="month" className="text-gray-900">30 days</option>
            <option value="all" className="text-gray-900">All time</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.collected}</p>
            <p className="text-[10px] text-gray-500">Collected</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.pending}</p>
            <p className="text-[10px] text-gray-500">Pending</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.cancelled}</p>
            <p className="text-[10px] text-gray-500">Skipped</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-[10px] text-gray-500">Total</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 inline-flex min-w-max">
          {[
            { key: 'all', label: 'All', color: 'primary' },
            { key: 'collected', label: 'Collected', color: 'green' },
            { key: 'pending', label: 'Pending', color: 'amber' },
            { key: 'cancelled', label: 'Skipped', color: 'red' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={classNames(
                'px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap',
                filter === f.key ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Activity Timeline
          </h2>
        </div>

        {sortedTokens.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold mb-1">No activity found</p>
            <p className="text-gray-500 text-sm">Your meal history will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(groupedTokens).map(([date, dayTokens]) => (
              <div key={date} className="p-4">
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-600">
                      {new Date(date).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {formatDate(date, 'EEEE')}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {formatDate(date, 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Day's Activities */}
                <div className="ml-4 border-l-2 border-gray-200 pl-4 space-y-3">
                  {dayTokens.map((token) => {
                    const mealInfo = getMealInfo(token.meal_type);
                    return (
                      <div key={token.id} className="flex items-start gap-3 relative">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[22px] top-1">
                          {getStatusIcon(token.status)}
                        </div>

                        {/* Activity Card */}
                        <div className={`flex-1 p-3 rounded-lg border ${
                          token.status === 'COLLECTED'
                            ? 'bg-green-50 border-green-100'
                            : token.status === 'CANCELLED'
                            ? 'bg-red-50 border-red-100'
                            : token.status === 'PENDING'
                            ? 'bg-amber-50 border-amber-100'
                            : 'bg-gray-50 border-gray-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${mealInfo.color}20` }}
                              >
                                <span className="text-sm font-bold" style={{ color: mealInfo.color }}>
                                  {token.meal_type.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">
                                  {getStatusMessage(token)}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  Token #{token.token_no} • {mealInfo.time}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-semibold ${
                                token.status === 'COLLECTED'
                                  ? 'text-green-600'
                                  : token.status === 'CANCELLED' || token.status === 'SKIPPED'
                                  ? 'text-red-600'
                                  : token.status === 'PENDING'
                                  ? 'text-amber-600'
                                  : 'text-gray-600'
                              }`}>
                                {getTimestamp(token)}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {getDetailedTimestamp(token)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {sortedTokens.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
          <p className="text-xs text-gray-600">
            Showing <span className="font-bold text-gray-900">{sortedTokens.length}</span> activities
            {filter !== 'all' && (
              <span> • <span className="font-semibold capitalize">{filter === 'cancelled' ? 'Skipped' : filter}</span></span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
