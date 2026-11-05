'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, School, BarChart3, BookOpen,
  DollarSign, FileText, Settings, History, X, ChevronLeft, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePWAInstall } from '@/contexts/PWAInstallContext';
import { useToast } from '@/contexts/ToastContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'headmaster', 'assistant_headmaster'] },
  { label: 'Students', href: '/students', icon: Users, roles: ['owner', 'headmaster', 'assistant_headmaster'] },
  { label: 'Classes & Enrollment', href: '/classes', icon: School, roles: ['owner', 'headmaster', 'assistant_headmaster'] },
  { label: 'School Statistics', href: '/statistics', icon: BarChart3, roles: ['owner', 'headmaster', 'assistant_headmaster'] },
  { label: 'Academics & Results', href: '/academics', icon: BookOpen, roles: ['owner', 'headmaster', 'assistant_headmaster'] },
  { label: 'Fees & Payments', href: '/fees', icon: DollarSign, roles: ['owner', 'headmaster'] },
  { label: 'Reports', href: '/reports', icon: FileText, roles: ['owner', 'headmaster', 'assistant_headmaster'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['owner'] },
  { label: 'Activity History', href: '/activity', icon: History, roles: ['owner', 'headmaster', 'assistant_headmaster'] },
];

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isInstalled, installApp } = usePWAInstall();
  const { addToast } = useToast();

  const filteredItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const handleInstall = async () => {
    try {
      const outcome = await installApp();
      if (outcome === 'accepted') {
        addToast({ type: 'success', title: 'App installed', message: 'You can now open EPS from your device.' });
      } else if (outcome === 'dismissed') {
        addToast({ type: 'info', title: 'Install cancelled' });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not install the app',
        message: error instanceof Error ? error.message : 'Try installing from your browser menu.',
      });
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-gray-900 transition-all duration-300 lg:static',
          collapsed ? 'lg:w-[72px]' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
          {(!collapsed || isOpen) && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
                EPS
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-white">E.P.S.</p>
                <p className="text-[10px] text-gray-400">School Management</p>
              </div>
            </Link>
          )}
          {collapsed && !isOpen && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white">
              EPS
            </div>
          )}
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                      collapsed && !isOpen && 'justify-center px-2'
                    )}
                    title={collapsed && !isOpen ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {(!collapsed || isOpen) && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
            {!isInstalled && (
              <li>
                <button
                  onClick={() => void handleInstall()}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white',
                    collapsed && !isOpen && 'justify-center px-2'
                  )}
                  title={collapsed && !isOpen ? 'Install App' : undefined}
                >
                  <Download className="h-5 w-5 flex-shrink-0" />
                  {(!collapsed || isOpen) && <span>Install App</span>}
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-gray-800 p-3">
          <button
            onClick={onToggleCollapse}
            className={cn(
              'hidden min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 lg:flex',
              'hover:bg-gray-800 hover:text-white',
              collapsed && 'justify-center px-2'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={cn('h-5 w-5 transition-transform', collapsed && 'rotate-180')}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}