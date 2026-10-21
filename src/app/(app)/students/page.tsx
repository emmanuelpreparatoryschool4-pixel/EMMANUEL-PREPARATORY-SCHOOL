'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Upload, Eye, Pencil, Archive, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { Student, Class, TableColumn } from '@/types';
import { GENDERS, ENROLLMENT_STATUSES, PAGE_SIZE_OPTIONS } from '@/lib/constants';
import { downloadCSV, formatDate, getEnrollmentStatusLabel } from '@/lib/utils';

export default function StudentsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveTarget, setArchiveTarget] = useState<Student | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [studentsData, classesData] = await Promise.all([
        dataService.getStudents(),
        dataService.getClasses(),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load students.' });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  const filtered = useMemo(() => {
    let result = students;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (st) =>
          st.firstName.toLowerCase().includes(s) ||
          st.lastName.toLowerCase().includes(s) ||
          st.studentId.toLowerCase().includes(s) ||
          st.admissionNumber.toLowerCase().includes(s)
      );
    }
    if (classFilter) result = result.filter((s) => s.currentClassId === classFilter);
    if (genderFilter) result = result.filter((s) => s.gender === genderFilter);
    if (statusFilter) result = result.filter((s) => s.enrollmentStatus === statusFilter);

    return result;
  }, [students, search, classFilter, genderFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, totalPages || 1);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const classMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach((c) => (map[c.id] = c.name + (c.stream ? ` ${c.stream}` : '')));
    return map;
  }, [classes]);

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await dataService.updateStudent(archiveTarget.id, { enrollmentStatus: 'archived' });
      addToast({ type: 'success', title: 'Archived', message: 'Student archived successfully.' });
      setArchiveTarget(null);
      setIsLoading(true);
      await loadData();
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to archive student.' });
    }
  };

  const handleExport = () => {
    const dataToExport = selectedIds.size > 0
      ? filtered.filter((s) => selectedIds.has(s.id))
      : filtered;

    downloadCSV(
      dataToExport.map((s) => ({
        'Student ID': s.studentId,
        'Admission No': s.admissionNumber,
        'First Name': s.firstName,
        'Last Name': s.lastName,
        Gender: s.gender,
        'Date of Birth': s.dateOfBirth,
        Class: classMap[s.currentClassId] || '',
        Status: s.enrollmentStatus,
      })),
      `students-export-${new Date().toISOString().split('T')[0]}`
    );
    addToast({ type: 'success', title: 'Exported', message: 'Student data exported to CSV.' });
  };

  const columns: TableColumn<Student>[] = [
    {
      key: 'name',
      header: 'Student',
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
          <div>
            <p className="font-medium text-gray-900">
              {s.lastName} {s.firstName}
            </p>
            <p className="text-xs text-gray-500">{s.admissionNumber}</p>
          </div>
        </div>
      ),
    },
    { key: 'studentId', header: 'Student ID' },
    {
      key: 'gender',
      header: 'Gender',
      render: (s) => <span className="capitalize">{s.gender}</span>,
    },
    {
      key: 'currentClassId',
      header: 'Class',
      render: (s) => classMap[s.currentClassId] || '—',
    },
    {
      key: 'enrollmentStatus',
      header: 'Status',
      render: (s) => (
        <Badge variant="status" status={s.enrollmentStatus}>
          {getEnrollmentStatusLabel(s.enrollmentStatus)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => router.push(`/students/${s.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => router.push(`/students/${s.id}/edit`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setArchiveTarget(s)}>
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${students.length} total students enrolled`}
        actions={
          <>
            <Button variant="outline" leftIcon={<Upload className="h-4 w-4" />} onClick={() => router.push('/students/import')}>
              Import
            </Button>
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
              Export
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/students/new')}>
              Add Student
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by name or ID..."
            className="lg:col-span-2"
          />
          <Select
            options={[{ value: '', label: 'All Classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setPage(1);
            }}
          />
          <Select
            options={[{ value: '', label: 'All Genders' }, ...GENDERS]}
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(1);
            }}
          />
          <Select
            options={[{ value: '', label: 'All Statuses' }, ...ENROLLMENT_STATUSES]}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-primary-50 px-4 py-2">
            <span className="text-sm font-medium text-primary-700">
              {selectedIds.size} selected
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {paginated.length === 0 && !isLoading ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description="Try adjusting your search or filters, or add a new student."
            action={
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/students/new')}>
                Add Student
              </Button>
            }
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={paginated}
              keyExtractor={(s) => s.id}
              isLoading={isLoading}
              onRowClick={(s) => router.push(`/students/${s.id}`)}
              selectable
              selectedIds={selectedIds}
              onSelectRow={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onSelectAll={() => {
                if (selectedIds.size === paginated.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(paginated.map((s) => s.id)));
              }}
            />
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Student"
        message={`Are you sure you want to archive ${archiveTarget?.firstName} ${archiveTarget?.lastName}? This will remove them from active enrollment lists.`}
        confirmText="Archive"
      />
    </div>
  );
}