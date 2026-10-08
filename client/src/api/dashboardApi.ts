import type { Dashboard } from '../types/dashboard';
import { baseApi } from './baseApi';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Invalidated by job status changes (see changeJobStatus in jobsApi).
    getDashboard: build.query<Dashboard, void>({
      query: () => '/dashboard',
      providesTags: [{ type: 'Dashboard' }],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
