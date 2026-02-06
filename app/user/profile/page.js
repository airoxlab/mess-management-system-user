'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate, getInitials, classNames } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { memberData, memberType, refreshMemberData } = useAuth();
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [preferences, setPreferences] = useState({
    membership_type: memberData?.membership_type || 'full_time',
    food_preference: memberData?.food_preference || 'non_vegetarian',
    preferred_meal_plan: memberData?.preferred_meal_plan || memberData?.meal_timing_preference || [],
    has_food_allergies: memberData?.has_food_allergies || false,
    food_allergies_details: memberData?.food_allergies_details || '',
    medical_conditions: memberData?.medical_conditions || '',
  });

  const config = {
    student: { gradient: 'from-indigo-500 to-purple-600' },
    faculty: { gradient: 'from-emerald-500 to-teal-600' },
    staff: { gradient: 'from-orange-500 to-rose-600' },
  }[memberType] || { gradient: 'from-gray-500 to-gray-600' };

  const statusColors = {
    approved: 'bg-emerald-500',
    pending: 'bg-amber-500',
    rejected: 'bg-red-500',
  };

  const handleMealPlanToggle = (value) => {
    setPreferences(prev => {
      const current = Array.isArray(prev.preferred_meal_plan) ? prev.preferred_meal_plan : [];
      return {
        ...prev,
        preferred_meal_plan: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value]
      };
    });
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      console.log('Saving preferences:', { memberId: memberData.id, memberType, preferences });

      const response = await fetch('/api/member-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: memberData.id,
          memberType,
          preferences,
        }),
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        toast.success('Preferences saved!');
        setIsEditing(false);
        refreshMemberData?.();
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Save failed:', errorData);
        toast.error(errorData?.error || `Failed to save (${response.status})`);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const resetPreferences = () => {
    setPreferences({
      membership_type: memberData?.membership_type || 'full_time',
      food_preference: memberData?.food_preference || 'non_vegetarian',
      preferred_meal_plan: memberData?.preferred_meal_plan || memberData?.meal_timing_preference || [],
      has_food_allergies: memberData?.has_food_allergies || false,
      food_allergies_details: memberData?.food_allergies_details || '',
      medical_conditions: memberData?.medical_conditions || '',
    });
    setIsEditing(false);
  };

  const personalFields = [
    { label: 'Full Name', value: memberData?.full_name },
    { label: 'Email', value: memberData?.email_address },
    { label: 'Phone', value: memberData?.contact_number },
    { label: 'Date of Birth', value: memberData?.date_of_birth ? formatDate(memberData.date_of_birth) : null },
    ...(memberType === 'student' ? [
      { label: 'CNIC', value: memberData?.student_cnic },
      { label: 'Roll Number', value: memberData?.roll_number },
      { label: 'Department', value: memberData?.department_program },
      { label: 'Guardian', value: memberData?.guardian_name },
      { label: 'Residence', value: memberData?.hostel_day_scholar === 'hostel' ? 'Hostel' : 'Day Scholar' },
    ] : []),
    ...(memberType === 'faculty' ? [
      { label: 'Employee ID', value: memberData?.employee_id },
      { label: 'Department', value: memberData?.department },
      { label: 'Designation', value: memberData?.designation },
    ] : []),
    ...(memberType === 'staff' ? [
      { label: 'CNIC', value: memberData?.cnic_no },
      { label: 'Employee ID', value: memberData?.employee_id },
      { label: 'Department', value: memberData?.department_section },
      { label: 'Designation', value: memberData?.designation },
      { label: 'Shift', value: memberData?.duty_shift },
    ] : []),
  ];

  const mealFields = [
    { label: 'Membership', value: memberData?.membership_type },
    { label: 'Food Preference', value: memberData?.food_preference?.replace('_', ' ') },
    { label: 'Meal Plan', value: Array.isArray(memberData?.preferred_meal_plan) ? memberData.preferred_meal_plan.join(', ') : memberData?.preferred_meal_plan },
    { label: 'Allergies', value: memberData?.has_food_allergies ? (memberData?.food_allergies_details || 'Yes') : 'None' },
    { label: 'Medical', value: memberData?.medical_conditions || 'None' },
  ];

  const accountFields = [
    { label: 'Member ID', value: memberData?.membership_id, mono: true },
    { label: 'Receipt', value: memberData?.receipt_no },
    { label: 'Payment Method', value: memberData?.payment_method || memberData?.fee_payment_method },
    { label: 'Member Since', value: memberData?.created_at ? formatDate(memberData.created_at, 'MMM yyyy') : null },
  ];

  const fields = { personal: personalFields, meal: mealFields, account: accountFields };
  const tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'meal', label: 'Preferences' },
    { id: 'account', label: 'Account' },
  ];

  return (
    <div className="space-y-3">
      {/* Compact White Profile Header */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-lg bg-indigo-600 flex items-center justify-center text-xl font-bold text-white">
              {getInitials(memberData?.full_name)}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusColors[memberData?.status] || 'bg-gray-400'} rounded-full ring-2 ring-white`} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{memberData?.full_name}</h1>
            <p className="text-xs text-gray-600 truncate">{memberData?.email_address}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-semibold text-indigo-600 capitalize">
                {memberType}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-700">
                {memberData?.membership_id || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Content Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Compact Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
              className={classNames(
                "flex-1 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px",
                activeTab === tab.id
                  ? "text-indigo-600 border-indigo-600 bg-white"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'meal' && (
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors px-2.5 py-1 rounded-lg hover:bg-indigo-50"
              >
                Edit
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {fields[activeTab]?.map((field, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{field.label}</p>
                <p className={classNames(
                  "text-gray-900 font-semibold capitalize break-words",
                  field.mono ? "font-mono text-xs" : "text-xs"
                )}>
                  {field.value || <span className="text-gray-400">—</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Help Card */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-xs font-semibold text-gray-900">Need help?</p>
        <p className="text-[10px] text-gray-600 mt-0.5">Contact admin to update personal information.</p>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900">Edit Preferences</h3>
              <button
                onClick={resetPreferences}
                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-2.5 max-h-[70vh] overflow-y-auto">
              {/* Membership */}
              <div>
                <label className="text-[10px] font-medium text-gray-600 mb-1 block">Membership</label>
                <div className="flex gap-1.5">
                  {[
                    { value: 'full_time', label: 'Full Time' },
                    { value: 'partial', label: 'Partial' },
                    { value: 'day_to_day', label: 'Day to Day' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPreferences(p => ({ ...p, membership_type: opt.value }))}
                      className={classNames(
                        "flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors",
                        preferences.membership_type === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food Preference */}
              <div>
                <label className="text-[10px] font-medium text-gray-600 mb-1 block">Food Preference</label>
                <div className="flex gap-1.5">
                  {[
                    { value: 'vegetarian', label: 'Veg' },
                    { value: 'non_vegetarian', label: 'Non-Veg' },
                    { value: 'vegan', label: 'Vegan' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPreferences(p => ({ ...p, food_preference: opt.value }))}
                      className={classNames(
                        "flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors",
                        preferences.food_preference === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meal Plan */}
              <div>
                <label className="text-[10px] font-medium text-gray-600 mb-1 block">Meal Plan</label>
                <div className="flex gap-1.5">
                  {['breakfast', 'lunch', 'dinner'].map((opt) => {
                    const selected = Array.isArray(preferences.preferred_meal_plan) && preferences.preferred_meal_plan.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => handleMealPlanToggle(opt)}
                        className={classNames(
                          "flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors capitalize",
                          selected
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label className="text-[10px] font-medium text-gray-600 mb-1 block">Allergies</label>
                <div className="flex gap-1.5 mb-1.5">
                  <button
                    onClick={() => setPreferences(p => ({ ...p, has_food_allergies: false, food_allergies_details: '' }))}
                    className={classNames(
                      "flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors",
                      !preferences.has_food_allergies
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    None
                  </button>
                  <button
                    onClick={() => setPreferences(p => ({ ...p, has_food_allergies: true }))}
                    className={classNames(
                      "flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors",
                      preferences.has_food_allergies
                        ? "bg-amber-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    Yes
                  </button>
                </div>
                {preferences.has_food_allergies && (
                  <input
                    type="text"
                    placeholder="Details..."
                    value={preferences.food_allergies_details}
                    onChange={(e) => setPreferences(p => ({ ...p, food_allergies_details: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Medical */}
              <div>
                <label className="text-[10px] font-medium text-gray-600 mb-1 block">Medical</label>
                <input
                  type="text"
                  placeholder="Optional..."
                  value={preferences.medical_conditions}
                  onChange={(e) => setPreferences(p => ({ ...p, medical_conditions: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={resetPreferences}
                className="flex-1 py-1.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="flex-1 py-1.5 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
