export type EmployeeStatusFilter = 'active' | 'inactive';

export interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Returned by GET /employees?active=true for the job assignment dropdown.
export interface EmployeeOption {
  id: number;
  name: string;
}

// Returned by GET /employees?all=true for the job list filter (includes inactive employees).
export interface EmployeeFilterOption extends EmployeeOption {
  isActive: boolean;
}

export interface EmployeeListParams {
  search?: string;
  status?: EmployeeStatusFilter;
  page: number;
  pageSize: number;
}

export interface EmployeeInput {
  name: string;
  email: string;
  phone: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
