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
import { inventoryItemSchema, type InventoryItemFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { Class } from '@/types';
import { ITEM_CONDITIONS, ITEM_STATUSES } from '@/lib/constants';
import { generateInventoryCode } from '@/lib/utils';

export default function NewInventoryItemPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: { condition: 'good', status: 'available', unit: 'pieces', quantity: 1 },
  });

  useEffect(() => {
    dataService.getClasses().then(setClasses);
  }, []);

  const onSubmit = async (data: InventoryItemFormValues) => {
    setIsSubmitting(true);
    try {
      await dataService.addInventoryItem({
        ...data,
        inventoryCode: generateInventoryCode(),
        acquisitionCost: data.acquisitionCost ? Math.round(data.acquisitionCost * 100) : undefined,
      });
      addToast({ type: 'success', title: 'Item added' });
      router.push('/inventory');
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to add item.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Add Inventory Item" breadcrumbs={[{ label: 'Inventory', href: '/inventory' }, { label: 'Add Item' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="Item Name" required error={errors.name?.message} {...register('name')} />
            <Input label="Category" required error={errors.category?.message} {...register('category')} />
            <Input label="Quantity" type="number" required error={errors.quantity?.message} {...register('quantity', { valueAsNumber: true })} />
            <Input label="Unit" required error={errors.unit?.message} {...register('unit')} placeholder="pieces, boxes, etc." />
            <Select label="Condition" required options={ITEM_CONDITIONS} {...register('condition')} />
            <Select label="Status" required options={ITEM_STATUSES} {...register('status')} />
            <Select label="Assigned Class" options={[{ value: '', label: 'None' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} {...register('assignedClassId')} />
            <Input label="Location" {...register('location')} />
            <Input label="Supplier" {...register('supplier')} />
            <Input label="Acquisition Date" type="date" {...register('acquisitionDate')} />
            <Input label="Acquisition Cost (GHS)" type="number" step="0.01" {...register('acquisitionCost', { valueAsNumber: true })} />
            <Input label="Description" className="md:col-span-2" {...register('description')} />
            <Input label="Notes" className="md:col-span-2" {...register('notes')} />
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Item</Button>
        </div>
      </form>
    </div>
  );
}