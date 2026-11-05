'use client';

import React, { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNavigationProgress, setShowNavigationProgress] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const navigationDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasRouteAccess = !(
    (pathname.startsWith('/fees') && user?.role === 'assistant_headmaster') ||
    (pathname.startsWith('/users') && user?.role !== 'owner')
  );

  useEffect(() => {
    if (navigationDelay.current) clearTimeout(navigationDelay.current);
    if (navigationTimeout.current) clearTimeout(navigationTimeout.current);

    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!isLoading && isAuthenticated && !hasRouteAccess) {
      router.replace('/dashboard');
    }
  }, [hasRouteAccess, isAuthenticated, isLoading, pathname, router]);

  const handleNavigationClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.pathname === pathname) return;

    if (navigationDelay.current) clearTimeout(navigationDelay.current);
    if (navigationTimeout.current) clearTimeout(navigationTimeout.current);
    setPendingDestination(destination.pathname);
    setShowNavigationProgress(false);
    navigationDelay.current = setTimeout(() => setShowNavigationProgress(true), 120);
    navigationTimeout.current = setTimeout(() => {
      setPendingDestination(null);
      setShowNavigationProgress(false);
    }, 10000);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasRouteAccess) return null;

  return (
    <div
      className="flex h-screen h-[100dvh] overflow-hidden bg-gray-50"
      onClickCapture={handleNavigationClick}
    >
      {showNavigationProgress && pendingDestination !== pathname && (
        <div className="app-route-progress" role="progressbar" aria-label="Loading page" />
      )}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMoreClick={() => setSidebarOpen(true)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}