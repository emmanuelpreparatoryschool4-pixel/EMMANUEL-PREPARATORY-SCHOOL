'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, ArrowLeft, Package, History } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { dataService } from '@/lib/db';
import { InventoryItem, InventoryMovement } from '@/types';
import { formatDate, formatCurrency, getItemConditionLabel, getItemStatusLabel } from '@/lib/utils';

export default function InventoryItemPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const i = await dataService.getInventoryItem(itemId);
      if (!i) { router.push('/inventory'); return; }
      setItem(i);
      const m = await dataService.getInventoryMovements(itemId);
      setMovements(m);
      setIsLoading(false);
    }
    load();
  }, [itemId, router]);

  if (isLoading || !item) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div>
      <PageHeader title={item.name} description={item.inventoryCode} breadcrumbs={[{ label: 'Inventory', href: '/inventory' }, { label: item.name }]}
        actions={<Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/inventory/${item.id}/edit`)}>Edit</Button>} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ['Code', item.inventoryCode], ['Category', item.category],
              ['Quantity', `${item.quantity} ${item.unit}`],
              ['Condition', getItemConditionLabel(item.condition)],
              ['Status', getItemStatusLabel(item.status)],
              ['Location', item.location || '—'],
              ['Supplier', item.supplier || '—'],
              ['Acquisition Date', item.acquisitionDate ? formatDate(item.acquisitionDate) : '—'],
              ['Acquisition Cost', item.acquisitionCost ? formatCurrency(item.acquisitionCost) : '—'],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">{l}</span><span className="font-medium text-gray-900">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Movement History</CardTitle></CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No movements recorded.</p>
            ) : (
              <ul className="space-y-3">
                {movements.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 border-b border-gray-100 pb-3">
                    <History className="mt-0.5 h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium capitalize text-gray-900">{m.movementType}</p>
                      <p className="text-xs text-gray-500">{m.quantity} units · {formatDate(m.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}