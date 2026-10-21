'use client';

import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { dataService } from '@/lib/db';
import { ActivityLog } from '@/types';
import { getRelativeTime, formatDateTime } from '@/lib/utils';

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dataService.getActivityLogs().then((l) => { setLogs(l); setIsLoading(false); });
  }, []);

  return (
    <div>
      <PageHeader title="Activity History" description="Track all system activities and changes" />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-gray-200" />
      ) : logs.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="System activities will appear here." />
      ) : (
        <Card>
          <ul className="divide-y divide-gray-100">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start gap-4 px-5 py-4">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  {log.userName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{log.userName}</span> {log.action}
                  </p>
                  {log.details && <p className="mt-0.5 text-sm text-gray-500">{log.details}</p>}
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>{getRelativeTime(log.timestamp)}</span>
                    <span>·</span>
                    <span>{formatDateTime(log.timestamp)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}