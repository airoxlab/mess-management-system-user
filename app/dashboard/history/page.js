'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, classNames, MEAL_TYPES } from '@/lib/utils';

export default function MealHistoryPage() {
  const { memberData, memberType } = useAuth();
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'breakfast', 'lunch', 'dinner'
  const [dateRange, setDateRange] = useState('week'); // 'week', 'month', 'all'

  useEffect(() => {
    if (memberData?.id) {
      fetchHistory();
    }
  }, [memberData, dateRange]);

  const fetchHistory = async () => {
    try {
      setLoading(true);

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

      let url = `/api/meal-selections?memberId=${memberData.id}&memberType=${memberType}`;
      if (startDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setSelections(data.selections || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSelections = selections.filter((selection) => {
    if (filter === 'all') return true;
    return selection[`${filter}_needed`] === true;
  });

  const stats = {
    totalDays: selections.length,
    breakfastCount: selections.filter((s) => s.breakfast_needed).length,
    lunchCount: selections.filter((s) => s.lunch_needed).length,
    dinnerCount: selections.filter((s) => s.dinner_needed).length,
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
          <h1 className="text-2xl font-bold text-gray-900">Meal History</h1>
          <p className="text-gray-600 mt-1">View your past meal selections</p>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
              <p className="text-xs text-gray-500">Total Days</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">🌅</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.breakfastCount}</p>
              <p className="text-xs text-gray-500">Breakfasts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">☀️</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.lunchCount}</p>
              <p className="text-xs text-gray-500">Lunches</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">🌙</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.dinnerCount}</p>
              <p className="text-xs text-gray-500">Dinners</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 inline-flex">
        {['all', 'breakfast', 'lunch', 'dinner'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={classNames(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize',
              filter === f
                ? 'bg-primary-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* History List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredSelections.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-2 text-gray-500">No meal history found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredSelections.map((selection) => (
              <div
                key={selection.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatDate(selection.date, 'EEEE, MMMM d, yyyy')}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      {MEAL_TYPES.map((meal) => {
                        const isNeeded = selection[`${meal.value}_needed`];
                        return (
                          <span
                            key={meal.value}
                            className={classNames(
                              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                              isNeeded
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            )}
                          >
                            {meal.value === 'breakfast' && '🌅'}
                            {meal.value === 'lunch' && '☀️'}
                            {meal.value === 'dinner' && '🌙'}
                            {meal.label}
                            {isNeeded ? ' ✓' : ' ✗'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm text-gray-500">
                      {[
                        selection.breakfast_needed && 'B',
                        selection.lunch_needed && 'L',
                        selection.dinner_needed && 'D',
                      ]
                        .filter(Boolean)
                        .join(', ') || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
