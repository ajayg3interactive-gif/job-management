import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, authenticatedMe } from '../../test/handlers';
import { renderApp } from '../../test/renderApp';
import { API, server } from '../../test/server';
import type { Job } from '../../types/job';

const ANN = { id: 1, name: 'Ann Lee', isActive: true };
const IAN = { id: 3, name: 'Ian Gone', isActive: false };

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 1,
  jobNo: 'JOB-001',
  customerName: 'ABC Timber',
  product: 'Standard Pallet',
  quantity: 120,
  priority: 'HIGH',
  status: 'PENDING',
  assignedEmployee: ANN,
  startDate: '2026-10-08',
  dueDate: '2026-10-12',
  notes: 'Customer requested urgent delivery.',
  createdAt: '2026-10-08T06:00:00.000Z',
  updatedAt: '2026-10-08T06:00:00.000Z',
  ...overrides,
});

// A tiny in-memory backend for jobs and the employee dropdowns.
function jobsBackend(initial: Job[]) {
  const jobs = [...initial];
  const listRequests: URLSearchParams[] = [];
  const calls: { method: string; url: string; body?: unknown }[] = [];

  const handlers = [
    http.get(`${API}/jobs`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      listRequests.push(params);
      const pageSize = Number(params.get('pageSize') ?? 10);
      const page = Number(params.get('page') ?? 1);
      return HttpResponse.json({
        data: jobs.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: jobs.length,
      });
    }),
    http.get(`${API}/jobs/:id`, ({ params }) => {
      const job = jobs.find((j) => j.id === Number(params.id));
      return job ? HttpResponse.json(job) : apiError(404, 'NOT_FOUND', 'Job not found');
    }),
    http.post(`${API}/jobs`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({ method: 'POST', url: '/jobs', body });
      const created = makeJob({
        id: 100 + jobs.length,
        jobNo: `JOB-${String(jobs.length + 1).padStart(3, '0')}`,
        customerName: String(body.customerName),
        quantity: Number(body.quantity),
        assignedEmployee: null,
      });
      jobs.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put(`${API}/jobs/:id`, async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({ method: 'PUT', url: `/jobs/${params.id}`, body });
      const index = jobs.findIndex((j) => j.id === Number(params.id));
      jobs[index] = { ...jobs[index], customerName: String(body.customerName) };
      return HttpResponse.json(jobs[index]);
    }),
    http.get(`${API}/employees`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (params.get('all') === 'true') return HttpResponse.json([ANN, { id: 2, name: 'Bo Chan', isActive: true }, IAN]);
      return HttpResponse.json([
        { id: 1, name: 'Ann Lee' },
        { id: 2, name: 'Bo Chan' },
      ]);
    }),
  ];

  return { handlers, listRequests, calls };
}

// The <dd> next to a details label such as "Due Date".
const fieldValue = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

