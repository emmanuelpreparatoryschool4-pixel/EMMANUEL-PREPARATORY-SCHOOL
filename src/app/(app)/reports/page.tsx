'use client';

import React, { useState } from 'react';
import { FileText, Download, Printer, Users, GraduationCap, CalendarCheck, DollarSign, Package, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { downloadCSV } from '@/lib/utils';

const reportTypes = [
  { id: 'enrollment', label: 'Student Enrollment Report', icon: Users, description: 'Enrollment figures by class, gender, and transport' },
  { id: 'class-register', label: 'Class Register', icon: FileText, description: 'Printable class register with student details' },
  { id: 'staff', label: 'Staff Report', icon: GraduationCap, description: 'Teaching and non-teaching staff breakdown' },
  { id: 'attendance', label: 'Attendance Report', icon: CalendarCheck, description: 'Attendance statistics by class and period' },
  { id: 'academic', label: 'Academic Performance', icon: BarChart3, description: 'Assessment results and performance analysis' },
  { id: 'fees', label: 'Fee Collection Report', icon: DollarSign, description: 'Fees collected and outstanding balances' },
  { id: 'debt', label: 'Outstanding Debt Report', icon: DollarSign, description: 'Students with outstanding fee balances' },
  { id: 'inventory', label: 'Inventory Report', icon: Package, description: 'Inventory items, conditions, and values' },
];

export default function ReportsPage() {
  const { addToast } = useToast();
  const [selectedReport, setSelectedReport] = useState('enrollment');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = async () => {
    setIsGenerating(true);
    try {
      if (selectedReport === 'enrollment') {
        const data = await dataService.getEnrollmentByClass();
        downloadCSV(data.map((d) => ({ Class: d.name, Boys: d.boys, Girls: d.girls, Total: d.total })), 'enrollment-report');
      } else if (selectedReport === 'staff') {
        const staff = await dataService.getStaff();
        downloadCSV(staff.map((s) => ({
          'Staff ID': s.staffId, Name: `${s.firstName} ${s.lastName}`, Category: s.staffCategory,
          Gender: s.gender, Trained: s.isTrained ? 'Yes' : 'No', Status: s.employmentStatus,
        })), 'staff-report');
      } else if (selectedReport === 'inventory') {
        const items = await dataService.getInventoryItems();
        downloadCSV(items.map((i) => ({
          Code: i.inventoryCode, Name: i.name, Category: i.category,
          Quantity: i.quantity, Condition: i.condition, Status: i.status,
        })), 'inventory-report');
      } else {
        addToast({ type: 'info', title: 'Export', message: 'This report requires additional data. Backend integration recommended.' });
      }
      addToast({ type: 'success', title: 'Exported', message: 'Report exported to CSV.' });
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to generate report.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader title="Reports" description="Generate and export school reports"
        actions={
          <>
            <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
            <Button leftIcon={<Download className="h-4 w-4" />} onClick={handleExport} isLoading={isGenerating}>Export CSV</Button>
          </>
        } />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Report Types</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {reportTypes.map((r) => {
                const Icon = r.icon;
                return (
                  <button key={r.id} onClick={() => setSelectedReport(r.id)}
                    className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                      selectedReport === r.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                    }`}>
                    <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${selectedReport === r.id ? 'text-primary-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-gray-500">{r.description}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>{reportTypes.find((r) => r.id === selectedReport)?.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Academic Year" options={[{ value: '', label: 'All Years' }]} />
                <Select label="Term" options={[{ value: '', label: 'All Terms' }]} />
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-900">
                  {reportTypes.find((r) => r.id === selectedReport)?.label}
                </p>
                <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
                  Configure filters above and click Export or Print to generate this report.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}