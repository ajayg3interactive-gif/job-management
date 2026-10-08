import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';
import { apiError, authenticatedMe } from '../../test/handlers';
import { API, server } from '../../test/server';
import type { Employee } from '../../types/employee';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 1,
  name: 'Ann Lee',
  email: 'ann@example.com',
  phone: '555 123 4567',
  isActive: true,
  createdAt: '2026-10-08T06:00:00.000Z',
  updatedAt: '2026-10-08T06:00:00.000Z',
  ...overrides,
});

// A tiny in-memory backend: lists, creates, updates and toggles employees.
function employeesBackend(initial: Employee[]) {
  const employees = [...initial];
  const listRequests: URLSearchParams[] = [];
  const calls: { method: string; url: string; body?: unknown }[] = [];

  const handlers = [
    http.get(`${API}/employees`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      listRequests.push(params);
      const pageSize = Number(params.get('pageSize') ?? 10);
      const page = Number(params.get('page') ?? 1);
      return HttpResponse.json({
        data: employees.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: employees.length,
      });
    }),
    http.post(`${API}/employees`, async ({ request }) => {
      const body = (await request.json()) as { name: string; email: string; phone: string };
      calls.push({ method: 'POST', url: '/employees', body });
      const created = makeEmployee({ id: employees.length + 100, ...body, phone: body.phone || null });
      employees.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put(`${API}/employees/:id`, async ({ request, params }) => {
      const body = (await request.json()) as { name: string; email: string; phone: string };
      calls.push({ method: 'PUT', url: `/employees/${params.id}`, body });
      const index = employees.findIndex((e) => e.id === Number(params.id));
      employees[index] = { ...employees[index], ...body, phone: body.phone || null };
      return HttpResponse.json(employees[index]);
    }),
    http.patch(`${API}/employees/:id/status`, async ({ request, params }) => {
      const body = (await request.json()) as { isActive: boolean };
      calls.push({ method: 'PATCH', url: `/employees/${params.id}/status`, body });
      const index = employees.findIndex((e) => e.id === Number(params.id));
      employees[index] = { ...employees[index], isActive: body.isActive };
      return HttpResponse.json(employees[index]);
    }),
  ];

  return { handlers, listRequests, calls };
}

const lastRequest = (requests: URLSearchParams[]) => requests[requests.length - 1];

describe('employees list states', () => {
  it('shows a loading state, then the employees with a dash for a missing phone', async () => {
    server.use(
      authenticatedMe(),
      http.get(`${API}/employees`, async () => {
        await delay(100);
        return HttpResponse.json({
          data: [makeEmployee(), makeEmployee({ id: 2, name: 'Bob Stone', email: 'bob@example.com', phone: null })],
          page: 1,
          pageSize: 10,
          total: 2,
        });
      }),
    );
    renderApp('/employees');

    expect(await screen.findByText('Loading employees…')).toBeInTheDocument();
    expect(await screen.findByText('Ann Lee')).toBeInTheDocument();
    expect(screen.getByText('Bob Stone')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('Active')).toHaveLength(2);
  });

  it('shows an empty state with a way to add the first employee', async () => {
    const backend = employeesBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    expect(await screen.findByText('No employees found')).toBeInTheDocument();
    expect(screen.getByText('Add your first employee to get started.')).toBeInTheDocument();
  });

  it('shows a filtered empty state and clears the filters', async () => {
    const backend = employeesBackend([]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees?search=zzz&status=inactive');

    expect(await screen.findByText('Try a different search or filter.')).toBeInTheDocument();
    expect(lastRequest(backend.listRequests).get('search')).toBe('zzz');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(lastRequest(backend.listRequests).get('search')).toBeNull());
    expect(lastRequest(backend.listRequests).get('status')).toBeNull();
    expect(screen.getByLabelText('Search employees')).toHaveValue('');
  });

  it('shows an error state and recovers with Try again', async () => {
    server.use(
      authenticatedMe(),
      http.get(`${API}/employees`, () => apiError(500, 'INTERNAL_ERROR', 'Internal server error')),
    );
    renderApp('/employees');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load employees.');

    const backend = employeesBackend([makeEmployee()]);
    server.use(...backend.handlers);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Ann Lee')).toBeInTheDocument();
  });
});

describe('employees filters and paging', () => {
  it('sends the search, status and page from the URL', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees?search=ann&status=active&page=2');

    await screen.findByLabelText('Search employees');
    await waitFor(() => expect(backend.listRequests.length).toBeGreaterThan(0));
    const first = backend.listRequests[0];
    expect(first.get('search')).toBe('ann');
    expect(first.get('status')).toBe('active');
    expect(first.get('page')).toBe('2');
    expect(first.get('pageSize')).toBe('10');
    expect(screen.getByLabelText('Search employees')).toHaveValue('ann');
    expect(screen.getByLabelText('Filter by status')).toHaveValue('active');
  });

  it('changing the status filter goes back to page 1', async () => {
    const backend = employeesBackend(Array.from({ length: 25 }, (_, i) => makeEmployee({ id: i + 1, name: `Person ${i + 1}`, email: `p${i}@example.com` })));
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees?page=2');

    await screen.findByText('Person 11');
    await userEvent.setup().selectOptions(screen.getByLabelText('Filter by status'), 'inactive');

    await waitFor(() => expect(lastRequest(backend.listRequests).get('status')).toBe('inactive'));
    expect(lastRequest(backend.listRequests).get('page')).toBe('1');
  });

  it('searches after typing pauses', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    await screen.findByText('Ann Lee');
    await userEvent.setup().type(screen.getByLabelText('Search employees'), 'bob');

    await waitFor(() => expect(lastRequest(backend.listRequests).get('search')).toBe('bob'));
    expect(lastRequest(backend.listRequests).get('page')).toBe('1');
  });

  it('pages through the results', async () => {
    const backend = employeesBackend(Array.from({ length: 25 }, (_, i) => makeEmployee({ id: i + 1, name: `Person ${i + 1}`, email: `p${i}@example.com` })));
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    expect(await screen.findByText('Showing 1–10 of 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();

    await userEvent.setup().click(screen.getByRole('button', { name: /Next/ }));

    expect(await screen.findByText('Showing 11–20 of 25')).toBeInTheDocument();
    expect(lastRequest(backend.listRequests).get('page')).toBe('2');
  });
});

describe('add and edit employee', () => {
  it('shows field errors for an empty form and sends nothing', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Employee' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Employee' });
    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }));

    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Email is required')).toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);
  });

  it('validates the email and phone formats', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Employee' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'New Person');
    await user.type(within(dialog).getByLabelText('Email'), 'not-an-email');
    await user.type(within(dialog).getByLabelText(/Phone/), '12ab');
    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }));

    expect(await within(dialog).findByText('Enter a valid email address')).toBeInTheDocument();
    expect(within(dialog).getByText('Phone must be 7 to 20 characters')).toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);
  });

  it('shows a duplicate email from the server on the email field and keeps the dialog open', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(
      authenticatedMe(),
      http.post(`${API}/employees`, () =>
        apiError(409, 'DUPLICATE_EMAIL', 'An employee with this email already exists', [
          { field: 'email', message: 'An employee with this email already exists' },
        ]),
      ),
      ...backend.handlers,
    );
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Employee' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Another Ann');
    await user.type(within(dialog).getByLabelText('Email'), 'ann@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }));

    expect(await within(dialog).findByText('An employee with this email already exists')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('creates an employee, closes the dialog and refreshes the list', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Employee' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), '  Zoe Park ');
    await user.type(within(dialog).getByLabelText('Email'), 'zoe@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }));

    expect(await screen.findByText('Zoe Park')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls).toEqual([
      { method: 'POST', url: '/employees', body: { name: 'Zoe Park', email: 'zoe@example.com', phone: '' } },
    ]);
  });

  it('edits an employee with the form pre-filled', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Ann Lee' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Employee' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Ann Lee');
    expect(within(dialog).getByLabelText('Email')).toHaveValue('ann@example.com');
    expect(within(dialog).getByLabelText(/Phone/)).toHaveValue('555 123 4567');

    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Ann Smith');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Ann Smith')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls).toEqual([
      {
        method: 'PUT',
        url: '/employees/1',
        body: { name: 'Ann Smith', email: 'ann@example.com', phone: '555 123 4567' },
      },
    ]);
  });

  it('closes the dialog with Escape and with Cancel without saving', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Employee' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit Ann Lee' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);
  });
});