const lastRequest = (requests: URLSearchParams[]) => requests[requests.length - 1];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('jobs list', () => {
  const twoJobs = () => [
    makeJob(),
    makeJob({
      id: 2,
      jobNo: 'JOB-002',
      customerName: 'Beta Industries',
      priority: 'URGENT',
      status: 'IN_PRODUCTION',
      assignedEmployee: null,
    }),
  ];

  it('shows the jobs with assignee, priority and status, and a dash when unassigned', async () => {
    const backend = jobsBackend(twoJobs());
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs');

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'JOB-001' })).toHaveAttribute('href', '/jobs/1');
    expect(within(table).getByText('ABC Timber')).toBeInTheDocument();
    expect(within(table).getByText('Ann Lee')).toBeInTheDocument();
    expect(within(table).getByText('High')).toBeInTheDocument();
    expect(within(table).getByText('Pending')).toBeInTheDocument();
    expect(within(table).getByText('Beta Industries')).toBeInTheDocument();
    expect(within(table).getByText('Urgent')).toBeInTheDocument();
    expect(within(table).getByText('In Production')).toBeInTheDocument();
    expect(within(table).getByText('—')).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Job No',
      'Customer',
      'Assigned To',
      'Priority',
      'Status',
    ]);
  });

  it('marks an inactive assignee', async () => {
    const backend = jobsBackend([makeJob({ assignedEmployee: IAN })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs');

    const table = await screen.findByRole('table');
    expect(within(table).getByText('(inactive)')).toBeInTheDocument();
  });

  it('shows a loading state first', async () => {
    server.use(
      authenticatedMe(),
      http.get(`${API}/jobs`, async () => {
        await delay(100);
        return HttpResponse.json({ data: [makeJob()], page: 1, pageSize: 10, total: 1 });
      }),
      ...jobsBackend([]).handlers,
    );
    renderApp('/jobs');

    expect(await screen.findByText('Loading jobs…')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows an empty state with a link to create the first job', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs');

    expect(await screen.findByText('No jobs found')).toBeInTheDocument();
    expect(screen.getByText('Create your first job to get started.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /New Job/ }).every((l) => l.getAttribute('href') === '/jobs/new')).toBe(true);
  });

  it('shows a filtered empty state and clears every filter', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs?search=zzz&status=COMPLETED&priority=LOW&employeeId=1');

    expect(await screen.findByText('Try a different search or filter.')).toBeInTheDocument();
    const first = backend.listRequests[0];
    expect(first.get('search')).toBe('zzz');
    expect(first.get('status')).toBe('COMPLETED');
    expect(first.get('priority')).toBe('LOW');
    expect(first.get('employeeId')).toBe('1');

    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);

    await waitFor(() => expect(lastRequest(backend.listRequests).get('search')).toBeNull());
    const cleared = lastRequest(backend.listRequests);
    expect(cleared.get('status')).toBeNull();
    expect(cleared.get('priority')).toBeNull();
    expect(cleared.get('employeeId')).toBeNull();
    expect(screen.getByLabelText('Search jobs')).toHaveValue('');
  });

  it('shows an error state and recovers with Try again', async () => {
    server.use(
      authenticatedMe(),
      http.get(`${API}/jobs`, () => apiError(500, 'INTERNAL_ERROR', 'Internal server error')),
      ...jobsBackend([]).handlers,
    );
    renderApp('/jobs');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load jobs.');

    server.use(...jobsBackend([makeJob()]).handlers);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('ABC Timber')).toBeInTheDocument();
  });

  describe('search, filters and paging', () => {
    it('reads search, filters and page from the URL', async () => {
      const backend = jobsBackend(twoJobs());
      server.use(authenticatedMe(), ...backend.handlers);
      renderApp('/jobs?search=abc&status=PENDING&priority=HIGH&employeeId=1&page=2');

      await screen.findByLabelText('Search jobs');
      await waitFor(() => expect(backend.listRequests.length).toBeGreaterThan(0));
      const first = backend.listRequests[0];
      expect(first.get('search')).toBe('abc');
      expect(first.get('status')).toBe('PENDING');
      expect(first.get('priority')).toBe('HIGH');
      expect(first.get('employeeId')).toBe('1');
      expect(first.get('page')).toBe('2');
      expect(first.get('pageSize')).toBe('10');
      expect(screen.getByLabelText('Search jobs')).toHaveValue('abc');
      expect(screen.getByLabelText('Filter by status')).toHaveValue('PENDING');
      expect(screen.getByLabelText('Filter by priority')).toHaveValue('HIGH');
      await waitFor(() => expect(screen.getByLabelText('Filter by assigned employee')).toHaveValue('1'));
    });

    it('ignores invalid filter values in the URL', async () => {
      const backend = jobsBackend(twoJobs());
      server.use(authenticatedMe(), ...backend.handlers);
      renderApp('/jobs?status=DONE&priority=EXTREME&employeeId=abc&page=-3');

      await screen.findByRole('table');
      const first = backend.listRequests[0];
      expect(first.get('status')).toBeNull();
      expect(first.get('priority')).toBeNull();
      expect(first.get('employeeId')).toBeNull();
      expect(first.get('page')).toBe('1');
    });

    it('filters by status, priority and employee, offering inactive employees too', async () => {
      const backend = jobsBackend(twoJobs());
      server.use(authenticatedMe(), ...backend.handlers);
      renderApp('/jobs');

      const user = userEvent.setup();
      await screen.findByRole('table');

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'IN_PRODUCTION');
      await waitFor(() => expect(lastRequest(backend.listRequests).get('status')).toBe('IN_PRODUCTION'));

      await user.selectOptions(screen.getByLabelText('Filter by priority'), 'URGENT');
      await waitFor(() => expect(lastRequest(backend.listRequests).get('priority')).toBe('URGENT'));

      const employeeSelect = screen.getByLabelText('Filter by assigned employee');
      await within(employeeSelect).findByRole('option', { name: 'Ian Gone (inactive)' });
      await user.selectOptions(employeeSelect, 'Ian Gone (inactive)');
      await waitFor(() => expect(lastRequest(backend.listRequests).get('employeeId')).toBe('3'));

      const request = lastRequest(backend.listRequests);
      expect(request.get('status')).toBe('IN_PRODUCTION');
      expect(request.get('priority')).toBe('URGENT');
    });

    it('goes back to page 1 when a filter changes', async () => {
      const many = Array.from({ length: 25 }, (_, i) => makeJob({ id: i + 1, jobNo: `JOB-${String(i + 1).padStart(3, '0')}` }));
      const backend = jobsBackend(many);
      server.use(authenticatedMe(), ...backend.handlers);
      renderApp('/jobs?page=2');

      await screen.findByText('JOB-011');
      await userEvent.setup().selectOptions(screen.getByLabelText('Filter by priority'), 'LOW');

      await waitFor(() => expect(lastRequest(backend.listRequests).get('priority')).toBe('LOW'));
      expect(lastRequest(backend.listRequests).get('page')).toBe('1');
    });

    it('searches after typing pauses', async () => {
      const backend = jobsBackend(twoJobs());
      server.use(authenticatedMe(), ...backend.handlers);
      renderApp('/jobs');

      await screen.findByRole('table');
      await userEvent.setup().type(screen.getByLabelText('Search jobs'), 'beta');

      await waitFor(() => expect(lastRequest(backend.listRequests).get('search')).toBe('beta'));
    });

    it('pages through the results', async () => {
      const many = Array.from({ length: 25 }, (_, i) => makeJob({ id: i + 1, jobNo: `JOB-${String(i + 1).padStart(3, '0')}` }));
      const backend = jobsBackend(many);
      server.use(authenticatedMe(), ...backend.handlers);
      renderApp('/jobs');

      expect(await screen.findByText('Showing 1–10 of 25')).toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole('button', { name: /Next/ }));

      expect(await screen.findByText('Showing 11–20 of 25')).toBeInTheDocument();
      expect(lastRequest(backend.listRequests).get('page')).toBe('2');
    });
  });

  it('opens the details page when a row is clicked', async () => {
    const backend = jobsBackend(twoJobs());
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs');

    const table = await screen.findByRole('table');
    await userEvent.setup().click(within(table).getByText('Beta Industries'));

    expect(await screen.findByRole('heading', { name: 'JOB-002' })).toBeInTheDocument();
  });

  it('shows cards instead of a table on small screens', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const backend = jobsBackend(twoJobs());
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs');

    const card = await screen.findByRole('link', { name: /JOB-001/ });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(card).toHaveAttribute('href', '/jobs/1');
    expect(within(card).getByText('ABC Timber')).toBeInTheDocument();
    expect(within(card).getByText('Pending')).toBeInTheDocument();
    expect(within(card).getByText('High')).toBeInTheDocument();
    expect(card).toHaveTextContent('Assigned to: Ann Lee');
  });

  it('links to the new job form', async () => {
    const backend = jobsBackend(twoJobs());
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs');

    await userEvent.setup().click(await screen.findByRole('link', { name: /New Job/ }));

    expect(await screen.findByRole('heading', { name: 'New Job' })).toBeInTheDocument();
  });
});

