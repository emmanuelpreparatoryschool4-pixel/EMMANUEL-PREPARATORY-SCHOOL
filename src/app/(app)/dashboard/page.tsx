'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  GraduationCap,
  School,
  CalendarCheck,
  UserX,
  DollarSign,
  AlertCircle,
  Package,
  Plus,
  UserPlus,
  ClipboardCheck,
  Receipt,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { dataService, seedSchoolSetup } from '@/lib/db';
import { formatCurrency, formatCurrencyCompact, getRelativeTime } from '@/lib/utils';
import { ActivityLog } from '@/types';
import Link from 'next/link';

interface DashboardStats {
  totalStudents: number;
  totalBoys: number;
  totalGirls: number;
  totalTeachingStaff: number;
  totalNonTeachingStaff: number;
  totalClasses: number;
  todayPresent: number;
  todayAbsent: number;
  feesCollected: number;
  outstandingBalances: number;
  inventoryItems: number;
}

const COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function DashboardPage() {
  const { addToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<{ name: string; boys: number; girls: number; total: number }[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        await seedSchoolSetup();
        const [dashboardStats, enrollment, logs] = await Promise.all([
          dataService.getDashboardStats(),
          dataService.getEnrollmentByClass(),
          dataService.getActivityLogs(8),
        ]);
        setStats(dashboardStats);
        setEnrollmentData(enrollment);
        setActivities(logs);
      } catch (err) {
        console.error(err);
        addToast({ type: 'error', title: 'Error', message: 'Failed to load dashboard data.' });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [addToast]);

  const genderData = stats
    ? [
        { name: 'Boys', value: stats.totalBoys },
        { name: 'Girls', value: stats.totalGirls },
      ]
    : [];

  const attendanceData = stats
    ? [
        { name: 'Present', value: stats.todayPresent || 0 },
        { name: 'Absent', value: stats.todayAbsent || 0 },
      ]
    : [];

  // Fee collection mock trend (derived from real data would require historical records)
  const feeTrendData = [
    { month: 'Sep', amount: Math.round((stats?.feesCollected ?? 0) * 0.15) },
    { month: 'Oct', amount: Math.round((stats?.feesCollected ?? 0) * 0.2) },
    { month: 'Nov', amount: Math.round((stats?.feesCollected ?? 0) * 0.18) },
    { month: 'Dec', amount: Math.round((stats?.feesCollected ?? 0) * 0.22) },
    { month: 'Jan', amount: Math.round((stats?.feesCollected ?? 0) * 0.15) },
    { month: 'Feb', amount: Math.round((stats?.feesCollected ?? 0) * 0.1) },
  ];

  const quickActions = [
    { label: 'Add Student', href: '/students/new', icon: UserPlus },
    { label: 'Record Attendance', href: '/attendance', icon: ClipboardCheck },
    { label: 'Add Staff', href: '/staff/new', icon: Plus },
    { label: 'Record Payment', href: '/fees/payments/new', icon: Receipt },
  ];

  const statCards = stats
    ? [
        { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-blue-600 bg-blue-100' },
        { title: 'Boys', value: stats.totalBoys, icon: Users, color: 'text-cyan-600 bg-cyan-100' },
        { title: 'Girls', value: stats.totalGirls, icon: Users, color: 'text-pink-600 bg-pink-100' },
        { title: 'Teaching Staff', value: stats.totalTeachingStaff, icon: GraduationCap, color: 'text-purple-600 bg-purple-100' },
        { title: 'Non-Teaching Staff', value: stats.totalNonTeachingStaff, icon: UserCheck, color: 'text-orange-600 bg-orange-100' },
        { title: 'Total Classes', value: stats.totalClasses, icon: School, color: 'text-green-600 bg-green-100' },
        { title: "Today's Present", value: stats.todayPresent, icon: CalendarCheck, color: 'text-emerald-600 bg-emerald-100' },
        { title: 'Absent Today', value: stats.todayAbsent, icon: UserX, color: 'text-red-600 bg-red-100' },
        { title: 'Fees Collected', value: formatCurrencyCompact(stats.feesCollected), icon: DollarSign, color: 'text-green-600 bg-green-100' },
        { title: 'Outstanding Balances', value: formatCurrencyCompact(stats.outstandingBalances), icon: AlertCircle, color: 'text-yellow-600 bg-yellow-100' },
        { title: 'Inventory Items', value: stats.inventoryItems, icon: Package, color: 'text-indigo-600 bg-indigo-100' },
      ]
    : [];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Loading school overview..." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of school operations and key metrics"
      />

      {/* Demo label */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Demo Data:</strong> This dashboard displays seeded demonstration records. Replace
        with real backend data when ready.
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-gray-900">{action.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Enrollment by Class */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment by Class</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="boys" fill="#2563eb" name="Boys" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="girls" fill="#ec4899" name="Girls" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Boys vs Girls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {genderData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Fee Collection Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Collection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₵${(v / 100).toLocaleString()}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader
          action={
            <Link href="/activity">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          }
        >
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No recent activity</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activities.map((log) => (
                <li key={log.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {log.userName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{log.userName}</span> {log.action}
                    </p>
                    {log.details && <p className="text-sm text-gray-500">{log.details}</p>}
                    <p className="mt-0.5 text-xs text-gray-400">{getRelativeTime(log.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}