import type { PaginatedResponse } from '../types/employee';
import type { Job, JobListParams, JobPayload } from '../types/job';
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
      invalidatesTags: [{ type: 'Job', id: 'LIST' }],
    }),

    updateJob: build.mutation<Job, { id: number } & JobPayload>({
      query: ({ id, ...body }) => ({ url: `/jobs/${id}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Job', id },
        { type: 'Job', id: 'LIST' },
      ],
    }),
  }),
});

export const { useGetJobsQuery, useGetJobQuery, useCreateJobMutation, useUpdateJobMutation } = jobsApi;
