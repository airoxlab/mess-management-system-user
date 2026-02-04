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
    membership_type: memberData?.membership_type || 'full',
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
      const response = await fetch('/api/member-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: memberData.id,
          memberType,
          preferences,
        }),
      });

      if (response.ok) {
        toast.success('Preferences saved!');
        setIsEditing(false);
        refreshMemberData?.();
      } else {
        toast.error('Failed to save');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const resetPreferences = () => {
    setPreferences({
      membership_type: memberData?.membership_type || 'full',
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
    <div className="space-y-5">
      {/* Profile Header */}
      <div className={`relative rounded-2xl bg-gradient-to-br ${config.gradient} p-6 overflow-hidden`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

        <div className="relative flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/20">
              {getInitials(memberData?.full_name)}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${statusColors[memberData?.status] || 'bg-gray-400'} rounded-full ring-4 ring-white`} />
          </div>

          <div className="flex-1 min-w-0 text-white">
            <h1 className="text-2xl font-bold truncate">{memberData?.full_name}</h1>
            <p className="text-white/70 text-sm truncate">{memberData?.email_address}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium backdrop-blur-sm capitalize">
                {memberType}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-mono backdrop-blur-sm">
                {memberData?.membership_id || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex bg-gray-50 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
              className={classNames(
                "flex-1 py-4 text-sm font-medium transition-all border-b-2 -mb-px",
                activeTab === tab.id
                  ? "text-primary-600 border-primary-600 bg-white"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'meal' && isEditing ? (
            <div className="space-y-5">
              {/* Membership */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Membership Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['full', 'partial'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPreferences(p => ({ ...p, membership_type: opt }))}
                      className={classNames(
                        "py-3 rounded-xl text-sm font-medium transition-all capitalize",
                        preferences.membership_type === opt
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food Preference */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Food Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'vegetarian', label: 'Vegetarian' },
                    { value: 'non_vegetarian', label: 'Non-Veg' },
                    { value: 'vegan', label: 'Vegan' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPreferences(p => ({ ...p, food_preference: opt.value }))}
                      className={classNames(
                        "py-3 rounded-xl text-sm font-medium transition-all",
                        preferences.food_preference === opt.value
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meal Plan */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Meal Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {['breakfast', 'lunch', 'dinner'].map((opt) => {
                    const selected = Array.isArray(preferences.preferred_meal_plan) && preferences.preferred_meal_plan.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => handleMealPlanToggle(opt)}
                        className={classNames(
                          "py-3 rounded-xl text-sm font-medium transition-all capitalize",
                          selected
                            ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Food Allergies</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => setPreferences(p => ({ ...p, has_food_allergies: false, food_allergies_details: '' }))}
                    className={classNames(
                      "py-3 rounded-xl text-sm font-medium transition-all",
                      !preferences.has_food_allergies
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    No Allergies
                  </button>
                  <button
                    onClick={() => setPreferences(p => ({ ...p, has_food_allergies: true }))}
                    className={classNames(
                      "py-3 rounded-xl text-sm font-medium transition-all",
                      preferences.has_food_allergies
                        ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    Have Allergies
                  </button>
                </div>
                {preferences.has_food_allergies && (
                  <input
                    type="text"
                    placeholder="Specify allergies..."
                    value={preferences.food_allergies_details}
                    onChange={(e) => setPreferences(p => ({ ...p, food_allergies_details: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>

              {/* Medical */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Medical Conditions</label>
                <input
                  type="text"
                  placeholder="Enter medical conditions or leave empty"
                  value={preferences.medical_conditions}
                  onChange={(e) => setPreferences(p => ({ ...p, medical_conditions: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetPreferences}
                  className="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <Button onClick={handleSavePreferences} loading={saving} className="flex-1">
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'meal' && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-50"
                  >
                    Edit
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fields[activeTab]?.map((field, i) => (
                  <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 hover:from-gray-100 hover:to-gray-50 transition-all group">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{field.label}</p>
                    <p className={classNames(
                      "text-gray-900 font-medium capitalize group-hover:text-primary-600 transition-colors break-words",
                      field.mono ? "font-mono text-sm" : "text-sm"
                    )}>
                      {field.value || <span className="text-gray-300">—</span>}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Help Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
        <p className="text-sm font-semibold text-gray-900">Need help?</p>
        <p className="text-xs text-gray-600 mt-0.5">Contact admin to update personal information.</p>
      </div>
    </div>
  );
}
