'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, DollarSign, Receipt, FileText, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { dataService } from '@/lib/db';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils';
import { Invoice, Payment } from '@/types';

export default function FeesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [collected, setCollected] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [inv, pay, col, out] = await Promise.all([
        dataService.getInvoices(),
        dataService.getPayments(),
        dataService.getFeesCollected(),
        dataService.getOutstandingBalances(),
      ]);
      setInvoices(inv);
      setPayments(pay);
      setCollected(col);
      setOutstanding(out);
      setIsLoading(false);
    }
    load();
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'invoices', label: 'Invoices', count: invoices.length },
    { id: 'payments', label: 'Payments', count: payments.length },
    { id: 'debtors', label: 'Outstanding Debt' },
  ];

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const collectionRate = collected + outstanding > 0 ? Math.round((collected / (collected + outstanding)) * 100) : 0;

  return (
    <div>
      <PageHeader title="Fees & Payments" description="Manage fee structures, invoices, payments, and debt"
        actions={
          <>
            <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />} onClick={() => router.push('/fees/invoices/new')}>New Invoice</Button>
            <Button leftIcon={<Receipt className="h-4 w-4" />} onClick={() => router.push('/fees/payments/new')}>Record Payment</Button>
          </>
        } />

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Demo Data:</strong> Financial records are demonstration data. Connect to a secure backend for production financial posting.
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'overview' && (
        <Card><CardContent><p className="py-8 text-center text-sm text-gray-500">Select a tab to view detailed financial records.</p></CardContent></Card>
      )}

      {activeTab === 'invoices' && (
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No invoices created yet.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div><p className="font-medium text-gray-900">{inv.invoiceNumber}</p><p className="text-sm text-gray-500">Total: {formatCurrency(inv.totalAmount)}</p></div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(inv.outstandingBalance)}</p>
                      <p className="text-xs text-gray-500">Outstanding</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'payments' && (
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No payments recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div><p className="font-medium text-gray-900">{p.receiptNumber}</p><p className="text-sm text-gray-500 capitalize">{p.paymentMethod.replace('_', ' ')}</p></div>
                    <p className="font-medium text-green-600">{formatCurrency(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'debtors' && (
        <Card>
          <CardHeader><CardTitle>Outstanding Debt</CardTitle></CardHeader>
          <CardContent>
            <p className="py-8 text-center text-sm text-gray-500">
              Students with outstanding balances: {invoices.filter((i) => i.outstandingBalance > 0).length}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}