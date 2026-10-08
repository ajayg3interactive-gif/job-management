import type { PaginatedResponse } from '../types/employee';
import type { Job, JobHistoryEntry, JobListParams, JobPayload, JobStatus } from '../types/job';
import { baseApi } from './baseApi';

export const jobsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getJobs: build.query<PaginatedResponse<Job>, JobListParams>({
      query: ({ search, status, priority, employeeId, page, pageSize }) => ({
        url: '/jobs',
        params: { search: search || undefined, status, priority, employeeId, page, pageSize },
      }),
      providesTags: [{ type: 'Job', id: 'LIST' }],
    }),

    getJob: build.query<Job, number>({
      query: (id) => `/jobs/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Job', id }],
    }),

    createJob: build.mutation<Job, JobPayload>({
      query: (body) => ({ url: '/jobs', method: 'POST', body }),
      invalidatesTags: [{ type: 'Job', id: 'LIST' }, { type: 'Dashboard' }],
    }),

    updateJob: build.mutation<Job, { id: number } & JobPayload>({
      query: ({ id, ...body }) => ({ url: `/jobs/${id}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Job', id },
        { type: 'Job', id: 'LIST' },
        { type: 'Dashboard' },
      ],
    }),

    getJobHistory: build.query<JobHistoryEntry[], number>({
      query: (id) => `/jobs/${id}/history`,
      providesTags: (_result, _error, id) => [{ type: 'JobHistory', id }],
    }),

    // A status change touches the job, its history, the job lists and the dashboard counts.
    changeJobStatus: build.mutation<Job, { id: number; status: JobStatus }>({
      query: ({ id, status }) => ({ url: `/jobs/${id}/status`, method: 'POST', body: { status } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Job', id },
        { type: 'Job', id: 'LIST' },
        { type: 'JobHistory', id },
        { type: 'Dashboard' },
      ],
    }),
  }),
});

export const {
  useGetJobsQuery,
  useGetJobQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useGetJobHistoryQuery,
  useChangeJobStatusMutation,
} = jobsApi;
