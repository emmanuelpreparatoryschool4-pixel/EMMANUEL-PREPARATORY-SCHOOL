'use client';

import React, { useState, useEffect } from 'react';
import { Download, Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { dataService } from '@/lib/db';
import { downloadCSV, calculatePercentage } from '@/lib/utils';

export default function StatisticsPage() {
  const [enrollmentData, setEnrollmentData] = useState<{ name: string; boys: number; girls: number; total: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setEnrollmentData(await dataService.getEnrollmentByClass());
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const totalStudents = enrollmentData.reduce((s, e) => s + e.total, 0);
  const totalBoys = enrollmentData.reduce((s, e) => s + e.boys, 0);
  const totalGirls = enrollmentData.reduce((s, e) => s + e.girls, 0);

  return (
    <div>
      <PageHeader title="School Statistics" description="Comprehensive statistical overview calculated from school records"
        actions={
          <>
            <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}
              onClick={() => downloadCSV(enrollmentData.map((e) => ({ Class: e.name, Boys: e.boys, Girls: e.girls, Total: e.total })), 'enrollment-stats')}>
              Export
            </Button>
          </>
        } />

      <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5"><p className="text-sm text-gray-500">Total Students</p><p className="mt-1 text-2xl font-bold text-gray-900">{totalStudents}</p></Card>
            <Card className="p-5"><p className="text-sm text-gray-500">Total Boys</p><p className="mt-1 text-2xl font-bold text-blue-600">{totalBoys} ({calculatePercentage(totalBoys, totalStudents)}%)</p></Card>
            <Card className="p-5"><p className="text-sm text-gray-500">Total Girls</p><p className="mt-1 text-2xl font-bold text-pink-600">{totalGirls} ({calculatePercentage(totalGirls, totalStudents)}%)</p></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Enrollment by Class</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Class</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Boys</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Girls</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">% of School</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {enrollmentData.map((e) => (
                      <tr key={e.name}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{e.name}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{e.boys}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{e.girls}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{e.total}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{calculatePercentage(e.total, totalStudents)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900">TOTAL</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{totalBoys}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{totalGirls}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{totalStudents}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}