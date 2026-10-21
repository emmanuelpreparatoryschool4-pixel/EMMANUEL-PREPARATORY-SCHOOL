import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amountInPesewas: number): string {
  const amount = amountInPesewas / 100;
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amountInPesewas: number): string {
  const amount = amountInPesewas / 100;
  if (amount >= 1000000) {
    return `GH₵${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `GH₵${(amount / 1000).toFixed(1)}K`;
  }
  return `GH₵${amount.toFixed(2)}`;
}

export function parseCurrencyToPesewas(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateLong(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GH', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(dateString);
}

export function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function calculateYearsBetween(startDate: string, endDate?: string): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateStudentId(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `EPS${year}${random}`;
}

export function generateAdmissionNumber(): string {
  const year = new Date().getFullYear().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ADM/${year}/${random}`;
}

export function generateStaffId(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `STF${year}${random}`;
}

export function generateReceiptNumber(): string {
  const year = new Date().getFullYear().toString();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `RCP/${year}/${random}`;
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear().toString();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `INV/${year}/${random}`;
}

export function generateInventoryCode(): string {
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${random}`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getFullName(firstName: string, lastName: string, otherNames?: string): string {
  return [firstName, otherNames, lastName].filter(Boolean).join(' ');
}

export function getGenderLabel(gender: string): string {
  return gender === 'male' ? 'Male' : 'Female';
}

export function getEnrollmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    transferred: 'Transferred',
    withdrawn: 'Withdrawn',
    graduated: 'Graduated',
    archived: 'Archived',
  };
  return labels[status] || status;
}

export function getStaffCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    teacher: 'Teacher',
    headteacher: 'Headteacher',
    administrator: 'Administrator',
    cook: 'Cook',
    driver: 'Driver',
    other: 'Other',
  };
  return labels[category] || category;
}

export function getAttendanceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
    sick: 'Sick',
  };
  return labels[status] || status;
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    mobile_money: 'Mobile Money',
    cheque: 'Cheque',
    other: 'Other',
  };
  return labels[method] || method;
}

export function getItemConditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    new: 'New',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    damaged: 'Damaged',
  };
  return labels[condition] || condition;
}

export function getItemStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: 'Available',
    in_use: 'In Use',
    maintenance: 'Maintenance',
    disposed: 'Disposed',
    missing: 'Missing',
  };
  return labels[status] || status;
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 10) / 10;
}

export function sortByKey<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function filterBySearch<T extends Record<string, unknown>>(
  array: T[],
  search: string,
  keys: (keyof T)[]
): T[] {
  if (!search.trim()) return array;
  const searchLower = search.toLowerCase();
  return array.filter((item) =>
    keys.some((key) => {
      const value = item[key];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchLower);
      }
      return false;
    })
  );
}

export function paginate<T>(array: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return array.slice(start, start + pageSize);
}

export function downloadCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        const escaped = String(value ?? '').replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    ),
  ];
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    archived: 'bg-gray-100 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-800',
    issued: 'bg-blue-100 text-blue-800',
    partial: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-red-100 text-red-800',
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800',
    late: 'bg-yellow-100 text-yellow-800',
    excused: 'bg-blue-100 text-blue-800',
    sick: 'bg-purple-100 text-purple-800',
    synced: 'bg-green-100 text-green-800',
    local: 'bg-gray-100 text-gray-800',
    failed: 'bg-red-100 text-red-800',
    conflict: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}