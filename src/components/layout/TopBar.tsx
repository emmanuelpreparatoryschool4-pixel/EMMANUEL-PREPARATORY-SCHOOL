'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentPageTitle = pathname === '/dashboard'
    ? 'Dashboard'
    : pathname.startsWith('/students')
      ? 'Students'
      : pathname.startsWith('/classes')
        ? 'Classes & Enrollment'
        : pathname.startsWith('/academics')
          ? 'Academics & Results'
          : pathname.startsWith('/fees')
            ? 'Fees & Payments'
            : pathname.startsWith('/reports')
              ? 'Reports'
              : pathname.startsWith('/statistics')
                ? 'School Statistics'
                : pathname.startsWith('/settings')
                  ? 'Settings'
                  : pathname.startsWith('/activity')
                    ? 'Activity History'
                    : 'School';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="lg:hidden">
          <h1 className="max-w-[52vw] truncate text-sm font-semibold text-gray-900 sm:text-base">
            {currentPageTitle}
          </h1>
          <p className="hidden text-xs text-gray-500 sm:block">E.P.S. School Management</p>
        </div>
        <div className="hidden lg:block">
          <h2 className="text-sm font-medium text-gray-500">
            Welcome back, <span className="text-gray-900">{user?.name}</span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
            aria-expanded={dropdownOpen}
            aria-label="Open profile menu"
          >
            <Avatar firstName={user?.name?.split(' ')[0]} lastName={user?.name?.split(' ')[1]} size="sm" />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.role === 'assistant_headmaster' ? 'Assistant Headmaster' : user?.role === 'headmaster' ? 'Headmaster' : 'Owner'}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2 sm:hidden">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.role === 'assistant_headmaster' ? 'Assistant Headmaster' : user?.role === 'headmaster' ? 'Headmaster' : 'Owner'}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4" />
                My Profile
              </Link>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}