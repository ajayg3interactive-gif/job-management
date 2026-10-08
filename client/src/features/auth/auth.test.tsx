import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { API, server } from '../../test/server';
import { renderApp } from '../../test/renderApp';

const USER = { id: 1, name: 'Admin', email: 'admin@example.com' };

const unauthenticated = () =>
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required', details: [] } },
      { status: 401 },
    ),
  );

const authenticated = () => http.get(`${API}/auth/me`, () => HttpResponse.json({ user: USER }));

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email Address'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign In' }));
  return user;
}

describe('login form', () => {
  it('shows field errors for an empty submit and sends no request', async () => {
    server.use(unauthenticated());
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Welcome Back' });
    await fillAndSubmit('', '');

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('toggles password visibility with the eye button', async () => {
    server.use(unauthenticated());
    renderApp('/login');

    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('shows an error for an invalid email format', async () => {
    server.use(unauthenticated());
    renderApp('/login');

    await screen.findByLabelText('Email Address');
    await fillAndSubmit('not-an-email', 'secret');

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('shows the server error message for wrong credentials', async () => {
    server.use(
      unauthenticated(),
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', details: [] } },
          { status: 401 },
        ),
      ),
    );
    renderApp('/login');

    await screen.findByLabelText('Email Address');
    await fillAndSubmit('admin@example.com', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByText('Welcome. The dashboard is coming soon.')).not.toBeInTheDocument();
  });

  it('maps backend field errors onto the matching input', async () => {
    server.use(
      unauthenticated(),
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ field: 'email', message: 'Email rejected by server' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderApp('/login');

    await screen.findByLabelText('Email Address');
    await fillAndSubmit('admin@example.com', 'secret');

    expect(await screen.findByText('Email rejected by server')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('aria-invalid', 'true');
  });

  it('signs in, sends rememberMe, and lands on the dashboard', async () => {
    let body: unknown;
    server.use(
      unauthenticated(),
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: USER });
      }),
    );
    renderApp('/login');

    await screen.findByLabelText('Email Address');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email Address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'Admin@123');
    await user.click(screen.getByLabelText('Remember me'));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(body).toEqual({ email: 'admin@example.com', password: 'Admin@123', rememberMe: true });
  });
});

describe('route protection', () => {
  it('redirects to /login when unauthenticated', async () => {
    server.use(unauthenticated());
    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('restores the session on load and shows the user', async () => {
    server.use(authenticated());
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('sends a signed in user away from /login', async () => {
    server.use(authenticated());
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('logs out and returns to the login page', async () => {
    server.use(authenticated(), http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })));
    renderApp('/');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('clears auth and redirects to /login when a request returns 401', async () => {
    server.use(authenticated(), http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 401 })));
    renderApp('/');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument());
  });
});
