'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
import { generateReceiptNumber, parseCurrencyToPesewas, formatCurrency } from '@/lib/utils';

export default function NewPaymentPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'cash' },
  });

  const selectedStudent = watch('studentId');

  useEffect(() => {
    dataService.getStudents({ enrollmentStatus: 'active' }).then(setStudents);
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      dataService.getInvoices({ studentId: selectedStudent }).then((inv) => {
        setInvoices(inv);
        const outstanding = inv.find((i) => i.outstandingBalance > 0);
        if (outstanding) setValue('invoiceId', outstanding.id);
      });
    }
  }, [selectedStudent, setValue]);

  const onSubmit = async (data: PaymentFormValues) => {
    if (!user) {
      addToast({ type: 'error', title: 'Sign-in required', message: 'Please sign in again before recording a payment.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const amountInPesewas = Math.round(data.amount * 100);
      await dataService.addPayment({
        receiptNumber: generateReceiptNumber(),
        paymentReference: `REF-${Date.now()}`,
        studentId: data.studentId,
        invoiceId: data.invoiceId,
        amount: amountInPesewas,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        transactionReference: data.transactionReference,
        recordedBy: user.id,
        notes: data.notes,
        status: 'completed',
      });

      // Update invoice
      if (data.invoiceId) {
        const invoice = invoices.find((i) => i.id === data.invoiceId);
        if (invoice) {
          const newPaid = invoice.amountPaid + amountInPesewas;
          const newBalance = invoice.totalAmount - newPaid;
          await dataService.updateInvoice(data.invoiceId, {
            amountPaid: newPaid,
            outstandingBalance: Math.max(0, newBalance),
            status: newBalance <= 0 ? 'paid' : 'partial',
          });
        }
      }

      addToast({ type: 'success', title: 'Payment recorded', message: 'Receipt generated.' });
      router.push('/fees');
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to record payment.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedInvoice = invoices.find((i) => i.id === watch('invoiceId'));

  return (
    <div>
      <PageHeader title="Record Payment" breadcrumbs={[{ label: 'Fees', href: '/fees' }, { label: 'Record Payment' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select label="Student" required options={students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.admissionNumber})` }))} error={errors.studentId?.message} {...register('studentId')} />
            <Select label="Invoice (Optional)" options={[{ value: '', label: 'No specific invoice' }, ...invoices.map((i) => ({ value: i.id, label: `${i.invoiceNumber} — ${formatCurrency(i.outstandingBalance)} due` }))]} {...register('invoiceId')} />
            <Input label="Amount (GHS)" type="number" step="0.01" required error={errors.amount?.message} {...register('amount', { valueAsNumber: true })} hint={selectedInvoice ? `Outstanding: ${formatCurrency(selectedInvoice.outstandingBalance)}` : undefined} />
            <Input label="Payment Date" type="date" required error={errors.paymentDate?.message} {...register('paymentDate')} />
            <Select label="Payment Method" required options={PAYMENT_METHODS} error={errors.paymentMethod?.message} {...register('paymentMethod')} />
            <Input label="Transaction Reference" {...register('transactionReference')} />
            <Input label="Notes" className="md:col-span-2" {...register('notes')} />
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Record Payment</Button>
        </div>
      </form>
    </div>
  );
}