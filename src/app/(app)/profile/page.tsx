'use client';

import React from 'react';
import { User as UserIcon, Mail, Shield, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}