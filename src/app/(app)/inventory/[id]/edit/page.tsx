'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { Class } from '@/types';
import { ITEM_CONDITIONS, ITEM_STATUSES } from '@/lib/constants';
import { inventoryItemSchema, type InventoryItemFormValues } from '@/lib/validations';

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: { quantity: 1 },
  });

  useEffect(() => {
    async function load() {
      const [item, cls] = await Promise.all([dataService.getInventoryItem(itemId), dataService.getClasses()]);
      if (!item) { router.push('/inventory'); return; }
      setClasses(cls);
      reset({
        name: item.name, category: item.category, description: item.description || '',
        quantity: item.quantity, unit: item.unit, condition: item.condition, status: item.status,
        location: item.location || '', supplier: item.supplier || '',
        acquisitionDate: item.acquisitionDate || '', notes: item.notes || '',
        assignedClassId: item.assignedClassId || '',
      });
      setIsLoading(false);
    }
    load();
  }, [itemId, reset, router]);

  const onSubmit = async (data: InventoryItemFormValues) => {
    setIsSubmitting(true);
    try {
      await dataService.updateInventoryItem(itemId, data);
      addToast({ type: 'success', title: 'Updated' });
      router.push(`/inventory/${itemId}`);
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to update item.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div>
      <PageHeader title="Edit Inventory Item" breadcrumbs={[{ label: 'Inventory', href: '/inventory' }, { label: 'Edit' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="Item Name" required {...register('name')} />
            <Input label="Category" required {...register('category')} />
            <Input label="Quantity" type="number" required {...register('quantity', { valueAsNumber: true })} />
            <Input label="Unit" required {...register('unit')} />
            <Select label="Condition" options={ITEM_CONDITIONS} {...register('condition')} />
            <Select label="Status" options={ITEM_STATUSES} {...register('status')} />
            <Select label="Assigned Class" options={[{ value: '', label: 'None' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} {...register('assignedClassId')} />
            <Input label="Location" {...register('location')} />
            <Input label="Supplier" {...register('supplier')} />
            <Input label="Acquisition Date" type="date" {...register('acquisitionDate')} />
            <Input label="Notes" className="md:col-span-2" {...register('notes')} />
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}