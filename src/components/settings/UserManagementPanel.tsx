'use client';

import React, { useState, useEffect } from 'react';
import { UserCog, Shield } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { User, UserRole, TableColumn } from '@/types';

export function UserManagementPanel() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('headmaster');

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      if (!supabase || !isSupabaseConfigured) {
        setLoadError('Supabase is not configured for this deployment.');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, created_at, updated_at')
            .order('created_at');

        if (!active) return;
        if (error) {
          setLoadError(error.message);
        } else {
          setUsers(
            (data ?? [])
              .filter((profile) => ['admin', 'owner', 'headmaster'].includes(profile.role))
              .map((profile) => ({
                id: profile.id,
                email: profile.email,
                name: profile.full_name,
                role: profile.role as UserRole,
                createdAt: profile.created_at,
                updatedAt: profile.updated_at,
              }))
          );
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load user accounts.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadUsers();
    return () => {
      active = false;
    };
  }, []);

  const roleLabel = (value: UserRole) => ({
    admin: 'Platform Admin',
    owner: 'School Owner',
    headmaster: 'Administrator',
  })[value];

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      addToast({ type: 'error', title: 'Supabase is not configured' });
      return;
    }
    setIsInviting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ fullName, email, role }),
      });
      const result = await response.json() as { message?: string; error?: string; userId?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to send the invitation.');

      addToast({ type: 'success', title: 'Invitation sent', message: result.message });
      const invitedUserId = result.userId;
      if (invitedUserId) {
        const now = new Date().toISOString();
        setUsers((current) => [...current, {
          id: invitedUserId,
          email: email.trim().toLowerCase(),
          name: fullName.trim(),
          role,
          createdAt: now,
          updatedAt: now,
        }]);
      }
      setFullName('');
      setEmail('');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not invite user',
        message: error instanceof Error ? error.message : 'Unable to send the invitation.',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const columns: TableColumn<User>[] = [
    { key: 'name', header: 'User', render: (u) => (
      <div className="flex items-center gap-3">
        <Avatar firstName={u.name.split(' ')[0]} lastName={u.name.split(' ')[1]} size="sm" />
        <div><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
      </div>
    )},
    { key: 'role', header: 'Role', render: (u) => (
      <Badge className={u.role === 'admin' || u.role === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
        {roleLabel(u.role)}
      </Badge>
    )},
  ];

  return (
    <div>
      <PageHeader title="User Management" description="Manage system users and roles" />

      {currentUser?.role === 'admin' || currentUser?.role === 'owner' ? (
        <Card className="mb-6 p-5">
          <CardHeader><CardTitle>Invite a school user</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              <Input label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <Select
                label="Role"
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as Exclude<UserRole, 'admin'>);
                }}
                options={[
                  ...(currentUser.role === 'admin' ? [{ value: 'owner', label: 'School Owner' }] : []),
                  { value: 'headmaster', label: 'Administrator' },
                ]}
              />
              <div className="md:col-span-2">
                <Button type="submit" isLoading={isInviting} leftIcon={<UserCog className="h-4 w-4" />}>
                  Send email invitation
                </Button>
              </div>
            </form>
            <p className="mt-3 text-xs text-gray-500">
              The invitee sets their own password from the email. Administrators can manage the school’s day-to-day operations.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Account setup:</strong> Platform admins can invite school owners and administrators. School owners can invite administrators.
        </div>
        {loadError && <p role="alert" className="mb-4 text-sm text-red-700">{loadError}</p>}
        <Table columns={columns} data={users} keyExtractor={(u) => u.id} isLoading={isLoading} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600"><Shield className="h-5 w-5" /></div>
            <div><p className="font-medium text-gray-900">Platform Admin</p><p className="text-sm text-gray-500">Platform-level account and school owner setup</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600"><Shield className="h-5 w-5" /></div>
            <div><p className="font-medium text-gray-900">School Owner</p><p className="text-sm text-gray-500">Full access, including account management and sensitive staff records</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Shield className="h-5 w-5" /></div>
            <div><p className="font-medium text-gray-900">Administrator</p><p className="text-sm text-gray-500">Day-to-day academic, student, and school operations</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}