'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { invoiceSchema, type InvoiceFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { Student, FeeCategory, AcademicYear, Term } from '@/types';
import { generateInvoiceNumber, getErrorMessage } from '@/lib/utils';

export default function NewInvoicePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      items: [{ feeCategoryId: '', description: '', amount: 0 }],
      discount: 0,
      dueDate: new Date().toISOString().split('T')[0],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const selectedYear = useWatch({ control, name: 'academicYearId' });
  const selectedTerm = useWatch({ control, name: 'termId' });
  const selectedStudentId = useWatch({ control, name: 'studentId' });

  useEffect(() => {
    async function load() {
      const [s, fc, y, t] = await Promise.all([
        dataService.getStudents({ enrollmentStatus: 'active' }),
        dataService.getFeeCategories(),
        dataService.getAcademicYears(),
        dataService.getTerms(),
      ]);
      setStudents(s);
      setFeeCategories(fc);
      setAcademicYears(y);
      setTerms(t);
      const cy = y.find((yr) => yr.isCurrent);
      const ct = t.find((tm) => tm.isCurrent && tm.academicYearId === cy?.id) ??
        t.find((tm) => tm.academicYearId === cy?.id);
      if (cy) setValue('academicYearId', cy.id);
      if (ct) setValue('termId', ct.id);
    }
    load().catch((error: unknown) => {
      addToast({
        type: 'error',
        title: 'Could not load invoice options',
        message: getErrorMessage(error, 'Failed to load students, classes, and fees.'),
      });
    });
  }, [addToast, setValue]);

  useEffect(() => {
    let cancelled = false;
    const student = students.find((item) => item.id === selectedStudentId);
    if (!student || !selectedYear || !selectedTerm) return () => { cancelled = true; };

    dataService.getFeeStructures({
      classId: student.currentClassId,
      academicYearId: selectedYear,
      termId: selectedTerm,
    }).then((structures) => {
      if (cancelled) return;
      if (structures.length === 0) {
        setValue('items', [{ feeCategoryId: '', description: '', amount: 0 }]);
        setValue('dueDate', new Date().toISOString().split('T')[0]);
        return;
      }
      const categoriesById = new Map(feeCategories.map((category) => [category.id, category]));
      setValue('items', structures.map((fee) => ({
        feeCategoryId: fee.feeCategoryId,
        description: categoriesById.get(fee.feeCategoryId)?.name ?? 'Class fee',
        amount: fee.amount / 100,
      })));
      setValue('dueDate', structures[0].dueDate);
    }).catch((error: unknown) => {
      if (!cancelled) {
        addToast({
          type: 'error',
          title: 'Could not load class fees',
          message: getErrorMessage(error, 'Failed to load the configured fee targets.'),
        });
      }
    });

    return () => { cancelled = true; };
  }, [selectedStudentId, selectedYear, selectedTerm, students, feeCategories, setValue, addToast]);

  const filteredTerms = terms.filter((t) => t.academicYearId === selectedYear);

  const onSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      const student = students.find((s) => s.id === data.studentId);
      if (!student?.currentClassId) {
        throw new Error('The selected student is not assigned to a class. Assign a class before creating an invoice.');
      }
      const items = data.items.map((item) => ({
        id: `${Date.now()}-${Math.random()}`,
        feeCategoryId: item.feeCategoryId,
        description: item.description,
        amount: Math.round(item.amount * 100),
      }));
      const subtotal = items.reduce((s, i) => s + i.amount, 0);
      const discount = Math.round((data.discount || 0) * 100);
      const total = subtotal - discount;

      await dataService.addInvoice({
        invoiceNumber: generateInvoiceNumber(),
        studentId: data.studentId,
        classId: student.currentClassId,
        academicYearId: data.academicYearId,
        termId: data.termId,
        items,
        subtotal,
        discount,
        totalAmount: total,
        amountPaid: 0,
        outstandingBalance: total,
        dueDate: data.dueDate,
        status: 'issued',
      });

      addToast({ type: 'success', title: 'Invoice created' });
      router.push('/fees');
    } catch (error) {
      addToast({ type: 'error', title: 'Could not create invoice', message: getErrorMessage(error, 'Failed to create invoice.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Create Invoice" breadcrumbs={[{ label: 'Fees', href: '/fees' }, { label: 'New Invoice' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select label="Student" required options={students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.admissionNumber})` }))} error={errors.studentId?.message} {...register('studentId')} />
            <Select label="Academic Year" required options={academicYears.map((y) => ({ value: y.id, label: y.name }))} error={errors.academicYearId?.message} {...register('academicYearId')} />
            <Select label="Term" required options={filteredTerms.map((t) => ({ value: t.id, label: t.name }))} error={errors.termId?.message} {...register('termId')} />
            <Input label="Due Date" type="date" required error={errors.dueDate?.message} {...register('dueDate')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader action={
            <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => append({ feeCategoryId: '', description: '', amount: 0 })}>Add Item</Button>
          }>
            <CardTitle>Fee Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-4">
                <Select label="Fee Category" options={feeCategories.map((f) => ({ value: f.id, label: f.name }))} {...register(`items.${index}.feeCategoryId`)} />
                <Input label="Description" {...register(`items.${index}.description`)} />
                <Input label="Amount (GHS)" type="number" step="0.01" {...register(`items.${index}.amount`, { valueAsNumber: true })} />
                <div className="flex items-end">
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Input label="Discount (GHS)" type="number" min="0" step="0.01" error={errors.discount?.message} {...register('discount', { valueAsNumber: true })} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Create Invoice</Button>
        </div>
      </form>
    </div>
  );
}