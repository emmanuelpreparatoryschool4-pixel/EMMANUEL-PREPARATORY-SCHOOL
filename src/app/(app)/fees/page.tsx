'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Receipt, FileText, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { dataService } from '@/lib/db';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils';
import { Invoice, Payment, Student, Class, AcademicYear, Term, FeeCategory, FeeStructure } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

export default function FeesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [feeTarget, setFeeTarget] = useState({
    classId: '',
    academicYearId: '',
    termId: '',
    feeCategoryId: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
  });
  const [isSavingFeeTarget, setIsSavingFeeTarget] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'payments') {
      queueMicrotask(() => setActiveTab('payments'));
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [inv, pay] = await Promise.all([
          dataService.getInvoices(),
          dataService.getPayments(),
        ]);
        const [allStudents, allClasses, years, allTerms, categories, structures] = await Promise.all([
          dataService.getStudents(),
          dataService.getClasses(),
          dataService.getAcademicYears(),
          dataService.getTerms(),
          dataService.getFeeCategories(),
          dataService.getFeeStructures(),
        ]);
        setInvoices(inv);
        setPayments(pay);
        setStudents(allStudents);
        setClasses(allClasses);
        setAcademicYears(years);
        setTerms(allTerms);
        setFeeCategories(categories);
        setFeeStructures(structures);
        const currentYearId = years.find((year) => year.isCurrent)?.id ?? years[0]?.id ?? '';
        setFeeTarget((current) => ({
          ...current,
          academicYearId: currentYearId,
          classId: allClasses.find((schoolClass) => schoolClass.academicYearId === currentYearId)?.id ?? '',
          termId: allTerms.find((term) => term.isCurrent && term.academicYearId === currentYearId)?.id ??
            allTerms.find((term) => term.academicYearId === currentYearId)?.id ?? '',
          feeCategoryId: categories.find((category) => category.status === 'active')?.id ?? '',
        }));
        setSelectedYearId(currentYearId);
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Could not load fees',
          message: error instanceof Error ? error.message : 'Failed to load fee records.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [addToast]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'invoices', label: 'Invoices', count: invoices.length },
    { id: 'payments', label: 'Payments', count: payments.length },
    { id: 'debtors', label: 'Outstanding Debt' },
    { id: 'fee-targets', label: 'Class Fee Targets', count: feeStructures.length },
  ];

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const classMap = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass]));
  const yearMap = new Map(academicYears.map((year) => [year.id, year]));
  const termMap = new Map(terms.map((term) => [term.id, term]));
  const feeCategoryMap = new Map(feeCategories.map((category) => [category.id, category]));
  const invoiceMatches = (invoice: Invoice) => (
    (!selectedYearId || invoice.academicYearId === selectedYearId) &&
    (!selectedTermId || invoice.termId === selectedTermId) &&
    (!selectedClassId || invoice.classId === selectedClassId)
  );
  const filteredInvoices = invoices.filter(invoiceMatches);
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const academicPayments = payments.filter((payment) => {
    if (!payment.invoiceId) {
      if (selectedTermId) return false;
      const student = studentMap.get(payment.studentId);
      return Boolean(student &&
        (!selectedYearId || student.academicYearId === selectedYearId) &&
        (!selectedClassId || student.currentClassId === selectedClassId));
    }
    const invoice = invoiceMap.get(payment.invoiceId);
    if (invoice) return invoiceMatches(invoice);
    if (selectedTermId) return false;
    const student = studentMap.get(payment.studentId);
    return Boolean(student &&
      (!selectedYearId || student.academicYearId === selectedYearId) &&
      (!selectedClassId || student.currentClassId === selectedClassId));
  });
  const filteredPayments = academicPayments.filter((payment) =>
    (!startDate || payment.paymentDate >= startDate) &&
    (!endDate || payment.paymentDate <= endDate)
  );
  const collected = filteredPayments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const expected = filteredInvoices
    .filter((invoice) => invoice.status !== 'cancelled')
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const outstanding = filteredInvoices
    .filter((invoice) => invoice.status !== 'cancelled')
    .reduce((sum, invoice) => sum + invoice.outstandingBalance, 0);
  const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
  const studentAccountMap = new Map(students.map((student) => {
    const studentInvoices = filteredInvoices.filter((invoice) => invoice.studentId === student.id && invoice.status !== 'cancelled');
    const target = studentInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const paid = academicPayments
      .filter((payment) => payment.studentId === student.id && payment.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0);
    return [student.id, { target, paid, balance: Math.max(0, target - paid) }] as const;
  }));
  const periodStudents = new Set(filteredInvoices.map((invoice) => invoice.studentId));
  const fullyPaidCount = [...periodStudents].filter((studentId) => studentAccountMap.get(studentId)?.balance === 0).length;
  const partlyPaidCount = [...periodStudents].filter((studentId) => {
    const account = studentAccountMap.get(studentId);
    return Boolean(account && account.paid > 0 && account.balance > 0);
  }).length;
  const unpaidCount = [...periodStudents].filter((studentId) => studentAccountMap.get(studentId)?.paid === 0).length;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const receivedToday = academicPayments.filter((payment) => payment.paymentDate === today && payment.status === 'completed').reduce((sum, payment) => sum + payment.amount, 0);
  const receivedThisMonth = academicPayments.filter((payment) => payment.paymentDate >= monthStart && payment.status === 'completed').reduce((sum, payment) => sum + payment.amount, 0);
  const collectionTrend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date();
    monthDate.setDate(1);
    monthDate.setMonth(monthDate.getMonth() - (5 - index));
    const key = monthDate.toISOString().slice(0, 7);
    return {
      label: monthDate.toLocaleDateString(undefined, { month: 'short' }),
      amount: filteredPayments.filter((payment) => payment.paymentDate.startsWith(key) && payment.status === 'completed')
        .reduce((sum, payment) => sum + payment.amount, 0),
    };
  });
  const isFeeManager = user?.role === 'owner' || user?.role === 'headmaster';
  const filteredFeeTerms = terms.filter((term) => term.academicYearId === feeTarget.academicYearId);
  const selectedAcademicTerms = terms.filter((term) => term.academicYearId === selectedYearId);

  const saveFeeTarget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(feeTarget.amount);
    if (!feeTarget.classId || !feeTarget.academicYearId || !feeTarget.termId || !feeTarget.feeCategoryId ||
      !feeTarget.dueDate || !Number.isFinite(amount) || amount < 0) {
      addToast({ type: 'error', title: 'Check the fee target', message: 'Choose a class, academic year, term, fee category, amount, and due date.' });
      return;
    }
    if (classMap.get(feeTarget.classId)?.academicYearId !== feeTarget.academicYearId ||
      termMap.get(feeTarget.termId)?.academicYearId !== feeTarget.academicYearId) {
      addToast({ type: 'error', title: 'Check the academic year', message: 'The class and term must belong to the selected academic year.' });
      return;
    }

    setIsSavingFeeTarget(true);
    try {
      await dataService.saveFeeStructure({
        classId: feeTarget.classId,
        academicYearId: feeTarget.academicYearId,
        termId: feeTarget.termId,
        feeCategoryId: feeTarget.feeCategoryId,
        amount: Math.round(amount * 100),
        dueDate: feeTarget.dueDate,
        status: 'active',
      });
      setFeeStructures(await dataService.getFeeStructures());
      addToast({ type: 'success', title: 'Class fee target saved' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not save class fee target',
        message: error instanceof Error ? error.message : 'Failed to save the class fee target.',
      });
    } finally {
      setIsSavingFeeTarget(false);
    }
  };

  return (
    <div>
      <PageHeader title="Fees & Payments" description="Manage fee structures, invoices, payments, and debt"
        actions={
          <>
            <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />} onClick={() => router.push('/fees/invoices/new')}>New Invoice</Button>
            <Button leftIcon={<Receipt className="h-4 w-4" />} onClick={() => router.push('/fees/payments/new')}>Record Payment</Button>
          </>
        } />

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium text-gray-700">
            Academic year
            <select
              value={selectedYearId}
              onChange={(event) => {
                const yearId = event.target.value;
                setSelectedYearId(yearId);
                setSelectedTermId('');
                setSelectedClassId('');
              }}
              className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">All academic years</option>
              {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Term
            <select
              value={selectedTermId}
              onChange={(event) => setSelectedTermId(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">All terms</option>
              {selectedAcademicTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Class
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">All classes</option>
              {classes.filter((schoolClass) => !selectedYearId || schoolClass.academicYearId === selectedYearId)
                .map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Payments from
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Payments to
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm" />
          </label>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Expected Fees</p><p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrencyCompact(expected)}</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><FileText className="h-5 w-5" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Fees Collected</p><p className="mt-1 text-2xl font-bold text-green-600">{formatCurrencyCompact(collected)}</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 text-green-600"><DollarSign className="h-5 w-5" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Outstanding</p><p className="mt-1 text-2xl font-bold text-red-600">{formatCurrencyCompact(outstanding)}</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 text-red-600"><AlertCircle className="h-5 w-5" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Collection Rate</p><p className="mt-1 text-2xl font-bold text-primary-600">{collectionRate}%</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-600"><Receipt className="h-5 w-5" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Paid / partial / unpaid</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{fullyPaidCount} / {partlyPaidCount} / {unpaidCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Received today / this month</p>
          <p className="mt-1 text-sm font-bold text-gray-900">{formatCurrencyCompact(receivedToday)} / {formatCurrencyCompact(receivedThisMonth)}</p>
        </Card>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle>Collection trend</CardTitle>
            <p className="text-sm text-gray-500">Payments recorded in the most recent six months</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {collectionTrend.map((month) => {
                const maximum = Math.max(1, ...collectionTrend.map((item) => item.amount));
                const height = Math.max(6, Math.round((month.amount / maximum) * 100));
                return (
                  <div key={month.label} className="flex min-h-36 flex-col justify-end rounded-lg bg-gray-50 p-3">
                    <p className="mb-2 text-center text-xs font-medium text-gray-700">{formatCurrencyCompact(month.amount)}</p>
                    <div className="mx-auto w-8 rounded-t bg-primary-500" style={{ height: `${height}px` }} />
                    <p className="mt-2 text-center text-xs text-gray-500">{month.label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'invoices' && (
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No invoices created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Invoice / Student</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Class</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Target</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Paid</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Balance</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredInvoices.map((invoice) => {
                      const student = studentMap.get(invoice.studentId);
                      const schoolClass = classMap.get(invoice.classId);
                      return (
                        <tr key={invoice.id}>
                          <td className="px-3 py-3 text-sm">
                            <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                            <p className="text-gray-500">{student ? `${student.firstName} ${student.lastName}` : 'Unknown student'}</p>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{schoolClass?.name ?? '—'}</td>
                          <td className="px-3 py-3 text-right text-sm">{formatCurrency(invoice.totalAmount)}</td>
                          <td className="px-3 py-3 text-right text-sm text-green-700">{formatCurrency(invoice.amountPaid)}</td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-red-700">{formatCurrency(invoice.outstandingBalance)}</td>
                          <td className="px-3 py-3 text-sm capitalize">{invoice.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'payments' && (
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent>
            {filteredPayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Receipt / Student</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Invoice</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Date / Method</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Student target</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Student paid</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Student balance</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">This payment</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredPayments.map((payment) => {
                      const student = studentMap.get(payment.studentId);
                      const invoice = invoices.find((item) => item.id === payment.invoiceId);
                      const account = studentAccountMap.get(payment.studentId);
                      return (
                        <tr key={payment.id}>
                          <td className="px-3 py-3 text-sm">
                            <p className="font-medium text-gray-900">{payment.receiptNumber}</p>
                            <p className="text-gray-500">{student ? `${student.firstName} ${student.lastName}` : 'Unknown student'}</p>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{invoice?.invoiceNumber ?? 'Unallocated'}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{payment.paymentDate} · {payment.paymentMethod.replace('_', ' ')}</td>
                          <td className="px-3 py-3 text-right text-sm">{account ? formatCurrency(account.target) : '—'}</td>
                          <td className="px-3 py-3 text-right text-sm text-green-700">{account ? formatCurrency(account.paid) : '—'}</td>
                          <td className="px-3 py-3 text-right text-sm text-red-700">{account ? formatCurrency(account.balance) : '—'}</td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-green-700">{formatCurrency(payment.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'debtors' && (
        <Card>
          <CardHeader><CardTitle>Outstanding Debt</CardTitle></CardHeader>
          <CardContent>
            {filteredInvoices.filter((invoice) => invoice.outstandingBalance > 0 && invoice.status !== 'cancelled').length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No outstanding balances match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Academic period / class</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Expected</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Paid</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Balance</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredInvoices.filter((invoice) => invoice.outstandingBalance > 0 && invoice.status !== 'cancelled').map((invoice) => {
                      const student = studentMap.get(invoice.studentId);
                      return (
                        <tr key={invoice.id}>
                          <td className="px-3 py-3 text-sm">
                            <a className="font-medium text-primary-700 hover:underline" href={`/students/${invoice.studentId}`}>
                              {student ? `${student.firstName} ${student.lastName}` : 'Unknown student'}
                            </a>
                            <p className="text-xs text-gray-500">{student?.admissionNumber}</p>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            {yearMap.get(invoice.academicYearId)?.name} · {termMap.get(invoice.termId)?.name} · {classMap.get(invoice.classId)?.name}
                          </td>
                          <td className="px-3 py-3 text-right text-sm">{formatCurrency(invoice.totalAmount)}</td>
                          <td className="px-3 py-3 text-right text-sm text-green-700">{formatCurrency(invoice.amountPaid)}</td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-red-700">{formatCurrency(invoice.outstandingBalance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'fee-targets' && (
        <div className="space-y-6">
          {isFeeManager ? (
            <Card>
              <CardHeader><CardTitle>Set class fee target</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={saveFeeTarget} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm font-medium text-gray-700">
                    Class
                    <select className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm" required value={feeTarget.classId} onChange={(event) => setFeeTarget((current) => ({ ...current, classId: event.target.value }))}>
                      {classes.filter((schoolClass) => schoolClass.academicYearId === feeTarget.academicYearId).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}{schoolClass.stream ? ` - ${schoolClass.stream}` : ''}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Academic year
                    <select className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm" required value={feeTarget.academicYearId} onChange={(event) => {
                      const academicYearId = event.target.value;
                      setFeeTarget((current) => ({
                        ...current,
                        academicYearId,
                        classId: classes.find((schoolClass) => schoolClass.academicYearId === academicYearId)?.id ?? '',
                        termId: terms.find((term) => term.academicYearId === academicYearId)?.id ?? '',
                      }));
                    }}>
                      {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Term
                    <select className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm" required value={feeTarget.termId} onChange={(event) => setFeeTarget((current) => ({ ...current, termId: event.target.value }))}>
                      {filteredFeeTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Fee category
                    <select className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm" required value={feeTarget.feeCategoryId} onChange={(event) => setFeeTarget((current) => ({ ...current, feeCategoryId: event.target.value }))}>
                      {feeCategories.filter((category) => category.status === 'active').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Target amount (GHS)
                    <input type="number" min="0" step="0.01" required value={feeTarget.amount} onChange={(event) => setFeeTarget((current) => ({ ...current, amount: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Due date
                    <input type="date" required value={feeTarget.dueDate} onChange={(event) => setFeeTarget((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" />
                  </label>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Button type="submit" isLoading={isSavingFeeTarget}>Save class fee target</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Only an Owner or Headmaster can change class fee targets.
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Configured class fee targets</CardTitle></CardHeader>
            <CardContent>
              {feeStructures.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No class fee targets configured yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Class</th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Year / term</th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Fee</th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Target amount</th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Due date</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {feeStructures.map((fee) => (
                        <tr key={fee.id}>
                          <td className="px-3 py-3 text-sm text-gray-900">{classMap.get(fee.classId)?.name ?? '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{yearMap.get(fee.academicYearId)?.name ?? '—'} / {termMap.get(fee.termId)?.name ?? '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{feeCategoryMap.get(fee.feeCategoryId)?.name ?? '—'}</td>
                          <td className="px-3 py-3 text-right text-sm font-medium">{formatCurrency(fee.amount)}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{fee.dueDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}