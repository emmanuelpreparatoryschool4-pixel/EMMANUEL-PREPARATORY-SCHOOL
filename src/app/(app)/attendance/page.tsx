'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Save, Cloud, CloudOff, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { dataService } from '@/lib/db';
import { Class, Student, AttendanceRecord, AttendanceStatus, SyncStatus } from '@/types';
import { ATTENDANCE_STATUSES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export default function AttendancePage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [existingRecords, setExistingRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    async function load() {
      const cls = await dataService.getClasses();
      setClasses(cls);
      if (cls[0]) setSelectedClass(cls[0].id);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedClass || !date) return;
    async function load() {
      const [studentList, existing] = await Promise.all([
        dataService.getStudents({ classId: selectedClass, enrollmentStatus: 'active' }),
        dataService.getAttendanceRecords({ classId: selectedClass, date }),
      ]);
      setStudents(studentList);
      setExistingRecords(existing);

      const initial: Record<string, { status: AttendanceStatus; remarks: string }> = {};
      studentList.forEach((s) => {
        const existingRecord = existing.find((r) => r.studentId === s.id);
        initial[s.id] = existingRecord
          ? { status: existingRecord.status, remarks: existingRecord.remarks || '' }
          : { status: 'present', remarks: '' };
      });
      setRecords(initial);
    }
    load();
  }, [selectedClass, date]);

  const stats = useMemo(() => {
    const values = Object.values(records);
    return {
      present: values.filter((r) => r.status === 'present').length,
      absent: values.filter((r) => r.status === 'absent').length,
      late: values.filter((r) => r.status === 'late').length,
      excused: values.filter((r) => r.status === 'excused').length,
      sick: values.filter((r) => r.status === 'sick').length,
    };
  }, [records]);

  const handleSave = async (syncStatus: SyncStatus = 'local') => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const recordsToSave: AttendanceRecord[] = students.map((s) => ({
        id: existingRecords.find((r) => r.studentId === s.id)?.id || `${s.id}-${date}`,
        studentId: s.id,
        classId: selectedClass,
        date,
        status: records[s.id]?.status || 'present',
        remarks: records[s.id]?.remarks || '',
        recordedBy: user?.id || 'demo-owner',
        syncStatus,
        createdAt: now,
        updatedAt: now,
      }));

      await dataService.saveAttendanceRecords(recordsToSave);

      if (syncStatus === 'local') {
        for (const record of recordsToSave) {
          await dataService.addToSyncQueue({
            entityType: 'attendance',
            entityId: record.id,
            action: 'create',
            data: record,
            status: 'pending',
            retryCount: 0,
          });
        }
      }

      addToast({
        type: 'success',
        title: 'Saved',
        message: syncStatus === 'local' ? 'Attendance saved locally. Pending sync.' : 'Attendance saved.',
      });
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to save attendance.' });
    } finally {
      setIsSaving(false);
    }
  };

  const setAllStatus = (status: AttendanceStatus) => {
    const updated: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    students.forEach((s) => {
      updated[s.id] = { status, remarks: records[s.id]?.remarks || '' };
    });
    setRecords(updated);
  };

  return (
    <div>
      <PageHeader title="Attendance" description="Record daily class attendance"
        actions={
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge className="bg-green-100 text-green-800"><Cloud className="mr-1 h-3 w-3" /> Online</Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-800"><CloudOff className="mr-1 h-3 w-3" /> Offline</Badge>
            )}
          </div>
        } />

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Class" options={classes.map((c) => ({ value: c.id, label: c.name }))} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => setAllStatus('present')}>Mark All Present</Button>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Present', value: stats.present, color: 'text-green-600 bg-green-50' },
          { label: 'Absent', value: stats.absent, color: 'text-red-600 bg-red-50' },
          { label: 'Late', value: stats.late, color: 'text-yellow-600 bg-yellow-50' },
          { label: 'Excused', value: stats.excused, color: 'text-blue-600 bg-blue-50' },
          { label: 'Sick', value: stats.sick, color: 'text-purple-600 bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg p-4 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Student Attendance — {formatDate(date)}</CardTitle></CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No students in this class.</p>
          ) : (
            <div className="space-y-2">
              {students.map((s) => (
                <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{s.lastName} {s.firstName}</p>
                    <p className="text-xs text-gray-500">{s.admissionNumber}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ATTENDANCE_STATUSES.map((status) => (
                      <button
                        key={status.value}
                        onClick={() => setRecords((prev) => ({ ...prev, [s.id]: { ...prev[s.id], status: status.value as AttendanceStatus } }))}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          records[s.id]?.status === status.value
                            ? status.value === 'present' ? 'bg-green-600 text-white'
                              : status.value === 'absent' ? 'bg-red-600 text-white'
                              : status.value === 'late' ? 'bg-yellow-500 text-white'
                              : status.value === 'excused' ? 'bg-blue-600 text-white'
                              : 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Remarks"
                    value={records[s.id]?.remarks || ''}
                    onChange={(e) => setRecords((prev) => ({ ...prev, [s.id]: { ...prev[s.id], remarks: e.target.value } }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm sm:w-40"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => handleSave('local')} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
              Save Draft (Local)
            </Button>
            <Button onClick={() => handleSave('pending')} isLoading={isSaving} leftIcon={<CheckCircle className="h-4 w-4" />}>
              Save Attendance
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}