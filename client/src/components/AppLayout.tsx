import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Icon from './Icon';
import Sidebar from './Sidebar';

export default function AppLayout() {
  // Mobile drawer state. On desktop (md and up) the sidebar is always visible.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      {isSidebarOpen && (
        <div
          data-testid="sidebar-overlay"
          className="fixed inset-0 z-40 bg-overlay md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((open) => !open)}
            aria-label="Open menu"
            aria-controls="app-sidebar"
            aria-expanded={isSidebarOpen}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-text/5"
          >
            <Icon name="menu" size={22} />
          </button>
          <p className="text-sm font-semibold text-text">Job Management</p>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
