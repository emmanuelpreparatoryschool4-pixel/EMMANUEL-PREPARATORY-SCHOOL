'use client';

import React, { useState, useEffect } from 'react';
import { Download, Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { dataService } from '@/lib/db';
import { downloadCSV, calculatePercentage } from '@/lib/utils';

export default function StatisticsPage() {
  const [teachingStats, setTeachingStats] = useState<Awaited<ReturnType<typeof dataService.getTeachingStaffStats>> | null>(null);
  const [nonTeachingStats, setNonTeachingStats] = useState<Awaited<ReturnType<typeof dataService.getNonTeachingStaffStats>> | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<{ name: string; boys: number; girls: number; total: number }[]>([]);
  const [activeTab, setActiveTab] = useState('students');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, nt, e] = await Promise.all([
        dataService.getTeachingStaffStats(),
        dataService.getNonTeachingStaffStats(),
        dataService.getEnrollmentByClass(),
      ]);
      setTeachingStats(t);
      setNonTeachingStats(nt);
      setEnrollmentData(e);
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const tabs = [
    { id: 'students', label: 'Students' },
    { id: 'teaching', label: 'Teaching Staff' },
    { id: 'non-teaching', label: 'Non-Teaching Staff' },
  ];

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

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'students' && (
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
      )}

      {activeTab === 'teaching' && teachingStats && (
        <Card>
          <CardHeader><CardTitle>Teaching Staff Statistics</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Male</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Female</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    ['Trained Teachers', teachingStats.trainedMale, teachingStats.trainedFemale],
                    ['Untrained Teachers', teachingStats.untrainedMale, teachingStats.untrainedFemale],
                    ['Using School Bus', teachingStats.maleUsingBus, teachingStats.femaleUsingBus],
                    ['Walking', teachingStats.maleWalking, teachingStats.femaleWalking],
                  ].map(([label, m, f]) => (
                    <tr key={label as string}>
                      <td className="px-4 py-3 text-sm text-gray-900">{label}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{m}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{f}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{(m as number) + (f as number)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">TOTAL TEACHING STAFF</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{teachingStats.totalMale}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{teachingStats.totalFemale}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{teachingStats.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'non-teaching' && nonTeachingStats && (
        <Card>
          <CardHeader><CardTitle>Non-Teaching Staff Statistics</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Male</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Female</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    ['Cooks', nonTeachingStats.maleCooks, nonTeachingStats.femaleCooks],
                    ['Drivers', nonTeachingStats.maleDrivers, nonTeachingStats.femaleDrivers],
                    ['Other Staff', nonTeachingStats.otherMale, nonTeachingStats.otherFemale],
                  ].map(([label, m, f]) => (
                    <tr key={label as string}>
                      <td className="px-4 py-3 text-sm text-gray-900">{label}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{m}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{f}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{(m as number) + (f as number)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">TOTAL NON-TEACHING STAFF</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{nonTeachingStats.totalMale}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{nonTeachingStats.totalFemale}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{nonTeachingStats.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}