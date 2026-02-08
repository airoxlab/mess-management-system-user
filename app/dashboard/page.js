'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, getMealTimeStatus, MEAL_TYPES } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const { memberData, memberType } = useAuth();
  const [memberPackage, setMemberPackage] = useState(null);
  const [todaySelections, setTodaySelections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const mealTimeStatus = getMealTimeStatus();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (memberData?.id) {
      fetchData();
    }
  }, [memberData]);

  const fetchData = async () => {
    try {
      // Fetch member package
      const packageRes = await fetch(
        `/api/member-package?memberId=${memberData.id}&memberType=${memberType}`
      );
      const packageData = await packageRes.json();
      setMemberPackage(packageData.package);

      // Fetch today's selections
      const today = new Date().toISOString().split('T')[0];
      const selectionsRes = await fetch(
        `/api/meal-selections?memberId=${memberData.id}&memberType=${memberType}&startDate=${today}&endDate=${today}`
      );
      const selectionsData = await selectionsRes.json();
      setTodaySelections(selectionsData.selections?.[0] || null);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {memberData?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mt-1">
            {formatDate(currentTime, 'EEEE, MMMM d, yyyy')} | {formatPakistanTime(currentTime)}
          </p>
        </div>

        {/* Current Meal Status */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
          mealTimeStatus.status === 'active'
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-600'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            mealTimeStatus.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}></span>
          {mealTimeStatus.label}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Meals Card - Only for non-daily basis packages */}
        {memberPackage?.package_type !== 'daily_basis' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Today&apos;s Meals</h3>
            </div>

            <div className="space-y-2">
              {MEAL_TYPES.map((meal) => {
                const isSelected = todaySelections?.[`${meal.value}_needed`] !== false;
                return (
                  <div key={meal.value} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600 capitalize">{meal.label}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isSelected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isSelected ? 'Needed' : 'Not Needed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily Basis Quick Info Card - Only for daily basis packages */}
        {memberPackage?.package_type === 'daily_basis' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Order & Pay</h3>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Scan your QR code at the cafeteria to order meals. Your balance will be deducted automatically.
              </p>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Current Balance</span>
                <span className="text-lg font-bold text-green-600">
                  PKR {memberPackage.balance?.toLocaleString() || '0'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Package Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">My Package</h3>
          </div>

          {memberPackage ? (
            <div className="space-y-2">
              {/* Package Type */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Type</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full capitalize">
                  {memberPackage.package_type?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  memberPackage.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : memberPackage.status === 'deactivated'
                    ? 'bg-orange-100 text-orange-700'
                    : memberPackage.status === 'expired'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {memberPackage.status?.charAt(0).toUpperCase() + memberPackage.status?.slice(1)}
                </span>
              </div>

              {/* Package-specific information */}
              {memberPackage.package_type === 'daily_basis' ? (
                // Daily Basis: Show balance
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Balance</span>
                    <span className="text-sm font-medium text-gray-900">
                      PKR {memberPackage.balance?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Breakfast Price</span>
                    <span className="text-sm font-medium text-gray-900">
                      PKR {memberPackage.breakfast_price?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Lunch Price</span>
                    <span className="text-sm font-medium text-gray-900">
                      PKR {memberPackage.lunch_price?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Dinner Price</span>
                    <span className="text-sm font-medium text-gray-900">
                      PKR {memberPackage.dinner_price?.toLocaleString() || '0'}
                    </span>
                  </div>
                </>
              ) : (
                // Other packages: Show meals remaining
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Meals Included</span>
                    <span className="text-sm font-medium text-gray-900">
                      {[
                        memberPackage.breakfast_enabled && 'B',
                        memberPackage.lunch_enabled && 'L',
                        memberPackage.dinner_enabled && 'D',
                      ].filter(Boolean).join(', ') || 'None'}
                    </span>
                  </div>

                  {/* Show meals remaining for enabled meals */}
                  {memberPackage.breakfast_enabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Breakfast Left</span>
                      <span className="text-sm font-medium text-gray-900">
                        {(memberPackage.total_breakfast - memberPackage.consumed_breakfast) || 0}
                      </span>
                    </div>
                  )}
                  {memberPackage.lunch_enabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Lunch Left</span>
                      <span className="text-sm font-medium text-gray-900">
                        {(memberPackage.total_lunch - memberPackage.consumed_lunch) || 0}
                      </span>
                    </div>
                  )}
                  {memberPackage.dinner_enabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Dinner Left</span>
                      <span className="text-sm font-medium text-gray-900">
                        {(memberPackage.total_dinner - memberPackage.consumed_dinner) || 0}
                      </span>
                    </div>
                  )}

                  {/* Validity dates */}
                  {memberPackage.start_date && memberPackage.end_date && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Valid Until</span>
                        <span className="text-xs font-medium text-gray-900">
                          {new Date(memberPackage.end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Package Price */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Package Price</span>
                  <span className="text-sm font-medium text-gray-900">
                    PKR {memberPackage.price?.toLocaleString() || '0'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active package</p>
          )}
        </div>

        {/* Member Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">My Info</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Type</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{memberType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                memberData?.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {memberData?.status || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Member ID</span>
              <span className="text-sm font-medium text-gray-900">
                {memberData?.membership_id || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className={`grid grid-cols-2 ${memberPackage?.package_type === 'daily_basis' ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
          {/* Schedule Meals - Only for non-daily basis packages */}
          {memberPackage?.package_type !== 'daily_basis' && (
            <Link
              href="/dashboard/meals"
              className="flex flex-col items-center gap-2 p-4 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors"
            >
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-amber-800">Schedule Meals</span>
            </Link>
          )}

          <Link
            href="/dashboard/qrcode"
            className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-blue-800">My QR Code</span>
          </Link>

          <Link
            href="/dashboard/history"
            className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
          >
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-green-800">Meal History</span>
          </Link>

          <Link
            href="/dashboard/profile"
            className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
          >
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-purple-800">My Profile</span>
          </Link>
        </div>
      </div>

      {/* Meal Times Info */}
      <div className="bg-gradient-to-r from-primary-50 to-emerald-50 rounded-xl p-6 border border-primary-100">
        <h3 className="font-semibold text-gray-900 mb-4">Meal Times</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MEAL_TYPES.map((meal) => (
            <div key={meal.value} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meal.color }}></div>
              <div>
                <p className="font-medium text-gray-900">{meal.label}</p>
                <p className="text-sm text-gray-600">{meal.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
