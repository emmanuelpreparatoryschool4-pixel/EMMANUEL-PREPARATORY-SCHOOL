'use client';

import React, { useState, useEffect } from 'react';
import { UserCog, Shield, GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { dataService } from '@/lib/db';
import { User, TableColumn } from '@/types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    dataService.getUsers().then(setUsers);
  }, []);

  const columns: TableColumn<User>[] = [
    { key: 'name', header: 'User', render: (u) => (
      <div className="flex items-center gap-3">
        <Avatar firstName={u.name.split(' ')[0]} lastName={u.name.split(' ')[1]} size="sm" />
        <div><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
      </div>
    )},
    { key: 'role', header: 'Role', render: (u) => (
      <Badge className={u.role === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
        {u.role === 'owner' ? 'School Owner' : 'Headmaster'}
      </Badge>
    )},
  ];

  return (
    <div>
      <PageHeader title="User Management" description="Manage system users and roles" />

      <Card className="p-4">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Demo Mode:</strong> Create the owner and headmaster accounts in Supabase Auth after connecting the backend.
        </div>
        <Table columns={columns} data={users} keyExtractor={(u) => u.id} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600"><Shield className="h-5 w-5" /></div>
            <div><p className="font-medium text-gray-900">School Owner</p><p className="text-sm text-gray-500">Full access, including account management and sensitive staff records</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><GraduationCap className="h-5 w-5" /></div>
            <div><p className="font-medium text-gray-900">Headmaster</p><p className="text-sm text-gray-500">School operations access without owner-only staff financial details</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}