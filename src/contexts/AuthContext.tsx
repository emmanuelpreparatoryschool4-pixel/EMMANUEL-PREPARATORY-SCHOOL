'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, AuthState } from '@/types';
import { DEMO_ACCOUNTS } from '@/lib/constants';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'eps_auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored) as User;
        if (user.role !== 'owner' && user.role !== 'headmaster') {
          throw new Error('Stored account role is no longer supported.');
        }
        setState({ user, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // MOCK AUTHENTICATION - Replace with real backend later
    // This is for frontend demonstration only
    const demoAccount = DEMO_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === email.toLowerCase() && acc.password === password
    );

    if (!demoAccount) {
      return { success: false, error: 'Invalid email or password. Use demo credentials.' };
    }

    const user: User = {
      id: `demo-${demoAccount.role}`,
      email: demoAccount.email,
      name: demoAccount.name,
      role: demoAccount.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
    return { success: true };
  }, []);

  const loginAsDemo = useCallback(async (role: UserRole) => {
    const demoAccount = DEMO_ACCOUNTS.find((acc) => acc.role === role);
    if (!demoAccount) return;

    const user: User = {
      id: `demo-${role}`,
      email: demoAccount.email,
      name: demoAccount.name,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}