'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User as UserIcon, Mail, Shield, Calendar, Download, KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { usePWAInstall } from '@/contexts/PWAInstallContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const { user } = useAuth();
  const { installApp } = usePWAInstall();
  const { addToast } = useToast();
  const router = useRouter();
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('password-recovery')) {
      queueMicrotask(() => setShowPasswordForm(true));
    }
  }, []);

  if (!user) return null;

  const handleInstall = async () => {
    const result = await installApp();
    if (result === 'accepted') {
      addToast({ type: 'success', title: 'App installed' });
    } else if (result === 'dismissed') {
      addToast({ type: 'info', title: 'Installation cancelled' });
    } else {
      addToast({
        type: 'info',
        title: 'Install from your browser',
        message: 'Open the browser menu and choose Install app or Add to Home Screen.',
      });
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!supabase) {
      addToast({ type: 'error', title: 'Supabase is not configured' });
      return;
    }

    setIsRequestingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/profile?password-recovery=1`,
      });
      if (error) throw error;
      addToast({ type: 'success', title: 'Reset email sent', message: `Check ${user.email} for the reset link.` });
    } catch {
      addToast({ type: 'error', title: 'Could not send reset email', message: 'Check your Supabase Auth redirect URL settings.' });
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      addToast({ type: 'error', title: 'Password is too short', message: 'Use at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', title: 'Passwords do not match' });
      return;
    }
    if (!supabase) {
      addToast({ type: 'error', title: 'Supabase is not configured' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      router.replace('/profile');
      addToast({ type: 'success', title: 'Password updated' });
    } catch {
      addToast({ type: 'error', title: 'Could not update password', message: 'Request a new reset link and try again.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="My Profile" description="Your account information and settings" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 text-center lg:col-span-1">
          <div className="mx-auto w-fit">
            <Avatar firstName={user.name.split(' ')[0]} lastName={user.name.split(' ')[1]} size="xl" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">{user.name}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
          <div className="mt-3 flex justify-center">
            <Badge className={user.role === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
              {user.role === 'owner' ? 'School Owner' : 'Headmaster'}
            </Badge>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Account Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <div><p className="text-xs text-gray-500">Full Name</p><p className="text-sm font-medium text-gray-900">{user.name}</p></div>
            </div>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div><p className="text-xs text-gray-500">Email</p><p className="text-sm font-medium text-gray-900">{user.email}</p></div>
            </div>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <Shield className="h-5 w-5 text-gray-400" />
              <div><p className="text-xs text-gray-500">Role</p><p className="text-sm font-medium text-gray-900">{user.role === 'owner' ? 'School Owner' : 'Headmaster'}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div><p className="text-xs text-gray-500">Member Since</p><p className="text-sm font-medium text-gray-900">{formatDate(user.createdAt)}</p></div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">App &amp; security</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleInstall}>
                  Install App
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<KeyRound className="h-4 w-4" />}
                  isLoading={isRequestingReset}
                  onClick={handleRequestPasswordReset}
                >
                  Send Password Reset Email
                </Button>
              </div>
              {showPasswordForm && (
                <form onSubmit={handleUpdatePassword} className="mt-5 max-w-md space-y-4">
                  <Input
                    label="New Password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <Button type="submit" isLoading={isUpdatingPassword}>
                    Update Password
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}