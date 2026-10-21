'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Package, Search, Eye, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { dataService } from '@/lib/db';
import { InventoryItem, TableColumn } from '@/types';
import { ITEM_STATUSES, ITEM_CONDITIONS } from '@/lib/constants';
import { getItemConditionLabel, getItemStatusLabel, formatCurrency } from '@/lib/utils';

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

  useEffect(() => {
    async function load() {
      const data = await dataService.getInventoryItems();
      setItems(data);
      setIsLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.inventoryCode.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (conditionFilter && item.condition !== conditionFilter) return false;
    return true;
  });

  const totalValue = items.reduce((s, i) => s + (i.acquisitionCost || 0) * i.quantity, 0);

  const columns: TableColumn<InventoryItem>[] = [
    { key: 'name', header: 'Item', render: (i) => (
      <div><p className="font-medium text-gray-900">{i.name}</p><p className="text-xs text-gray-500">{i.inventoryCode}</p></div>
    )},
    { key: 'category', header: 'Category' },
    { key: 'quantity', header: 'Quantity', render: (i) => `${i.quantity} ${i.unit}` },
    { key: 'condition', header: 'Condition', render: (i) => <Badge variant="status" status={i.condition}>{getItemConditionLabel(i.condition)}</Badge> },
    { key: 'status', header: 'Status', render: (i) => <Badge variant="status" status={i.status}>{getItemStatusLabel(i.status)}</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (i) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={() => router.push(`/inventory/${i.id}`)}><Eye className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => router.push(`/inventory/${i.id}/edit`)}><Pencil className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Inventory" description={`${items.length} item types · Total value: ${formatCurrency(totalValue)}`}
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/inventory/new')}>Add Item</Button>} />

      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search inventory..." />
          <Select options={[{ value: '', label: 'All Statuses' }, ...ITEM_STATUSES]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
          <Select options={[{ value: '', label: 'All Conditions' }, ...ITEM_CONDITIONS]} value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} />
        </div>

        {filtered.length === 0 && !isLoading ? (
          <EmptyState icon={Package} title="No inventory items" description="Add items to track school assets."
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/inventory/new')}>Add Item</Button>} />
        ) : (
          <Table columns={columns} data={filtered} keyExtractor={(i) => i.id} isLoading={isLoading} onRowClick={(i) => router.push(`/inventory/${i.id}`)} />
        )}
      </Card>
    </div>
  );
}