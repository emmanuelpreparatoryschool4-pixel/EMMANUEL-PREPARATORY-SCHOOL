'use client';

import React from 'react';
import { ChevronUp, ChevronDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableColumn } from '@/types';

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (id: string) => void;
  selectable?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  sortKey,
  sortDirection,
  onSort,
  isLoading,
  emptyMessage = 'No data found',
  emptyIcon,
  selectedIds,
  onSelectAll,
  onSelectRow,
  selectable = false,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && <th className="w-12 px-4 py-3" />}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {selectable && (
                  <td className="px-4 py-3">
                    <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white py-12">
        {emptyIcon || <Inbox className="h-12 w-12 text-gray-300" />}
        <p className="mt-3 text-sm font-medium text-gray-900">{emptyMessage}</p>
        <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {selectable && (
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={selectedIds?.size === data.length && data.length > 0}
                  onChange={onSelectAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500',
                  col.sortable && onSort && 'cursor-pointer select-none hover:text-gray-700',
                  col.className
                )}
                onClick={() => col.sortable && onSort && onSort(String(col.key))}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === String(col.key) && (
                    <span className="text-primary-600">
                      {sortDirection === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.map((item) => {
            const id = keyExtractor(item);
            return (
              <tr
                key={id}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-gray-50',
                  selectedIds?.has(id) && 'bg-primary-50'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {selectable && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={selectedIds?.has(id)}
                      onChange={() => onSelectRow?.(id)}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn('px-4 py-3 text-sm text-gray-700', col.className)}
                  >
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key as string] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}