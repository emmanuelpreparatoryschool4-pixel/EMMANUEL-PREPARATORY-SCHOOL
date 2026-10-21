'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { User, UserRole, AuthState } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isUserRole(role: string): role is UserRole {
  return role === 'owner' || role === 'headmaster';
}

async function getProfileUser(userId: string): Promise<User | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url, staff_id, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data || !isUserRole(data.role)) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.full_name,
    role: data.role,
    avatar: data.avatar_url ?? undefined,
    staffId: data.staff_id ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    const applySession = async (session: Session | null) => {
      if (!session) {
        if (active) setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const user = await getProfileUser(session.user.id);
      if (active) {
        setState({ user, isAuthenticated: Boolean(user), isLoading: false });
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => void applySession(session));
    });
    void supabase.auth.getSession().then(({ data }) => applySession(data.session));

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured for this deployment.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { success: false, error: error?.message ?? 'Sign-in failed.' };
    }

    const user = await getProfileUser(data.session.user.id);
    if (!user) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Your account has no valid owner or headmaster profile. Contact the school owner.',
      };
    }

    setState({ user, isAuthenticated: true, isLoading: false });
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    void supabase?.auth.signOut();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
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