describe('new job form', () => {
  const fillValid = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(await screen.findByLabelText('Customer Name'), 'Zoe Co');
    await user.type(screen.getByLabelText('Product'), 'Box');
    await user.type(screen.getByLabelText('Quantity'), '5');
    await user.selectOptions(screen.getByLabelText('Priority'), 'LOW');
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-11-01' } });
  };

  it('shows field errors for an empty form and sends nothing', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/new');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Create Job' }));

    expect(await screen.findByText('Customer name is required')).toBeInTheDocument();
    expect(screen.getByText('Product is required')).toBeInTheDocument();
    expect(screen.getByText('Quantity is required')).toBeInTheDocument();
    expect(screen.getByText('Priority is required')).toBeInTheDocument();
    expect(screen.getByText('Due date is required')).toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);
  });

  it.each([
    ['0', 'Quantity must be greater than 0'],
    ['-4', 'Quantity must be greater than 0'],
    ['1.5', 'Quantity must be a whole number'],
    ['1000001', 'Quantity must be at most 1,000,000'],
  ])('rejects the quantity %s', async (quantity, message) => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/new');

    const user = userEvent.setup();
    await fillValid(user);
    await user.clear(screen.getByLabelText('Quantity'));
    await user.type(screen.getByLabelText('Quantity'), quantity);
    await user.click(screen.getByRole('button', { name: 'Create Job' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);
  });

  it('rejects a due date before the start date but accepts equal dates', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/new');

    const user = userEvent.setup();
    await fillValid(user);
    fireEvent.change(screen.getByLabelText(/Start Date/), { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('button', { name: 'Create Job' }));

    expect(await screen.findByText('Due date cannot be before the start date')).toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(/Start Date/), { target: { value: '2026-11-01' } });
    await user.click(screen.getByRole('button', { name: 'Create Job' }));

    await waitFor(() => expect(backend.calls).toHaveLength(1));
  });

  it('offers only active employees plus Unassigned', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/new');

    const select = await screen.findByLabelText(/Assigned Employee/);
    await within(select).findByRole('option', { name: 'Ann Lee' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Unassigned', 'Ann Lee', 'Bo Chan']);
    expect(select).toHaveValue('');
  });

  it('creates the job, sends a clean payload and opens its details', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/new');

    const user = userEvent.setup();
    await fillValid(user);
    await within(screen.getByLabelText(/Assigned Employee/)).findByRole('option', { name: 'Ann Lee' });
    await user.selectOptions(screen.getByLabelText(/Assigned Employee/), 'Ann Lee');
    await user.click(screen.getByRole('button', { name: 'Create Job' }));

    expect(await screen.findByRole('heading', { name: 'JOB-001' })).toBeInTheDocument();
    expect(backend.calls).toEqual([
      {
        method: 'POST',
        url: '/jobs',
        body: {
          customerName: 'Zoe Co',
          product: 'Box',
          quantity: 5,
          priority: 'LOW',
          assignedEmployeeId: 1,
          startDate: null,
          dueDate: '2026-11-01',
          notes: null,
        },
      },
    ]);
  });

  it('shows a server field error next to the right input', async () => {
    const backend = jobsBackend([]);
    server.use(
      authenticatedMe(),
      http.post(`${API}/jobs`, () =>
        apiError(400, 'VALIDATION_ERROR', 'Validation failed', [
          { field: 'assignedEmployeeId', message: 'Assigned employee is inactive' },
        ]),
      ),
      ...backend.handlers,
    );
    renderApp('/jobs/new');

    const user = userEvent.setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create Job' }));

    expect(await screen.findByText('Assigned employee is inactive')).toBeInTheDocument();
    expect(screen.getByLabelText(/Assigned Employee/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: 'New Job' })).toBeInTheDocument();
  });

  it('shows a general server error above the form', async () => {
    const backend = jobsBackend([]);
    server.use(
      authenticatedMe(),
      http.post(`${API}/jobs`, () => apiError(500, 'INTERNAL_ERROR', 'Internal server error')),
      ...backend.handlers,
    );
    renderApp('/jobs/new');

    const user = userEvent.setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create Job' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });
});

