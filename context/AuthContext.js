'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [memberType, setMemberType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const storedUser = localStorage.getItem('cafeteria_user');
      const storedMember = localStorage.getItem('cafeteria_member');
      const storedMemberType = localStorage.getItem('cafeteria_member_type');

      if (storedUser && storedMember) {
        const userData = JSON.parse(storedUser);
        const memberDataParsed = JSON.parse(storedMember);

        setUser(userData);
        setMemberData(memberDataParsed);
        setMemberType(storedMemberType);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, credential, userType) => {
    try {
      setLoading(true);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, credential, userType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const { member, memberType: type } = data;

      localStorage.setItem('cafeteria_user', JSON.stringify({ email, credential }));
      localStorage.setItem('cafeteria_member', JSON.stringify(member));
      localStorage.setItem('cafeteria_member_type', type);

      setUser({ email, credential });
      setMemberData(member);
      setMemberType(type);
      setIsAuthenticated(true);

      return { success: true, member, memberType: type };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('cafeteria_user');
    localStorage.removeItem('cafeteria_member');
    localStorage.removeItem('cafeteria_member_type');

    setUser(null);
    setMemberData(null);
    setMemberType(null);
    setIsAuthenticated(false);

    router.push('/');
  };

  const refreshMemberData = async () => {
    if (!user || !memberData) return;

    try {
      const response = await fetch(`/api/member?email=${user.email}&memberType=${memberType}`);
      const data = await response.json();

      if (response.ok && data.member) {
        setMemberData(data.member);
        localStorage.setItem('cafeteria_member', JSON.stringify(data.member));
      }
    } catch (error) {
      console.error('Error refreshing member data:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberData,
        memberType,
        loading,
        isAuthenticated,
        signIn,
        signOut,
        refreshMemberData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