describe('activate and deactivate', () => {
  it('asks for confirmation before deactivating, and cancel changes nothing', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Deactivate Ann Lee' }));

    const dialog = screen.getByRole('dialog', { name: 'Deactivate employee?' });
    expect(within(dialog).getByText(/keep their assignment/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);
    expect(within(screen.getByRole('table')).getByText('Active')).toBeInTheDocument();
  });

  it('deactivates after confirming and shows the new status', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Deactivate Ann Lee' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));

    expect(await within(screen.getByRole('table')).findByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls).toEqual([
      { method: 'PATCH', url: '/employees/1/status', body: { isActive: false } },
    ]);
    expect(screen.getByRole('button', { name: 'Activate Ann Lee' })).toBeInTheDocument();
  });

  it('activates straight away without a confirmation', async () => {
    const backend = employeesBackend([makeEmployee({ isActive: false })]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Activate Ann Lee' }));

    expect(await within(screen.getByRole('table')).findByText('Active')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls).toEqual([
      { method: 'PATCH', url: '/employees/1/status', body: { isActive: true } },
    ]);
  });

  it('shows the server error when a status change fails', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(
      authenticatedMe(),
      http.patch(`${API}/employees/:id/status`, () => apiError(404, 'NOT_FOUND', 'Employee not found')),
      ...backend.handlers,
    );
    renderApp('/employees');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Deactivate Ann Lee' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Employee not found');
  });
});

describe('navigation', () => {
  it('links to the employees page from the top bar', async () => {
    const backend = employeesBackend([makeEmployee()]);
    server.use(authenticatedMe(), ...backend.handlers);
    renderApp('/');

    await userEvent.setup().click(await screen.findByRole('link', { name: 'Employees' }));

    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
  });

  it('redirects to the login page when not signed in', async () => {
    server.use(http.get(`${API}/auth/me`, () => apiError(401, 'UNAUTHENTICATED', 'Authentication required')));
    renderApp('/employees');

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });
});
