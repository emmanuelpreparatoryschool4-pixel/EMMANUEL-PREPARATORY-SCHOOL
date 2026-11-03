'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  School,
  DollarSign,
  AlertCircle,
  Package,
  UserPlus,
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
import { ActivityLog, Payment } from '@/types';
import Link from 'next/link';

interface DashboardStats {
  totalStudents: number;
  totalBoys: number;
  totalGirls: number;
  totalClasses: number;
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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        await seedSchoolSetup();
        const [dashboardStats, enrollment, logs, paymentHistory] = await Promise.all([
          dataService.getDashboardStats(),
          dataService.getEnrollmentByClass(),
          dataService.getActivityLogs(8),
          dataService.getPayments(),
        ]);
        setStats(dashboardStats);
        setEnrollmentData(enrollment);
        setActivities(logs);
        setPayments(paymentHistory);
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

  const feeTrendData = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date();
    monthDate.setDate(1);
    monthDate.setMonth(monthDate.getMonth() - (5 - index));
    const month = monthDate.toISOString().slice(0, 7);
    return {
      month: monthDate.toLocaleDateString(undefined, { month: 'short' }),
      amount: payments
        .filter((payment) => payment.status === 'completed' && payment.paymentDate.startsWith(month))
        .reduce((sum, payment) => sum + payment.amount, 0),
    };
  });

  const quickActions = [
    { label: 'Add Student', href: '/students/new', icon: UserPlus },
    { label: 'Record Payment', href: '/fees/payments/new', icon: Receipt },
  ];

  const statCards = stats
    ? [
        { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-blue-600 bg-blue-100' },
        { title: 'Boys', value: stats.totalBoys, icon: Users, color: 'text-cyan-600 bg-cyan-100' },
        { title: 'Girls', value: stats.totalGirls, icon: Users, color: 'text-pink-600 bg-pink-100' },
        { title: 'Total Classes', value: stats.totalClasses, icon: School, color: 'text-green-600 bg-green-100' },
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

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-1 gap-6">
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