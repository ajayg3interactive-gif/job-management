import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { JOB_PRIORITY, JOB_STATUS, type JobPriority, type JobStatus } from '../../types/job';

const STATUS_VALUES: readonly string[] = Object.values(JOB_STATUS);
const PRIORITY_VALUES: readonly string[] = Object.values(JOB_PRIORITY);

const parseStatus = (value: string | null) =>
  value !== null && STATUS_VALUES.includes(value) ? (value as JobStatus) : undefined;

const parsePriority = (value: string | null) =>
  value !== null && PRIORITY_VALUES.includes(value) ? (value as JobPriority) : undefined;

const parsePositiveInt = (value: string | null) => {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number >= 1 ? number : undefined;
};

interface JobListChanges {
  search?: string;
  status?: JobStatus | '';
  priority?: JobPriority | '';
  // The employee id as a string, '' to clear.
  employeeId?: string;
  page?: number;
}

// Search, filters and page live in the URL, so the list is shareable and survives refresh.
export function useJobListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const status = parseStatus(searchParams.get('status'));
  const priority = parsePriority(searchParams.get('priority'));
  const employeeId = parsePositiveInt(searchParams.get('employeeId'));
  const page = parsePositiveInt(searchParams.get('page')) ?? 1;

  const update = useCallback(
    (changes: JobListChanges) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          const set = (key: string, value: string | undefined) => {
            if (value) next.set(key, value);
            else next.delete(key);
          };

          if (changes.search !== undefined) set('search', changes.search.trim());
          if (changes.status !== undefined) set('status', changes.status);
          if (changes.priority !== undefined) set('priority', changes.priority);
          if (changes.employeeId !== undefined) set('employeeId', changes.employeeId);
          // Page 1 is the default, so it stays out of the URL.
          if (changes.page !== undefined) set('page', changes.page > 1 ? String(changes.page) : '');

          // Any filter change goes back to the first page.
          const filterChanged =
            changes.search !== undefined ||
            changes.status !== undefined ||
            changes.priority !== undefined ||
            changes.employeeId !== undefined;
          if (changes.page === undefined && filterChanged) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { search, status, priority, employeeId, page, update };
}
