import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiError, authenticatedMe } from '../../test/handlers';
import { renderApp } from '../../test/renderApp';
import { API, server } from '../../test/server';
import type { Job, JobHistoryEntry, JobStatus } from '../../types/job';
import { canCancelJob, getNextStatuses } from './jobConstants';

const makeJob = (status: JobStatus): Job => ({
  id: 1,
  jobNo: 'JOB-001',
  customerName: 'ABC Timber',
  product: 'Standard Pallet',
  quantity: 120,
  priority: 'HIGH',
  status,
  assignedEmployee: { id: 1, name: 'Ann Lee', isActive: true },
  startDate: '2026-10-08',
  dueDate: '2026-10-12',
  notes: null,
  createdAt: '2026-10-08T06:00:00.000Z',
  updatedAt: '2026-10-08T06:00:00.000Z',
});

const ADMIN = { id: 1, name: 'Admin' };

const initialHistory: JobHistoryEntry[] = [
  { id: 1, oldStatus: null, newStatus: 'PENDING', changedBy: ADMIN, createdAt: '2026-10-08T06:00:00.000Z' },
];

// An in-memory backend: a status change updates the job and appends a history row,
// so the page can only show the new state if it refetched them.
function statusBackend(initial: JobStatus, failWith?: { status: number; code: string; message: string }) {
  let job = makeJob(initial);
  const history = [...initialHistory];
  const posts: unknown[] = [];

  const handlers = [
    http.get(`${API}/jobs/:id`, () => HttpResponse.json(job)),
    http.get(`${API}/jobs/:id/history`, () => HttpResponse.json(history)),
    http.post(`${API}/jobs/:id/status`, async ({ request }) => {
      const body = (await request.json()) as { status: JobStatus };
      posts.push(body);
      if (failWith) return apiError(failWith.status, failWith.code, failWith.message);
      history.push({
        id: history.length + 1,
        oldStatus: job.status,
        newStatus: body.status,
        changedBy: ADMIN,
        createdAt: '2026-10-08T09:10:00.000Z',
      });
      job = { ...job, status: body.status };
      return HttpResponse.json(job);
    }),
  ];

  return { handlers, posts };
}

const openDetails = async (initial: JobStatus, failWith?: Parameters<typeof statusBackend>[1]) => {
  const backend = statusBackend(initial, failWith);
  server.use(authenticatedMe(), ...backend.handlers);
  renderApp('/jobs/1');
  await screen.findByRole('heading', { name: 'JOB-001' });
  return backend;
};

describe('transition rules used by the UI', () => {
  it('offers only the valid next statuses', () => {
    expect(getNextStatuses('PENDING')).toEqual(['IN_PRODUCTION']);
    expect(getNextStatuses('IN_PRODUCTION')).toEqual(['READY_FOR_DISPATCH']);
    expect(getNextStatuses('READY_FOR_DISPATCH')).toEqual(['COMPLETED']);
    expect(getNextStatuses('COMPLETED')).toEqual([]);
    expect(getNextStatuses('CANCELLED')).toEqual([]);
  });

  it('allows cancelling Pending jobs only', () => {
    expect(canCancelJob('PENDING')).toBe(true);
    for (const status of ['IN_PRODUCTION', 'READY_FOR_DISPATCH', 'COMPLETED', 'CANCELLED'] as const) {
      expect(canCancelJob(status)).toBe(false);
    }
  });
});

describe('status actions on the job details page', () => {
  it('shows Change Status and Cancel Job for a Pending job', async () => {
    await openDetails('PENDING');

    expect(screen.getByRole('button', { name: 'Change Status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Job' })).toBeInTheDocument();
  });

  it.each(['IN_PRODUCTION', 'READY_FOR_DISPATCH'] as const)(
    'shows Change Status but no Cancel Job for %s',
    async (status) => {
      await openDetails(status);

      expect(screen.getByRole('button', { name: 'Change Status' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel Job' })).not.toBeInTheDocument();
    },
  );

  it.each(['COMPLETED', 'CANCELLED'] as const)('shows no status actions or edit for %s', async (status) => {
    await openDetails(status);

    expect(screen.queryByRole('button', { name: 'Change Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Job' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Edit Job/ })).not.toBeInTheDocument();
  });

  it('lists only the valid next status in the dialog', async () => {
    await openDetails('PENDING');
    await userEvent.click(screen.getByRole('button', { name: 'Change Status' }));

    const dialog = await screen.findByRole('dialog', { name: 'Change Status' });
    const options = within(dialog).getAllByRole('radio');
    expect(options).toHaveLength(1);
    expect(within(dialog).getByRole('radio', { name: 'In Production' })).toBeChecked();
    expect(within(dialog).queryByRole('radio', { name: 'Cancelled' })).not.toBeInTheDocument();
  });

  it('changes the status and refreshes the badge and the history', async () => {
    const backend = await openDetails('PENDING');
    await userEvent.click(screen.getByRole('button', { name: 'Change Status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change Status' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change Status' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(backend.posts).toEqual([{ status: 'IN_PRODUCTION' }]);

    // The history list was refetched, so the new row appears.
    expect(await screen.findByText('Changed by Admin')).toBeInTheDocument();
    const dd = screen.getByText('Status', { selector: 'dt' }).nextElementSibling as HTMLElement;
    await waitFor(() => expect(dd).toHaveTextContent('In Production'));
  });

  it('shows the server message and keeps the dialog open when the change is rejected', async () => {
    await openDetails('PENDING', {
      status: 409,
      code: 'INVALID_TRANSITION',
      message: 'Cannot change status from Pending to In Production',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Change Status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change Status' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change Status' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Cannot change status from Pending to In Production',
    );
  });

  it('asks for confirmation before cancelling, and Keep Job sends nothing', async () => {
    const backend = await openDetails('PENDING');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Job' }));

    const dialog = await screen.findByRole('dialog', { name: 'Cancel Job' });
    expect(backend.posts).toEqual([]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep Job' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.posts).toEqual([]);
  });

  it('cancels the job on confirm and then locks the page', async () => {
    const backend = await openDetails('PENDING');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Job' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel Job' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel Job' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(backend.posts).toEqual([{ status: 'CANCELLED' }]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Change Status' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('link', { name: /Edit Job/ })).not.toBeInTheDocument();
  });

  it('shows the server message when the job was locked meanwhile (422)', async () => {
    await openDetails('PENDING', {
      status: 422,
      code: 'JOB_LOCKED',
      message: 'This job is Cancelled and can no longer be changed',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Job' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel Job' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel Job' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('can no longer be changed');
  });
});

describe('status history timeline', () => {
  it('shows the creation row as "Created by" with date and time', async () => {
    await openDetails('PENDING');

    const heading = await screen.findByRole('heading', { name: 'Status History' });
    const card = heading.parentElement as HTMLElement;
    expect(await within(card).findByText('Created by Admin')).toBeInTheDocument();
    expect(within(card).getByText(/08 Oct 2026 - \d{2}:\d{2} (AM|PM)/)).toBeInTheDocument();
  });

  it('shows an error with Try again when the history cannot be loaded', async () => {
    server.use(
      authenticatedMe(),
      http.get(`${API}/jobs/:id`, () => HttpResponse.json(makeJob('PENDING'))),
      http.get(`${API}/jobs/:id/history`, () => apiError(500, 'INTERNAL_ERROR', 'Boom')),
    );
    renderApp('/jobs/1');

    expect(await screen.findByText('Could not load the status history.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
