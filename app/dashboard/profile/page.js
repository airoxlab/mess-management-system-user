'use client';

import { useAuth } from '@/context/AuthContext';
import { formatDate, getInitials, classNames } from '@/lib/utils';

export default function ProfilePage() {
  const { memberData, memberType, refreshMemberData } = useAuth();

  const memberTypeColors = {
    student: 'bg-blue-100 text-blue-800 border-blue-200',
    faculty: 'bg-purple-100 text-purple-800 border-purple-200',
    staff: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  const statusColors = {
    approved: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
  };

  // Get fields based on member type
  const getProfileFields = () => {
    const common = [
      { label: 'Full Name', value: memberData?.full_name },
      { label: 'Email', value: memberData?.email_address },
      { label: 'Contact Number', value: memberData?.contact_number },
      { label: 'Date of Birth', value: memberData?.date_of_birth ? formatDate(memberData.date_of_birth) : 'N/A' },
      { label: 'Membership ID', value: memberData?.membership_id || 'N/A' },
      { label: 'Status', value: memberData?.status, isStatus: true },
    ];

    if (memberType === 'student') {
      return [
        ...common,
        { label: 'CNIC', value: memberData?.student_cnic },
        { label: 'Roll Number', value: memberData?.roll_number },
        { label: 'Department/Program', value: memberData?.department_program },
        { label: 'Guardian Name', value: memberData?.guardian_name },
        { label: 'Residential Status', value: memberData?.hostel_day_scholar === 'hostel' ? 'Hostel' : 'Day Scholar' },
        { label: 'Membership Type', value: memberData?.membership_type },
        { label: 'Food Preference', value: memberData?.food_preference },
        { label: 'Emergency Contact', value: memberData?.emergency_contact_name },
        { label: 'Emergency Number', value: memberData?.emergency_contact_number },
      ];
    }

    if (memberType === 'faculty') {
      return [
        ...common,
        { label: 'Employee ID', value: memberData?.employee_id },
        { label: 'Department', value: memberData?.department },
        { label: 'Designation', value: memberData?.designation },
        { label: 'Membership Type', value: memberData?.membership_type },
        { label: 'Food Preference', value: memberData?.food_preference },
        { label: 'Fee Category', value: memberData?.fee_category },
      ];
    }

    if (memberType === 'staff') {
      return [
        ...common,
        { label: 'CNIC', value: memberData?.cnic_no },
        { label: 'Employee ID', value: memberData?.employee_id },
        { label: 'Father Name', value: memberData?.father_name },
        { label: 'Department/Section', value: memberData?.department_section },
        { label: 'Designation', value: memberData?.designation },
        { label: 'Duty Shift', value: memberData?.duty_shift },
        { label: 'Membership Type', value: memberData?.membership_type },
        { label: 'Food Preference', value: memberData?.food_preference },
        { label: 'Emergency Contact', value: memberData?.emergency_contact_name },
        { label: 'Emergency Number', value: memberData?.emergency_contact_number },
      ];
    }

    return common;
  };

  const profileFields = getProfileFields();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold">
            {getInitials(memberData?.full_name)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{memberData?.full_name}</h1>
            <p className="text-primary-100 mt-1">{memberData?.email_address}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className={classNames(
                'px-3 py-1 rounded-full text-sm font-medium border capitalize',
                memberTypeColors[memberType] || 'bg-gray-100 text-gray-800'
              )}>
                {memberType}
              </span>
              <span className={classNames(
                'px-3 py-1 rounded-full text-sm font-medium capitalize',
                statusColors[memberData?.status] || 'bg-gray-100 text-gray-800'
              )}>
                {memberData?.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          <p className="text-sm text-gray-500">Your personal and membership details</p>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {profileFields.map((field, index) => (
              <div key={index} className="py-2">
                <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
                <dd className="mt-1">
                  {field.isStatus ? (
                    <span className={classNames(
                      'inline-flex px-2.5 py-1 rounded-full text-sm font-medium capitalize',
                      statusColors[field.value] || 'bg-gray-100 text-gray-800'
                    )}>
                      {field.value || 'N/A'}
                    </span>
                  ) : (
                    <span className="text-gray-900 capitalize">
                      {field.value || 'N/A'}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Meal Preferences */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Meal Preferences</h2>
          <p className="text-sm text-gray-500">Your meal plan and dietary preferences</p>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="py-2">
              <dt className="text-sm font-medium text-gray-500">Preferred Meal Plan</dt>
              <dd className="mt-1 text-gray-900">
                {Array.isArray(memberData?.preferred_meal_plan)
                  ? memberData.preferred_meal_plan.join(', ')
                  : memberData?.preferred_meal_plan || memberData?.meal_timing_preference?.join(', ') || 'N/A'}
              </dd>
            </div>

            <div className="py-2">
              <dt className="text-sm font-medium text-gray-500">Food Preference</dt>
              <dd className="mt-1 text-gray-900 capitalize">
                {memberData?.food_preference?.replace('_', ' ') || 'N/A'}
              </dd>
            </div>

            <div className="py-2">
              <dt className="text-sm font-medium text-gray-500">Food Allergies</dt>
              <dd className="mt-1 text-gray-900">
                {memberData?.has_food_allergies
                  ? memberData?.food_allergies_details || 'Yes (details not provided)'
                  : 'None'}
              </dd>
            </div>

            {memberData?.medical_conditions && (
              <div className="py-2">
                <dt className="text-sm font-medium text-gray-500">Medical Conditions</dt>
                <dd className="mt-1 text-gray-900">{memberData.medical_conditions}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Account Details</h2>
          <p className="text-sm text-gray-500">Membership and payment information</p>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="py-2">
              <dt className="text-sm font-medium text-gray-500">Membership ID</dt>
              <dd className="mt-1 text-gray-900 font-mono">
                {memberData?.membership_id || 'Not assigned'}
              </dd>
            </div>

            <div className="py-2">
              <dt className="text-sm font-medium text-gray-500">Receipt Number</dt>
              <dd className="mt-1 text-gray-900">
                {memberData?.receipt_no || 'N/A'}
              </dd>
            </div>

            <div className="py-2">
              <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
              <dd className="mt-1 text-gray-900 capitalize">
                {memberData?.payment_method || memberData?.fee_payment_method || 'N/A'}
              </dd>
            </div>

            <div className="py-2">
              <dt className="text-sm font-medium text-gray-500">Member Since</dt>
              <dd className="mt-1 text-gray-900">
                {memberData?.created_at
                  ? formatDate(memberData.created_at, 'MMMM d, yyyy')
                  : 'N/A'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Contact Admin Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-semibold text-blue-900">Need to update your information?</h4>
            <p className="text-sm text-blue-800 mt-1">
              Please contact the cafeteria admin to make changes to your profile information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
