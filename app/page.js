'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { toast } from 'sonner';

const USER_TYPES = [
  { id: 'student', label: 'Student', idField: 'CNIC', placeholder: 'XXXXX-XXXXXXX-X', isCnic: true },
  { id: 'staff', label: 'Staff', idField: 'CNIC', placeholder: 'XXXXX-XXXXXXX-X', isCnic: true },
  { id: 'faculty', label: 'Faculty', idField: 'Contact Number', placeholder: '03XX-XXXXXXX', isCnic: false },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState('student');
  const router = useRouter();
  const { signIn, isAuthenticated, loading: authLoading } = useAuth();

  const selectedUserType = USER_TYPES.find(t => t.id === userType);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/user');
    }
  }, [isAuthenticated, authLoading, router]);

  const formatCnic = (value) => {
    const digitsOnly = value.replace(/\D/g, '');
    // Format as XXXXX-XXXXXXX-X for CNIC
    if (digitsOnly.length <= 5) {
      return digitsOnly;
    } else if (digitsOnly.length <= 12) {
      return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`;
    } else {
      return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 12)}-${digitsOnly.slice(12, 13)}`;
    }
  };

  const formatPhone = (value) => {
    const digitsOnly = value.replace(/\D/g, '');
    // Format as 03XX-XXXXXXX for phone
    if (digitsOnly.length <= 4) {
      return digitsOnly;
    } else {
      return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 11)}`;
    }
  };

  const handleCredentialChange = (e) => {
    const value = e.target.value;
    if (selectedUserType?.isCnic) {
      // Format as CNIC for student and staff
      setCredential(formatCnic(value));
    } else {
      // Format as phone number for faculty
      setCredential(formatPhone(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !credential) {
      toast.error('Please fill in all fields');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate credential based on user type
    if (selectedUserType?.isCnic) {
      // Validate CNIC for student and staff
      const cnicValue = credential.replace(/-/g, '');
      if (cnicValue.length !== 13) {
        toast.error('Please enter a valid 13-digit CNIC');
        return;
      }
    } else {
      // Validate phone number for faculty
      const phoneValue = credential.replace(/-/g, '');
      if (phoneValue.length < 10 || phoneValue.length > 11) {
        toast.error('Please enter a valid contact number');
        return;
      }
    }

    setLoading(true);
    const result = await signIn(email, credential, userType);
    setLoading(false);

    if (result.success) {
      toast.success('Login successful!');
      router.push('/user');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4 py-6 sm:py-0">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl sm:rounded-2xl shadow-lg mb-3 sm:mb-4">
            <svg
              className="w-9 h-9 sm:w-12 sm:h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">LIMHS Cafeteria</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">User Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-5 sm:p-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 text-center mb-4 sm:mb-6">
            Sign in to your account
          </h2>

          {/* User Type Selector */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-4 sm:mb-6">
            {USER_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setUserType(type.id);
                  setCredential('');
                }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                  userType === type.id
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {selectedUserType?.idField}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={selectedUserType?.placeholder}
                  value={credential}
                  onChange={handleCredentialChange}
                  maxLength={selectedUserType?.isCnic ? 15 : 12}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {selectedUserType?.isCnic
                  ? 'Format: XXXXX-XXXXXXX-X (13 digits)'
                  : 'Format: 03XX-XXXXXXX'}
              </p>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
            <p className="text-center text-xs sm:text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <span className="text-primary-600 font-medium">
                Contact Admin to register
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6">
          LIMHS Cafeteria Management System
        </p>
      </div>
    </div>
  );
}
