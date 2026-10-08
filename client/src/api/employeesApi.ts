import type {
  Employee,
  EmployeeInput,
  EmployeeListParams,
  EmployeeOption,
  PaginatedResponse,
} from '../types/employee';
import { baseApi } from './baseApi';

// Any employee change can affect the filtered list and the active-only dropdown.
const employeeTags = [{ type: 'Employee' as const, id: 'LIST' }, 'EmployeeOptions' as const];

export const employeesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getEmployees: build.query<PaginatedResponse<Employee>, EmployeeListParams>({
      query: ({ search, status, page, pageSize }) => ({
        url: '/employees',
        params: { search: search || undefined, status, page, pageSize },
      }),
      providesTags: [{ type: 'Employee', id: 'LIST' }],
    }),

    // Active employees only, no paging. Used by the job assignment dropdown.
    getEmployeeOptions: build.query<EmployeeOption[], void>({
      query: () => ({ url: '/employees', params: { active: 'true' } }),
      providesTags: ['EmployeeOptions'],
    }),

    createEmployee: build.mutation<Employee, EmployeeInput>({
      query: (body) => ({ url: '/employees', method: 'POST', body }),
      invalidatesTags: employeeTags,
    }),

    updateEmployee: build.mutation<Employee, { id: number } & EmployeeInput>({
      query: ({ id, ...body }) => ({ url: `/employees/${id}`, method: 'PUT', body }),
      invalidatesTags: employeeTags,
    }),

    setEmployeeStatus: build.mutation<Employee, { id: number; isActive: boolean }>({
      query: ({ id, isActive }) => ({
        url: `/employees/${id}/status`,
        method: 'PATCH',
        body: { isActive },
      }),
      invalidatesTags: employeeTags,
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useGetEmployeeOptionsQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useSetEmployeeStatusMutation,
} = employeesApi;
