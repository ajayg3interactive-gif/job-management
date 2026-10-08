import { NavLink, useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '../api/authApi';
import { useAppSelector } from '../app/hooks';
import { useTheme } from '../hooks/useTheme';
import Icon, { type IconName } from './Icon';

interface NavItem {
  label: string;
  to: string;
  icon: IconName;
  // Exact match, so "/" is not active on every page.
  end?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Items are added here as each page is built (Jobs comes with the jobs feature).
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: 'home', end: true },
      { label: 'Employees', to: '/employees', icon: 'user' },
    ],
  },
];

const initialsOf = (name: string | undefined) =>
  name
    ? name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
    isActive
      ? 'bg-primary/18 text-text before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-[3px] before:-translate-y-1/2 before:rounded-r-[3px] before:bg-linear-to-b before:from-primary before:to-accent'
      : 'text-text-muted hover:bg-text/5 hover:text-text'
  }`;

interface SidebarProps {
  // Mobile only: whether the drawer is open. On desktop the sidebar is always visible.
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAppSelector((state) => state.auth.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Clearing auth makes ProtectedRoute redirect to /login remembering this page. After a
  // deliberate logout the next login should start at the dashboard, so reset that state.
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 transform flex-col overflow-y-auto bg-surface transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:transition-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary to-accent text-on-primary">
          <Icon name="calendar" size={16} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-text">Job Management</p>
          <p className="text-[11px] leading-tight text-text-muted">Production Jobs</p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-text/5 hover:text-text"
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={16} />
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 px-3 py-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              {section.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} onClick={onClose} className={linkClass}>
                    <Icon name={item.icon} size={18} className="shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 pb-4 pt-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-accent text-[11px] font-bold text-on-primary"
          >
            {initialsOf(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-text">{user?.name ?? 'Guest'}</p>
            <p className="truncate text-[11px] text-text-muted">{user?.email ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-label="Log out"
            className="group relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text disabled:opacity-60"
          >
            <Icon name="logout" />
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 origin-bottom-right scale-95 whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-text opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
            >
              Log out
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
