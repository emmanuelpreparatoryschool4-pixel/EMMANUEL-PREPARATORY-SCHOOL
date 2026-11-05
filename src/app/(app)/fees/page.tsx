'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, DollarSign, Receipt, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { PAYMENT_METHODS } from '@/lib/constants';
import {
  formatCurrency,
  formatCurrencyCompact,
  generateReceiptNumber,
  getErrorMessage,
  parseCurrencyToPesewas,
} from '@/lib/utils';
import {
  AcademicYear,
  Class,
  ClassFeeTarget,
  Invoice,
  Payment,
  PaymentMethod,
  Student,
  Term,
} from '@/types';

function studentName(student: Student): string {
  return [student.firstName, student.otherNames, student.lastName].filter(Boolean).join(' ');
}

function className(schoolClass: Class): string {
  return schoolClass.stream ? `${schoolClass.name} - ${schoolClass.stream}` : schoolClass.name;
}

export default function FeesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [feeTargets, setFeeTargets] = useState<ClassFeeTarget[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [editingTargetId, setEditingTargetId] = useState('');
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [studentToPay, setStudentToPay] = useState<Student | null>(null);
  const [paymentReceiptNumber, setPaymentReceiptNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'payments') {
      queueMicrotask(() => setActiveTab('payments'));
    }

    let active = true;
    async function load() {
      try {
        const [loadedClasses, loadedStudents, years, loadedTerms, targets, loadedPayments, loadedInvoices] =
          await Promise.all([
            dataService.getClasses(),
            dataService.getStudents(),
            dataService.getAcademicYears(),
            dataService.getTerms(),
            dataService.getClassFeeTargets(),
            dataService.getPayments(),
            dataService.getInvoices(),
          ]);
        if (!active) return;

        setClasses(loadedClasses);
        setStudents(loadedStudents);
        setAcademicYears(years);
        setTerms(loadedTerms);
        setFeeTargets(targets);
        setPayments(loadedPayments);
        setInvoices(loadedInvoices);

        const currentYearId = years.find((year) => year.isCurrent)?.id ?? years[0]?.id ?? '';
        const currentTermId = loadedTerms.find((term) => term.isCurrent && term.academicYearId === currentYearId)?.id
          ?? loadedTerms.find((term) => term.academicYearId === currentYearId)?.id
          ?? '';
        setSelectedYearId(currentYearId);
        setSelectedTermId(currentTermId);
        setSelectedClassId(loadedClasses.find((item) => item.academicYearId === currentYearId)?.id ?? '');
      } catch (error) {
        if (active) {
          addToast({
            type: 'error',
            title: 'Could not load fees',
            message: getErrorMessage(error, 'Failed to load fee and payment records.'),
          });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [addToast]);

  const isFeeManager = user?.role === 'owner' || user?.role === 'headmaster';
  const periodTerms = terms.filter((term) => term.academicYearId === selectedYearId);
  const periodClasses = classes.filter((schoolClass) => schoolClass.academicYearId === selectedYearId);
  const periodTargets = feeTargets.filter((target) =>
    target.status === 'active' &&
    target.academicYearId === selectedYearId &&
    target.termId === selectedTermId
  );
  const targetByClassId = new Map(periodTargets.map((target) => [target.classId, target]));
  const studentById = new Map(students.map((student) => [student.id, student]));
  const periodInvoices = invoices.filter((invoice) =>
    invoice.academicYearId === selectedYearId && invoice.termId === selectedTermId
  );
  const invoiceIdsByTargetId = new Map(periodTargets.map((target) => [
    target.id,
    new Set(periodInvoices
      .filter((invoice) => invoice.classId === target.classId)
      .map((invoice) => invoice.id)),
  ]));

  const getStudentPaid = (target: ClassFeeTarget | undefined, studentId: string): number => {
    if (!target) return 0;
    const invoiceIds = invoiceIdsByTargetId.get(target.id);
    const targetTerm = terms.find((term) => term.id === target.termId);
    const student = studentById.get(studentId);
    return payments
      .filter((payment) =>
        payment.studentId === studentId &&
        payment.status === 'completed' &&
        (
          payment.feeTargetId === target.id ||
          Boolean(!payment.feeTargetId && payment.invoiceId && invoiceIds?.has(payment.invoiceId)) ||
          Boolean(
            !payment.invoiceId &&
            !payment.feeTargetId &&
            student?.currentClassId === target.classId &&
            student.academicYearId === target.academicYearId &&
            targetTerm &&
            payment.paymentDate >= targetTerm.startDate &&
            payment.paymentDate <= targetTerm.endDate
          )
        )
      )
      .reduce((sum, payment) => sum + payment.amount, 0);
  };

  const activePeriodStudents = students.filter((student) =>
    student.academicYearId === selectedYearId && student.enrollmentStatus === 'active'
  );
  const classSummaries = periodClasses.map((schoolClass) => {
    const target = targetByClassId.get(schoolClass.id);
    const enrolled = activePeriodStudents.filter((student) => student.currentClassId === schoolClass.id);
    const expected = (target?.amount ?? 0) * enrolled.length;
    const collected = target
      ? enrolled.reduce((sum, student) => sum + getStudentPaid(target, student.id), 0)
      : 0;
    return {
      schoolClass,
      target,
      enrolled: enrolled.length,
      expected,
      collected,
      outstanding: Math.max(0, expected - collected),
    };
  });

  const expectedTotal = classSummaries.reduce((sum, item) => sum + item.expected, 0);
  const collectedTotal = classSummaries.reduce((sum, item) => sum + item.collected, 0);
  const outstandingTotal = Math.max(0, expectedTotal - collectedTotal);
  const collectionRate = expectedTotal > 0 ? Math.min(100, Math.round((collectedTotal / expectedTotal) * 100)) : 0;
  const recentPeriodPayments = payments
    .filter((payment) => {
      if (payment.status !== 'completed') return false;
      if (payment.feeTargetId) return periodTargets.some((target) => target.id === payment.feeTargetId);
      if (payment.invoiceId) return periodInvoices.some((invoice) => invoice.id === payment.invoiceId);
      const student = studentById.get(payment.studentId);
      return periodTargets.some((target) => {
        const term = terms.find((item) => item.id === target.termId);
        return Boolean(
          student &&
          term &&
          student.currentClassId === target.classId &&
          student.academicYearId === target.academicYearId &&
          payment.paymentDate >= term.startDate &&
          payment.paymentDate <= term.endDate
        );
      });
    })
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))
    .slice(0, 8);

  const selectedClass = periodClasses.find((schoolClass) => schoolClass.id === selectedClassId);
  const selectedTarget = selectedClass ? targetByClassId.get(selectedClass.id) : undefined;
  const selectedStudents = students
    .filter((student) =>
      student.currentClassId === selectedClassId &&
      student.academicYearId === selectedYearId &&
      student.enrollmentStatus === 'active'
    )
    .sort((left, right) => studentName(left).localeCompare(studentName(right)));
  const studentPaymentBalance = studentToPay && selectedTarget
    ? Math.max(0, selectedTarget.amount - getStudentPaid(selectedTarget, studentToPay.id))
    : 0;
  const paymentTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'configuration', label: 'Fee Configuration', count: periodTargets.length },
    { id: 'payments', label: 'Payment of Fees' },
  ];

  const handleYearChange = (yearId: string) => {
    const yearTerms = terms.filter((term) => term.academicYearId === yearId);
    setSelectedYearId(yearId);
    setSelectedTermId(
      yearTerms.find((term) => term.isCurrent)?.id ?? yearTerms[0]?.id ?? ''
    );
    setSelectedClassId(classes.find((schoolClass) => schoolClass.academicYearId === yearId)?.id ?? '');
    setEditingTargetId('');
    setFeeAmount('');
  };

  const handleEditTarget = (target: ClassFeeTarget) => {
    setSelectedClassId(target.classId);
    setFeeAmount((target.amount / 100).toFixed(2));
    setEditingTargetId(target.id);
  };

  const refreshFeeTargets = async () => {
    setFeeTargets(await dataService.getClassFeeTargets());
  };

  const handleSaveTarget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseCurrencyToPesewas(feeAmount);
    if (!selectedClassId || !selectedYearId || !selectedTermId || amount <= 0) {
      addToast({ type: 'error', title: 'Check the fee details', message: 'Choose a class and enter a fee greater than zero.' });
      return;
    }

    setIsSavingTarget(true);
    try {
      await dataService.saveClassFeeTarget({
        classId: selectedClassId,
        academicYearId: selectedYearId,
        termId: selectedTermId,
        amount,
      });
      await refreshFeeTargets();
      setFeeAmount('');
      setEditingTargetId('');
      addToast({ type: 'success', title: 'Class fee saved', message: 'The target fee is ready for this class and period.' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not save class fee',
        message: getErrorMessage(error, 'Check that the class and term belong to the selected academic year.'),
      });
    } finally {
      setIsSavingTarget(false);
    }
  };

  const handleDeleteTarget = async (target: ClassFeeTarget) => {
    const schoolClass = classes.find((item) => item.id === target.classId);
    if (!window.confirm(`Delete the ${schoolClass ? className(schoolClass) : 'class'} target fee? Payment history is never deleted.`)) return;
    try {
      await dataService.deleteClassFeeTarget(target.id);
      await refreshFeeTargets();
      if (editingTargetId === target.id) {
        setEditingTargetId('');
        setFeeAmount('');
      }
      addToast({ type: 'success', title: 'Fee target deleted' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not delete fee target',
        message: getErrorMessage(error, 'This fee target may have payment history. Edit it instead to preserve records.'),
      });
    }
  };

  const closePaymentForm = () => {
    setStudentToPay(null);
    setPaymentReceiptNumber('');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('cash');
    setTransactionReference('');
    setPaymentNotes('');
  };

  const handleRecordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentToPay || !selectedTarget || !user) {
      addToast({ type: 'error', title: 'Payment could not be recorded', message: 'Select an active student and class fee.' });
      return;
    }
    const amount = parseCurrencyToPesewas(paymentAmount);
    const remaining = Math.max(0, selectedTarget.amount - getStudentPaid(selectedTarget, studentToPay.id));
    if (amount <= 0 || amount > remaining) {
      addToast({
        type: 'error',
        title: 'Check the payment amount',
        message: `Enter an amount above zero and no more than ${formatCurrency(remaining)}.`,
      });
      return;
    }

    setIsRecordingPayment(true);
    try {
      const receiptNumber = paymentReceiptNumber || generateReceiptNumber();
      setPaymentReceiptNumber(receiptNumber);
      await dataService.recordClassFeePayment({
        receiptNumber,
        paymentReference: `REF-${receiptNumber}`,
        studentId: studentToPay.id,
        feeTargetId: selectedTarget.id,
        amount,
        paymentDate,
        paymentMethod,
        transactionReference,
        recordedBy: user.id,
        notes: paymentNotes,
        status: 'completed',
      });
      setPayments(await dataService.getPayments());
      addToast({ type: 'success', title: 'Payment recorded', message: `Receipt ${receiptNumber} has been saved.` });
      closePaymentForm();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not record payment',
        message: getErrorMessage(error, 'The payment was not saved. Check the balance and try again.'),
      });
    } finally {
      setIsRecordingPayment(false);
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div>
      <PageHeader title="Fees & Payments" description="Set class fees, record payments, and check balances." />

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Academic year"
            value={selectedYearId}
            onChange={(event) => handleYearChange(event.target.value)}
            options={[
              { value: '', label: 'Select an academic year' },
              ...academicYears.map((year) => ({ value: year.id, label: year.name })),
            ]}
          />
          <Select
            label="Term"
            value={selectedTermId}
            onChange={(event) => {
              setSelectedTermId(event.target.value);
              setEditingTargetId('');
              setFeeAmount('');
            }}
            options={[
              { value: '', label: 'Select a term' },
              ...periodTerms.map((term) => ({ value: term.id, label: term.name })),
            ]}
          />
        </div>
        {(!selectedYearId || !selectedTermId) && (
          <p className="mt-3 text-sm text-amber-700">
            Set up an academic year and term in Academics before configuring or collecting fees.
          </p>
        )}
      </Card>

      <Tabs tabs={paymentTabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Expected fees" amount={expectedTotal} icon={<Users className="h-5 w-5" />} tone="blue" />
            <SummaryCard label="Collected" amount={collectedTotal} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <SummaryCard label="Outstanding" amount={outstandingTotal} icon={<AlertCircle className="h-5 w-5" />} tone="red" />
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Collection progress</p>
                  <p className="mt-1 text-2xl font-bold text-primary-700">{collectionRate}%</p>
                </div>
                <div className="rounded-lg bg-primary-50 p-3 text-primary-700"><Receipt className="h-5 w-5" /></div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-primary-600" style={{ width: `${collectionRate}%` }} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Class fee summary</CardTitle></CardHeader>
            <CardContent>
              {classSummaries.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No classes are set up for this academic year.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <TableHeading>Class</TableHeading>
                        <TableHeading align="right">Students</TableHeading>
                        <TableHeading align="right">Target per student</TableHeading>
                        <TableHeading align="right">Collected</TableHeading>
                        <TableHeading align="right">Outstanding</TableHeading>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {classSummaries.map(({ schoolClass, target, enrolled, collected, outstanding }) => (
                        <tr key={schoolClass.id}>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">{className(schoolClass)}</td>
                          <td className="px-3 py-3 text-right text-sm text-gray-600">{enrolled}</td>
                          <td className="px-3 py-3 text-right text-sm">{target ? formatCurrency(target.amount) : 'Not set'}</td>
                          <td className="px-3 py-3 text-right text-sm text-green-700">{formatCurrency(collected)}</td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-red-700">{formatCurrency(outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent payments</CardTitle></CardHeader>
            <CardContent>
              {recentPeriodPayments.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No payments have been recorded for this period yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <TableHeading>Student</TableHeading>
                        <TableHeading>Receipt</TableHeading>
                        <TableHeading>Date</TableHeading>
                        <TableHeading>Method</TableHeading>
                        <TableHeading align="right">Amount</TableHeading>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentPeriodPayments.map((payment) => {
                        const student = students.find((item) => item.id === payment.studentId);
                        return (
                          <tr key={payment.id}>
                            <td className="px-3 py-3 text-sm text-gray-900">{student ? studentName(student) : 'Student record'}</td>
                            <td className="px-3 py-3 text-sm text-gray-600">{payment.receiptNumber}</td>
                            <td className="px-3 py-3 text-sm text-gray-600">{payment.paymentDate}</td>
                            <td className="px-3 py-3 text-sm capitalize text-gray-600">{payment.paymentMethod.replaceAll('_', ' ')}</td>
                            <td className="px-3 py-3 text-right text-sm font-medium text-green-700">{formatCurrency(payment.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'configuration' && (
        <div className="space-y-6">
          {isFeeManager ? (
            <Card>
              <CardHeader>
                <CardTitle>{editingTargetId ? 'Edit class target fee' : 'Set a class target fee'}</CardTitle>
                <p className="text-sm text-gray-500">
                  Each class can have one target fee for the selected academic year and term.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveTarget} className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
                  <Select
                    label="Class"
                    required
                    value={selectedClassId}
                    onChange={(event) => {
                      setSelectedClassId(event.target.value);
                      setEditingTargetId('');
                      setFeeAmount('');
                    }}
                    options={[
                      { value: '', label: 'Choose a class' },
                      ...periodClasses.map((schoolClass) => ({ value: schoolClass.id, label: className(schoolClass) })),
                    ]}
                  />
                  <Input
                    label="Target fee (GHS)"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={feeAmount}
                    onChange={(event) => setFeeAmount(event.target.value)}
                    placeholder="e.g. 500.00"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" isLoading={isSavingTarget}>{editingTargetId ? 'Save changes' : 'Save fee'}</Button>
                    {editingTargetId && (
                      <Button type="button" variant="outline" onClick={() => { setEditingTargetId(''); setFeeAmount(''); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Only an Owner or Headmaster can configure class fees.
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Configured fees</CardTitle></CardHeader>
            <CardContent>
              {periodTargets.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No target fees have been set for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <TableHeading>Class Name</TableHeading>
                        <TableHeading align="right">Target Fee</TableHeading>
                        <TableHeading align="right">Action</TableHeading>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {periodTargets.map((target) => {
                        const schoolClass = classes.find((item) => item.id === target.classId);
                        return (
                          <tr key={target.id}>
                            <td className="px-3 py-3 text-sm font-medium text-gray-900">
                              {schoolClass ? className(schoolClass) : 'Class'}
                            </td>
                            <td className="px-3 py-3 text-right text-sm">{formatCurrency(target.amount)}</td>
                            <td className="px-3 py-3 text-right">
                              {isFeeManager && (
                                <div className="inline-flex gap-2">
                                  <Button type="button" size="sm" variant="outline" onClick={() => handleEditTarget(target)}>Edit</Button>
                                  <Button type="button" size="sm" variant="danger" onClick={() => void handleDeleteTarget(target)}>Delete</Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">1. Choose a class</h2>
            {periodClasses.length === 0 ? (
              <Card className="p-6 text-center text-sm text-gray-500">No classes are available for this academic year.</Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {periodClasses.map((schoolClass) => {
                  const target = targetByClassId.get(schoolClass.id);
                  const classCount = activePeriodStudents.filter((student) => student.currentClassId === schoolClass.id).length;
                  return (
                    <button
                      key={schoolClass.id}
                      type="button"
                      onClick={() => setSelectedClassId(schoolClass.id)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selectedClassId === schoolClass.id
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100'
                          : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-gray-900">{className(schoolClass)}</span>
                        <span className="text-xs text-gray-500">{classCount} students</span>
                      </span>
                      <span className="mt-2 block text-sm text-gray-600">
                        {target ? `Target fee: ${formatCurrency(target.amount)}` : 'Fee not configured'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedClass && (
            <Card>
              <CardHeader>
                <CardTitle>2. Select a student — {className(selectedClass)}</CardTitle>
                <p className="text-sm text-gray-500">
                  {selectedTarget
                    ? `Target per student: ${formatCurrency(selectedTarget.amount)}`
                    : 'Set this class fee in Fee Configuration before recording payments.'}
                </p>
              </CardHeader>
              <CardContent>
                {selectedStudents.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No active students are enrolled in this class.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <TableHeading>Student Name</TableHeading>
                          <TableHeading align="right">Target Fee</TableHeading>
                          <TableHeading align="right">Total Amount Paid</TableHeading>
                          <TableHeading align="right">Outstanding Balance</TableHeading>
                          <TableHeading>Payment Status</TableHeading>
                          <TableHeading align="right">Action</TableHeading>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedStudents.map((student) => {
                          const paid = getStudentPaid(selectedTarget, student.id);
                          const balance = selectedTarget ? Math.max(0, selectedTarget.amount - paid) : 0;
                          const status = !selectedTarget
                            ? 'Fee not set'
                            : balance === 0
                              ? 'Paid'
                              : paid > 0
                                ? 'Partially Paid'
                                : 'Unpaid';
                          return (
                            <tr key={student.id}>
                              <td className="px-3 py-3 text-sm">
                                <p className="font-medium text-gray-900">{studentName(student)}</p>
                                <p className="text-xs text-gray-500">{student.admissionNumber}</p>
                              </td>
                              <td className="px-3 py-3 text-right text-sm">{selectedTarget ? formatCurrency(selectedTarget.amount) : '—'}</td>
                              <td className="px-3 py-3 text-right text-sm text-green-700">{formatCurrency(paid)}</td>
                              <td className="px-3 py-3 text-right text-sm font-medium text-red-700">{selectedTarget ? formatCurrency(balance) : '—'}</td>
                              <td className="px-3 py-3 text-sm">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                  status === 'Paid' ? 'bg-green-100 text-green-800'
                                    : status === 'Partially Paid' ? 'bg-amber-100 text-amber-800'
                                      : status === 'Unpaid' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {status === 'Paid' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                                  {status}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!isFeeManager || !selectedTarget || balance <= 0}
                                  onClick={() => {
                                    setStudentToPay(student);
                                    setPaymentReceiptNumber(generateReceiptNumber());
                                    setPaymentAmount('');
                                  }}
                                >
                                  Record payment
                                </Button>
                              </td>
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
        </div>
      )}

      <Modal
        isOpen={Boolean(studentToPay)}
        onClose={() => {
          if (!isRecordingPayment) closePaymentForm();
        }}
        title="Record a payment"
        description={studentToPay ? `${studentName(studentToPay)} · ${selectedClass ? className(selectedClass) : ''}` : undefined}
      >
        {studentToPay && (
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="text-gray-600">Balance remaining</p>
              <p className="mt-1 text-lg font-semibold text-red-700">{formatCurrency(studentPaymentBalance)}</p>
            </div>
            <Input
              label="Amount paid (GHS)"
              type="number"
              min="0.01"
              max={(studentPaymentBalance / 100).toFixed(2)}
              step="0.01"
              required
              autoFocus
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              placeholder="e.g. 100.00"
            />
            <Input
              label="Payment date"
              type="date"
              required
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
            <Select
              label="Payment method"
              required
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              options={PAYMENT_METHODS}
            />
            <Input
              label="Reference (optional)"
              value={transactionReference}
              onChange={(event) => setTransactionReference(event.target.value)}
              placeholder="Bank or mobile money reference"
            />
            <Input
              label="Notes (optional)"
              value={paymentNotes}
              onChange={(event) => setPaymentNotes(event.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closePaymentForm} disabled={isRecordingPayment}>Cancel</Button>
              <Button type="submit" isLoading={isRecordingPayment} leftIcon={<DollarSign className="h-4 w-4" />}>
                Save payment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  icon,
  tone,
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'red';
}) {
  const toneStyles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrencyCompact(amount)}</p>
        </div>
        <div className={`rounded-lg p-3 ${toneStyles[tone]}`}>{icon}</div>
      </div>
    </Card>
  );
}

function TableHeading({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-3 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-medium uppercase tracking-wide text-gray-500`}>
      {children}
    </th>
  );
}
