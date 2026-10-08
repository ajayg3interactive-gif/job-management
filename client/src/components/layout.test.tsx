import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authenticatedMe } from '../test/handlers';
import { renderApp } from '../test/renderApp';
import { API, server } from '../test/server';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

const emptyEmployees = () =>
  http.get(`${API}/employees`, () => HttpResponse.json({ data: [], page: 1, pageSize: 10, total: 0 }));

describe('sidebar', () => {
  it('shows the app name, the navigation links and the signed in user', async () => {
    server.use(authenticatedMe());
    renderApp('/');

    const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' });
    expect(within(sidebar).getByText('Job Management')).toBeInTheDocument();
    expect(within(sidebar).getByText('Production Jobs')).toBeInTheDocument();

    const nav = within(sidebar).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Overview')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/employees');

    expect(within(sidebar).getByText('Admin')).toBeInTheDocument();
    expect(within(sidebar).getByText('admin@example.com')).toBeInTheDocument();
    expect(within(sidebar).getByText('A')).toBeInTheDocument(); // initials avatar
  });

  it('marks only the current page as active', async () => {
    server.use(authenticatedMe(), emptyEmployees());
    renderApp('/employees');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks Dashboard active on the home page only', async () => {
    server.use(authenticatedMe());
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Employees' })).not.toHaveAttribute('aria-current');
  });

  it('no longer shows the navigation in a top bar', async () => {
    server.use(authenticatedMe());
    renderApp('/');

    await screen.findByRole('complementary', { name: 'Sidebar' });
    // The only "Main" navigation lives inside the sidebar.
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });
});

describe('log out', () => {
  it('returns to the login page, and the next login starts at the dashboard', async () => {
    server.use(
      authenticatedMe(),
      emptyEmployees(),
      http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ user: { id: 1, name: 'Admin', email: 'admin@example.com' } }),
      ),
    );
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await user.type(await screen.findByLabelText('Email Address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'Admin@123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    // Not back on /employees: logging out forgets the page you were on.
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Employees' })).not.toBeInTheDocument();
  });
});

describe('theme toggle', () => {
  it('switches to dark, applies the dark class and remembers the choice', async () => {
    server.use(authenticatedMe());
    renderApp('/');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Switch to dark mode' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));

    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('starts in the saved theme', async () => {
    localStorage.setItem('theme', 'dark');
    server.use(authenticatedMe());
    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});

describe('mobile drawer', () => {
  it('opens from the hamburger button and closes from the overlay', async () => {
    server.use(authenticatedMe());
    renderApp('/');

    const user = userEvent.setup();
    const menuButton = await screen.findByRole('button', { name: 'Open menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument();

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('translate-x-0');

    await user.click(screen.getByTestId('sidebar-overlay'));
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('-translate-x-full');
  });

  it('closes with Escape', async () => {
    server.use(authenticatedMe());
    renderApp('/');

    const user = userEvent.setup();
    const menuButton = await screen.findByRole('button', { name: 'Open menu' });
    await user.click(menuButton);
    await user.keyboard('{Escape}');

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after choosing a link', async () => {
    server.use(authenticatedMe(), emptyEmployees());
    renderApp('/');

    const user = userEvent.setup();
    const menuButton = await screen.findByRole('button', { name: 'Open menu' });
    await user.click(menuButton);
    await user.click(screen.getByRole('link', { name: 'Employees' }));

    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });
});
