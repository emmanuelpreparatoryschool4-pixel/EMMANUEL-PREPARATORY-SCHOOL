'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { paymentSchema, type PaymentFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { Student, Invoice } from '@/types';
import { PAYMENT_METHODS } from '@/lib/constants';
import { generateReceiptNumber, parseCurrencyToPesewas, formatCurrency, getErrorMessage } from '@/lib/utils';

export default function NewPaymentPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'cash' },
  });

  const selectedStudent = useWatch({ control, name: 'studentId' });
  const selectedInvoiceId = useWatch({ control, name: 'invoiceId' });

  useEffect(() => {
    dataService.getStudents({ enrollmentStatus: 'active' }).then(setStudents);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setValue('invoiceId', '');
    if (!selectedStudent) return () => { cancelled = true; };

    dataService.getInvoices({ studentId: selectedStudent }).then((inv) => {
      if (cancelled) return;
      setInvoices(inv);
      const outstanding = inv.find((invoice) => invoice.outstandingBalance > 0);
      if (outstanding) setValue('invoiceId', outstanding.id);
    }).catch((error: unknown) => {
      if (!cancelled) {
        addToast({
          type: 'error',
          title: 'Could not load student invoices',
          message: getErrorMessage(error, 'Failed to load outstanding invoices.'),
        });
      }
    });

    return () => { cancelled = true; };
  }, [selectedStudent, setValue, addToast]);

  const onSubmit = async (data: PaymentFormValues) => {
    if (!user) {
      addToast({ type: 'error', title: 'Sign-in required', message: 'Please sign in again before recording a payment.' });
      return;
    }
    const invoice = data.invoiceId ? invoices.find((item) => item.id === data.invoiceId) : undefined;
    if (data.invoiceId && (!invoice || invoice.studentId !== data.studentId)) {
      addToast({ type: 'error', title: 'Invalid invoice', message: 'Select an invoice belonging to this student.' });
      return;
    }
    const amountInPesewas = parseCurrencyToPesewas(String(data.amount));
    if (invoice && amountInPesewas > invoice.outstandingBalance) {
      addToast({
        type: 'error',
        title: 'Payment exceeds the balance',
        message: `The selected invoice has ${formatCurrency(invoice.outstandingBalance)} outstanding.`,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const receiptNumber = generateReceiptNumber();
      await dataService.recordPayment({
        receiptNumber,
        paymentReference: `REF-${receiptNumber}`,
        studentId: data.studentId,
        invoiceId: data.invoiceId || undefined,
        amount: amountInPesewas,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        transactionReference: data.transactionReference,
        recordedBy: user.id,
        notes: data.notes,
        status: 'completed',
      });

      addToast({ type: 'success', title: 'Payment recorded', message: 'Receipt generated.' });
      router.push('/fees?tab=payments');
    } catch (error) {
      addToast({ type: 'error', title: 'Could not record payment', message: getErrorMessage(error, 'Failed to record payment.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  return (
    <div>
      <PageHeader title="Record Payment" breadcrumbs={[{ label: 'Fees', href: '/fees' }, { label: 'Record Payment' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select label="Student" required options={students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.admissionNumber})` }))} error={errors.studentId?.message} {...register('studentId')} />
            <Select label="Invoice (Optional)" options={[{ value: '', label: 'No specific invoice' }, ...invoices.filter((invoice) => invoice.studentId === selectedStudent).map((i) => ({ value: i.id, label: `${i.invoiceNumber} — ${formatCurrency(i.outstandingBalance)} due` }))]} {...register('invoiceId')} />
            <Input label="Amount (GHS)" type="number" step="0.01" min="0.01" max={selectedInvoice ? selectedInvoice.outstandingBalance / 100 : undefined} required error={errors.amount?.message} {...register('amount', { valueAsNumber: true })} hint={selectedInvoice ? `Outstanding: ${formatCurrency(selectedInvoice.outstandingBalance)}` : undefined} />
            <Input label="Payment Date" type="date" required error={errors.paymentDate?.message} {...register('paymentDate')} />
            <Select label="Payment Method" required options={PAYMENT_METHODS} error={errors.paymentMethod?.message} {...register('paymentMethod')} />
            <Input label="Transaction Reference" {...register('transactionReference')} />
            <Input label="Notes" className="md:col-span-2" {...register('notes')} />
          </CardContent>
        </Card>
        {selectedInvoice && (
          <Card>
            <CardHeader><CardTitle>Invoice Balance</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><p className="text-sm text-gray-500">Target amount</p><p className="mt-1 font-semibold">{formatCurrency(selectedInvoice.totalAmount)}</p></div>
              <div><p className="text-sm text-gray-500">Paid so far</p><p className="mt-1 font-semibold text-green-700">{formatCurrency(selectedInvoice.amountPaid)}</p></div>
              <div><p className="text-sm text-gray-500">Balance due</p><p className="mt-1 font-semibold text-red-700">{formatCurrency(selectedInvoice.outstandingBalance)}</p></div>
            </CardContent>
          </Card>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Record Payment</Button>
        </div>
      </form>
    </div>
  );
}