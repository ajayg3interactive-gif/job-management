import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { clearAuth } from '../features/auth/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL}/api`,
  credentials: 'include',
});

// On a 401 the session is gone: clear auth state and drop cached server data.
// ProtectedRoute then redirects to /login. A failed login is also a 401, but
// that is a credentials error shown on the form, not an expired session.
const baseQueryWith401: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && api.endpoint !== 'login') {
    api.dispatch(clearAuth());
    api.dispatch(baseApi.util.resetApiState());
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWith401,
  // Employee: list pages. EmployeeOptions: the active-only dropdown used by the job form.
  tagTypes: ['Employee', 'EmployeeOptions'],
  endpoints: () => ({}),
});
