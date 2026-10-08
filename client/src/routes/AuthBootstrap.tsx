import { Outlet } from 'react-router-dom';
import { useGetMeQuery } from '../api/authApi';
import { useAppSelector } from '../app/hooks';

// Restores the session via GET /auth/me before any route renders, so a refresh
// does not flash the login page. The query is skipped once the answer is known.
export default function AuthBootstrap() {
  const status = useAppSelector((state) => state.auth.status);
  useGetMeQuery(undefined, { skip: status !== 'unknown' });

  if (status === 'unknown') {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }

  return <Outlet />;
}
