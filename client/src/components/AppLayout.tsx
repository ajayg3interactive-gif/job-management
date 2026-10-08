import { Outlet } from 'react-router-dom';
import { useLogoutMutation } from '../api/authApi';
import { useAppSelector } from '../app/hooks';

export default function AppLayout() {
  const user = useAppSelector((state) => state.auth.user);
  const [logout, { isLoading }] = useLogoutMutation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-base font-semibold text-text">Job Management</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text">{user?.name}</span>
            <button
              type="button"
              onClick={() => logout()}
              disabled={isLoading}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-background disabled:opacity-60"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
