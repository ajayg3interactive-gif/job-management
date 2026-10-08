import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiError, authenticatedMe } from '../../test/handlers';
import { renderApp } from '../../test/renderApp';
import { API, server } from '../../test/server';
import type { Dashboard } from '../../types/dashboard';

const makeDashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  counts: { total: 9, pending: 3, inProduction: 2, readyForDispatch: 1, completed: 1, cancelled: 2 },
  recentJobs: [
    { id: 7, jobNo: 'JOB-007', customerName: 'Newest Co', status: 'PENDING', dueDate: '2026-10-12' },
    { id: 6, jobNo: 'JOB-006', customerName: 'Older Co', status: 'IN_PRODUCTION', dueDate: '2026-10-20' },
  ],
  dueSoon: [
    {
      id: 3,
      jobNo: 'JOB-003',
      customerName: 'Late Ltd',
      status: 'IN_PRODUCTION',
      priority: 'HIGH',
      dueDate: '2026-10-01',
      isOverdue: true,
    },
    {
      id: 4,
      jobNo: 'JOB-004',
      customerName: 'Soon Inc',
      status: 'PENDING',
      priority: 'NORMAL',
      dueDate: '2026-10-10',
      isOverdue: false,
    },
  ],
  ...overrides,
});

const open = async (dashboard: Dashboard = makeDashboard()) => {
  server.use(authenticatedMe(), http.get(`${API}/dashboard`, () => HttpResponse.json(dashboard)));
  renderApp('/');
  await screen.findByRole('heading', { name: 'Recent Jobs' });
};

const card = (label: string) => screen.getByRole('link', { name: new RegExp(`^${label}`) });

describe('dashboard status cards', () => {
  it('shows Total plus every status count', async () => {
    await open();

    expect(card('Total Jobs')).toHaveTextContent('9');
    expect(card('Pending')).toHaveTextContent('3');
    expect(card('In Production')).toHaveTextContent('2');
    expect(card('Ready for Dispatch')).toHaveTextContent('1');
    expect(card('Completed')).toHaveTextContent('1');
    expect(card('Cancelled')).toHaveTextContent('2');
  });

  it('links each card to the job list filtered by that status', async () => {
    await open();

    expect(card('Total Jobs')).toHaveAttribute('href', '/jobs');
    expect(card('Pending')).toHaveAttribute('href', '/jobs?status=PENDING');
    expect(card('In Production')).toHaveAttribute('href', '/jobs?status=IN_PRODUCTION');
    expect(card('Ready for Dispatch')).toHaveAttribute('href', '/jobs?status=READY_FOR_DISPATCH');
    expect(card('Completed')).toHaveAttribute('href', '/jobs?status=COMPLETED');
    expect(card('Cancelled')).toHaveAttribute('href', '/jobs?status=CANCELLED');
  });

  it('opens the job list with the status filter applied when a card is clicked', async () => {
    server.use(
      http.get(`${API}/jobs`, () => HttpResponse.json({ data: [], page: 1, pageSize: 10, total: 0 })),
      http.get(`${API}/employees`, () => HttpResponse.json([])),
    );
    await open();
    await userEvent.click(card('In Production'));

    const select = await screen.findByLabelText('Filter by status');
    expect(select).toHaveValue('IN_PRODUCTION');
  });
});

describe('dashboard recent jobs', () => {
  it('lists the jobs with status and a formatted due date', async () => {
    await open();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Job No',
      'Customer',
      'Status',
      'Due Date',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('JOB-007');
    expect(rows[0]).toHaveTextContent('Newest Co');
    expect(rows[0]).toHaveTextContent('Pending');
    expect(rows[0]).toHaveTextContent('12 Oct 2026');
    expect(rows[1]).toHaveTextContent('JOB-006');
  });

  it('opens the job when a row is clicked', async () => {
    server.use(
      http.get(`${API}/jobs/:id`, () => apiError(404, 'NOT_FOUND', 'Job not found')),
      http.get(`${API}/jobs/:id/history`, () => HttpResponse.json([])),
    );
    await open();
    await userEvent.click(screen.getByText('Older Co'));

    expect(await screen.findByText('Job not found')).toBeInTheDocument();
  });

  it('shows an empty state with a New Job link when there are no jobs', async () => {
    await open(
      makeDashboard({
        counts: { total: 0, pending: 0, inProduction: 0, readyForDispatch: 0, completed: 0, cancelled: 0 },
        recentJobs: [],
        dueSoon: [],
      }),
    );

    expect(screen.getByText('No jobs yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New Job' })).toHaveAttribute('href', '/jobs/new');
    expect(card('Total Jobs')).toHaveTextContent('0');
  });
});

describe('dashboard due soon', () => {
  it('marks overdue jobs with an Overdue badge and not the upcoming ones', async () => {
    await open();

    const heading = screen.getByRole('heading', { name: 'Due Soon' });
    const panel = heading.parentElement as HTMLElement;
    const late = within(panel).getByRole('link', { name: /JOB-003/ });
    const soon = within(panel).getByRole('link', { name: /JOB-004/ });

    expect(late).toHaveTextContent('Overdue');
    expect(late).toHaveTextContent('Due 01 Oct 2026');
    expect(soon).not.toHaveTextContent('Overdue');
    expect(soon).toHaveTextContent('Due 10 Oct 2026');
    expect(within(panel).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/jobs/3', '/jobs/4']);
  });

  it('shows an empty message when nothing is due soon', async () => {
    await open(makeDashboard({ dueSoon: [] }));

    expect(screen.getByText('No jobs are due soon.')).toBeInTheDocument();
  });
});

describe('dashboard loading and error states', () => {
  it('shows a loading state first', async () => {
    server.use(
      authenticatedMe(),
      http.get(`${API}/dashboard`, async () => {
        await delay(100);
        return HttpResponse.json(makeDashboard());
      }),
    );
    renderApp('/');

    expect(await screen.findByText('Loading dashboard…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Recent Jobs' })).toBeInTheDocument();
  });

  it('shows an error state and recovers with Try again', async () => {
    let fail = true;
    server.use(
      authenticatedMe(),
      http.get(`${API}/dashboard`, () =>
        fail ? apiError(500, 'INTERNAL_ERROR', 'Boom') : HttpResponse.json(makeDashboard()),
      ),
    );
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the dashboard.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Recent Jobs' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('dashboard on a phone', () => {
  it('shows recent jobs as cards instead of a table', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      await open();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /JOB-007/ })).toHaveAttribute('href', '/jobs/7');
    } finally {
      window.matchMedia = original;
    }
  });
});
