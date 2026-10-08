import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EmployeeStatusFilter } from '../../types/employee';

export const EMPLOYEES_PAGE_SIZE = 10;

const parseStatus = (value: string | null): EmployeeStatusFilter | undefined =>
  value === 'active' || value === 'inactive' ? value : undefined;

const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

// Search, status filter and page live in the URL, so the list is shareable and survives refresh.
export function useEmployeeListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const status = parseStatus(searchParams.get('status'));
  const page = parsePage(searchParams.get('page'));

  const update = useCallback(
    (changes: { search?: string; status?: EmployeeStatusFilter | ''; page?: number }) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          const set = (key: string, value: string | undefined) => {
            if (value) next.set(key, value);
            else next.delete(key);
          };

          if (changes.search !== undefined) set('search', changes.search.trim());
          if (changes.status !== undefined) set('status', changes.status);
          // Page 1 is the default, so it stays out of the URL.
          if (changes.page !== undefined) set('page', changes.page > 1 ? String(changes.page) : '');
          // Any filter change goes back to the first page.
          if (changes.page === undefined && (changes.search !== undefined || changes.status !== undefined)) {
            next.delete('page');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { search, status, page, update };
}
