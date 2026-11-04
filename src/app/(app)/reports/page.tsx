'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Users, DollarSign, BarChart3, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { dataService } from '@/lib/db';
import { downloadCSV, formatCurrency, getErrorMessage } from '@/lib/utils';
import { AcademicYear, Class, Invoice, Payment, ReportCard, Student, Term } from '@/types';

const reportTypes = [
  { id: 'enrollment', label: 'Student Enrollment Report', icon: Users, description: 'Enrolled students by class and gender' },
  { id: 'academic', label: 'Academic Performance', icon: BarChart3, description: 'Report-card results by class and term' },
  { id: 'fees', label: 'Fee Collection Report', icon: DollarSign, description: 'Payments collected by student and invoice' },
  { id: 'debt', label: 'Outstanding Debt Report', icon: DollarSign, description: 'Invoices and outstanding balances' },
];

type ReportRow = Record<string, unknown>;

export default function ReportsPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState('enrollment');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      dataService.getAcademicYears(),
      dataService.getTerms(),
      dataService.getClasses(),
      dataService.getStudents(),
      dataService.getReportCards(),
      dataService.getPayments(),
      dataService.getInvoices(),
    ]).then(([loadedYears, loadedTerms, loadedClasses, loadedStudents, cards, loadedPayments, loadedInvoices]) => {
      if (!active) return;
      setYears(loadedYears);
      setTerms(loadedTerms);
      setClasses(loadedClasses);
      setStudents(loadedStudents);
      setReportCards(cards);
      setPayments(loadedPayments);
      setInvoices(loadedInvoices);
    }).catch((error: unknown) => {
      if (active) addToast({ type: 'error', title: 'Could not load reports', message: getErrorMessage(error, 'Failed to load report data.') });
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [addToast]);

  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const classById = useMemo(() => new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass])), [classes]);
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);

  const rows = useMemo<ReportRow[]>(() => {
    let data: ReportRow[] = [];

    if (selectedReport === 'enrollment') {
      data = students
        .filter((student) => student.enrollmentStatus === 'active')
        .filter((student) => !yearId || student.academicYearId === yearId)
        .filter((student) => !classId || student.currentClassId === classId)
        .map((student) => ({
          'Student name': `${student.firstName} ${student.otherNames ?? ''} ${student.lastName}`.replace(/\s+/g, ' ').trim(),
          'Admission number': student.admissionNumber,
          Class: classById.get(student.currentClassId)?.name ?? 'Unknown',
          Gender: student.gender,
          Status: student.enrollmentStatus,
        }));
    } else if (selectedReport === 'academic') {
      data = reportCards
        .filter((card) => card.status === 'published')
        .filter((card) => !yearId || card.academicYearId === yearId)
        .filter((card) => !termId || card.termId === termId)
        .filter((card) => !classId || card.classId === classId)
        .map((card) => {
          const student = studentById.get(card.studentId);
          return {
            'Student name': student ? `${student.firstName} ${student.lastName}` : 'Unknown student',
            'Admission number': student?.admissionNumber ?? '',
            Class: classById.get(card.classId)?.name ?? 'Unknown',
            'Academic year': years.find((year) => year.id === card.academicYearId)?.name ?? '',
            Term: terms.find((term) => term.id === card.termId)?.name ?? '',
            Subjects: card.subjects.length,
            Total: card.totalScore,
            Average: `${card.averageScore.toFixed(2)}%`,
            Position: card.position ?? '',
            Status: card.status,
          };
        });
    } else if (selectedReport === 'fees') {
      data = payments
        .filter((payment) => payment.status === 'completed')
        .filter((payment) => {
          const invoice = payment.invoiceId ? invoiceById.get(payment.invoiceId) : undefined;
          if (invoice) {
            return (!yearId || invoice.academicYearId === yearId) &&
              (!termId || invoice.termId === termId) &&
              (!classId || invoice.classId === classId);
          }
          const student = studentById.get(payment.studentId);
          return !termId && Boolean(student) &&
            (!yearId || student?.academicYearId === yearId) &&
            (!classId || student?.currentClassId === classId);
        })
        .map((payment) => {
          const student = studentById.get(payment.studentId);
          const invoice = payment.invoiceId ? invoiceById.get(payment.invoiceId) : undefined;
          return {
            'Receipt number': payment.receiptNumber,
            'Student name': student ? `${student.firstName} ${student.lastName}` : 'Unknown student',
            'Admission number': student?.admissionNumber ?? '',
            Invoice: invoice?.invoiceNumber ?? 'Unallocated',
            Date: payment.paymentDate,
            Method: payment.paymentMethod.replace(/_/g, ' '),
            Amount: formatCurrency(payment.amount),
          };
        });
    } else {
      data = invoices
        .filter((invoice) => invoice.status !== 'cancelled' && invoice.outstandingBalance > 0)
        .filter((invoice) => (!yearId || invoice.academicYearId === yearId) &&
          (!termId || invoice.termId === termId) &&
          (!classId || invoice.classId === classId))
        .map((invoice) => {
          const student = studentById.get(invoice.studentId);
          return {
            Invoice: invoice.invoiceNumber,
            'Student name': student ? `${student.firstName} ${student.lastName}` : 'Unknown student',
            'Admission number': student?.admissionNumber ?? '',
            Class: classById.get(invoice.classId)?.name ?? 'Unknown',
            Target: formatCurrency(invoice.totalAmount),
            Paid: formatCurrency(invoice.amountPaid),
            Balance: formatCurrency(invoice.outstandingBalance),
            Status: invoice.status,
          };
        });
    }

    const query = search.trim().toLocaleLowerCase();
    return query
      ? data.filter((row) => Object.values(row).some((value) => String(value).toLocaleLowerCase().includes(query)))
      : data;
  }, [selectedReport, students, yearId, classId, classById, reportCards, termId, studentById, years, terms, payments, invoiceById, invoices, search]);

  const visibleTerms = terms.filter((term) => !yearId || term.academicYearId === yearId);
  const visibleClasses = classes.filter((schoolClass) => !yearId || schoolClass.academicYearId === yearId);
  const visibleReportTypes = user?.role === 'assistant_headmaster'
    ? reportTypes.filter((report) => report.id === 'enrollment' || report.id === 'academic')
    : reportTypes;

  function changeReport(reportId: string) {
    setSelectedReport(reportId);
    setSearch('');
  }

  function exportReport() {
    if (!rows.length) {
      addToast({ type: 'info', title: 'No matching records', message: 'Adjust the filters or search to include report data.' });
      return;
    }
    const filename = reportTypes.find((report) => report.id === selectedReport)?.id ?? 'school-report';
    downloadCSV(rows, filename);
    addToast({ type: 'success', title: 'Report exported', message: `${rows.length} matching records exported.` });
  }

  const reportTitle = reportTypes.find((report) => report.id === selectedReport)?.label ?? 'Report';
  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader title="Reports" description="Generate and export filtered school reports"
        actions={
          <>
            <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
            <Button leftIcon={<Download className="h-4 w-4" />} onClick={exportReport}>Export CSV</Button>
          </>
        } />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Report Types</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {visibleReportTypes.map((report) => {
                const Icon = report.icon;
                return (
                  <button key={report.id} type="button" onClick={() => changeReport(report.id)}
                    className={`flex min-h-11 w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                      selectedReport === report.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                    }`}>
                    <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${selectedReport === report.id ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span>
                      <span className="block text-sm font-medium">{report.label}</span>
                      <span className="block text-xs text-gray-500">{report.description}</span>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>{reportTitle}</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">
                  Academic Year
                  <select value={yearId} onChange={(event) => {
                    setYearId(event.target.value);
                    setTermId('');
                    setClassId('');
                  }} className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
                    <option value="">All Years</option>
                    {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                  </select>
                </label>
                {selectedReport !== 'enrollment' && (
                  <label className="text-sm font-medium text-gray-700">
                    Term
                    <select value={termId} onChange={(event) => setTermId(event.target.value)}
                      className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
                      <option value="">All Terms</option>
                      {visibleTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-sm font-medium text-gray-700">
                  Class
                  <select value={classId} onChange={(event) => setClassId(event.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
                    <option value="">All Classes</option>
                    {visibleClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}{schoolClass.stream ? ` ${schoolClass.stream}` : ''}</option>)}
                  </select>
                </label>
                <Input label="Search report" placeholder="Search students, admission numbers, or references"
                  value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>

              {isLoading ? (
                <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
              ) : rows.length ? (
                <div className="overflow-x-auto">
                  <p className="mb-3 text-sm text-gray-500">{rows.length} matching records</p>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      {headers.map((header) => <th key={header} className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {rows.map((row, index) => (
                        <tr key={`${selectedReport}-${index}`}>
                          {headers.map((header) => <td key={header} className="whitespace-nowrap px-3 py-3 text-sm text-gray-700">{String(row[header] ?? '—')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-12">
                  <Search className="h-10 w-10 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-900">No matching report records</p>
                  <p className="mt-1 max-w-sm text-center text-sm text-gray-500">Try changing the academic filters or search, or add records for this report.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