describe('edit job form', () => {
  it('is pre-filled with the job', async () => {
    const backend = jobsBackend([makeJob()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1/edit');

    expect(await screen.findByRole('heading', { name: 'Edit JOB-001' })).toBeInTheDocument();
    expect(screen.getByLabelText('Customer Name')).toHaveValue('ABC Timber');
    expect(screen.getByLabelText('Product')).toHaveValue('Standard Pallet');
    expect(screen.getByLabelText('Quantity')).toHaveValue(120);
    expect(screen.getByLabelText('Priority')).toHaveValue('HIGH');
    expect(screen.getByLabelText(/Start Date/)).toHaveValue('2026-10-08');
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-10-12');
    expect(screen.getByLabelText(/Notes/)).toHaveValue('Customer requested urgent delivery.');
    await waitFor(() => expect(screen.getByLabelText(/Assigned Employee/)).toHaveValue('1'));
  });

  it('keeps a deactivated assignee selected and labelled inactive', async () => {
    const backend = jobsBackend([makeJob({ assignedEmployee: IAN })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1/edit');

    const select = await screen.findByLabelText(/Assigned Employee/);
    await within(select).findByRole('option', { name: 'Ann Lee' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Unassigned',
      'Ann Lee',
      'Bo Chan',
      'Ian Gone (inactive)',
    ]);
    expect(select).toHaveValue('3');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(backend.calls).toHaveLength(1));
    expect((backend.calls[0].body as { assignedEmployeeId: number }).assignedEmployeeId).toBe(3);
  });

  it('saves the changes and returns to the details page', async () => {
    const backend = jobsBackend([makeJob()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1/edit');

    const user = userEvent.setup();
    const customer = await screen.findByLabelText('Customer Name');
    await user.clear(customer);
    await user.type(customer, 'ABC Timber Ltd');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('heading', { name: 'JOB-001' })).toBeInTheDocument();
    expect(await screen.findByText('ABC Timber Ltd')).toBeInTheDocument();
    expect(backend.calls[0]).toMatchObject({ method: 'PUT', url: '/jobs/1' });
    expect(backend.calls[0].body).toMatchObject({
      customerName: 'ABC Timber Ltd',
      quantity: 120,
      priority: 'HIGH',
      dueDate: '2026-10-12',
    });
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)('does not show the form for a %s job', async (status) => {
    const backend = jobsBackend([makeJob({ status })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1/edit');

    expect(await screen.findByText('JOB-001 can no longer be edited')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to job/ })).toHaveAttribute('href', '/jobs/1');
  });

  it('shows the server message when the job was locked meanwhile (422)', async () => {
    const backend = jobsBackend([makeJob()]);
    server.use(
      authenticatedMe(),
      http.put(`${API}/jobs/:id`, () => apiError(422, 'JOB_LOCKED', 'This job is Completed and can no longer be changed')),
      ...backend.handlers,
    );
    renderApp('/jobs/1/edit');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This job is Completed and can no longer be changed');
  });

  it('shows a not found state for an unknown job', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/99/edit');

    expect(await screen.findByText('Job not found')).toBeInTheDocument();
  });
});

describe('job details', () => {
  it('shows every field with dates formatted like 08 Oct 2026', async () => {
    const backend = jobsBackend([makeJob()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1');

    expect(await screen.findByRole('heading', { name: 'JOB-001' })).toBeInTheDocument();
    const value = fieldValue;

    expect(value('Customer')).toHaveTextContent('ABC Timber');
    expect(value('Product')).toHaveTextContent('Standard Pallet');
    expect(value('Quantity')).toHaveTextContent('120');
    expect(value('Priority')).toHaveTextContent('High');
    expect(value('Status')).toHaveTextContent('Pending');
    expect(value('Assigned To')).toHaveTextContent('Ann Lee');
    expect(value('Start Date')).toHaveTextContent('08 Oct 2026');
    expect(value('Due Date')).toHaveTextContent('12 Oct 2026');
    expect(screen.getByText('Customer requested urgent delivery.')).toBeInTheDocument();
  });

  it('shows dashes for missing optional values', async () => {
    const backend = jobsBackend([makeJob({ assignedEmployee: null, startDate: null, notes: null })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1');

    await screen.findByRole('heading', { name: 'JOB-001' });
    const value = fieldValue;
    expect(value('Assigned To')).toHaveTextContent('—');
    expect(value('Start Date')).toHaveTextContent('—');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3); // including notes
  });

  it('marks an inactive assignee', async () => {
    const backend = jobsBackend([makeJob({ assignedEmployee: IAN })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1');

    expect(await screen.findByText('(inactive)')).toBeInTheDocument();
  });

  it.each(['PENDING', 'IN_PRODUCTION', 'READY_FOR_DISPATCH'] as const)('shows Edit Job for a %s job', async (status) => {
    const backend = jobsBackend([makeJob({ status })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1');

    expect(await screen.findByRole('link', { name: 'Edit Job' })).toHaveAttribute('href', '/jobs/1/edit');
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)('hides Edit Job for a locked %s job', async (status) => {
    const backend = jobsBackend([makeJob({ status })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1');

    await screen.findByRole('heading', { name: 'JOB-001' });
    expect(screen.queryByRole('link', { name: 'Edit Job' })).not.toBeInTheDocument();
  });

  it('opens the edit form from Edit Job', async () => {
    const backend = jobsBackend([makeJob()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1');

    await userEvent.setup().click(await screen.findByRole('link', { name: 'Edit Job' }));

    expect(await screen.findByRole('heading', { name: 'Edit JOB-001' })).toBeInTheDocument();
  });

  it('shows a not found state for an unknown or invalid job', async () => {
    const backend = jobsBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/99');

    expect(await screen.findByText('Job not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to jobs/ })).toHaveAttribute('href', '/jobs');
  });

  it('shows an error state with Try again when the request fails', async () => {
    server.use(
      authenticatedMe(),
      http.get(`${API}/jobs/:id`, () => apiError(500, 'INTERNAL_ERROR', 'Internal server error')),
      ...jobsBackend([]).handlers,
    );
    renderApp('/jobs/1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this job.');

    server.use(...jobsBackend([makeJob()]).handlers);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'JOB-001' })).toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('has a Jobs link in the sidebar that opens the list', async () => {
    const backend = jobsBackend([makeJob()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    await userEvent.setup().click(within(nav).getByRole('link', { name: 'Jobs' }));

    expect(await screen.findByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Jobs active on a job details page', async () => {
    const backend = jobsBackend([makeJob()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/jobs/1');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page');
  });
});
