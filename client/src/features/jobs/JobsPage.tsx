import { Link, useNavigate } from 'react-router-dom';
import { useGetAllEmployeeOptionsQuery } from '../../api/employeesApi';
import { useGetJobsQuery } from '../../api/jobsApi';
import { FormAlert, fieldClass } from '../../components/FormField';
import Icon from '../../components/Icon';
import Pagination from '../../components/Pagination';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Job, JobPriority, JobStatus } from '../../types/job';
import { JobPriorityBadge, JobStatusBadge } from './JobBadges';
import {
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  JOBS_PAGE_SIZE,
} from './jobConstants';
import { useJobListParams } from './useJobListParams';

const primaryButtonClass =
  'inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90';
const secondaryButtonClass =
  'rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-background';

function AssignedTo({ job }: { job: Job }) {
  if (!job.assignedEmployee) return <span className="text-text-muted">—</span>;
  return (
    <>
      {job.assignedEmployee.name}
      {!job.assignedEmployee.isActive && <span className="text-text-muted"> (inactive)</span>}
    </>
  );
}

export default function JobsPage() {
  const navigate = useNavigate();
  const { search, status, priority, employeeId, page, update } = useJobListParams();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // The box updates instantly; the URL (and so the request) follows once typing pauses.
  const {
    input: searchInput,
    setInput: setSearchInput,
    reset: resetSearchInput,
  } = useDebouncedSearch(search, (value) => update({ search: value }));

  const { data, isLoading, isFetching, isError, refetch } = useGetJobsQuery({
    search,
    status,
    priority,
    employeeId,
    page,
    pageSize: JOBS_PAGE_SIZE,
  });
  const { data: employeeOptions } = useGetAllEmployeeOptionsQuery();

  const hasFilters = search !== '' || status !== undefined || priority !== undefined || employeeId !== undefined;

  const clearFilters = () => {
    resetSearchInput();
    update({ search: '', status: '', priority: '', employeeId: '' });
  };

  const renderResults = () => {
    if (isLoading) {
      return (
        <p role="status" className="py-12 text-center text-sm text-text-muted">
          Loading jobs…
        </p>
      );
    }

    if (isError || !data) {
      return (
        <div className="py-12 text-center">
          <FormAlert message="Could not load jobs." />
          <button type="button" onClick={() => refetch()} className={secondaryButtonClass}>
            Try again
          </button>
        </div>
      );
    }

    if (data.data.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-text">No jobs found</p>
          <p className="mt-1 text-sm text-text-muted">
            {hasFilters ? 'Try a different search or filter.' : 'Create your first job to get started.'}
          </p>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className={`mt-4 ${secondaryButtonClass}`}>
              Clear filters
            </button>
          )}
          {!hasFilters && page === 1 && (
            <Link to="/jobs/new" className={`mt-4 ${primaryButtonClass}`}>
              New Job
            </Link>
          )}
          {page > 1 && (
            <button type="button" onClick={() => update({ page: 1 })} className={`mt-4 ${secondaryButtonClass}`}>
              Go to first page
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <div className={isFetching ? 'opacity-60' : ''}>
          {isDesktop ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th scope="col" className="py-3 pr-4 font-medium">Job No</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Customer</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Assigned To</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Priority</th>
                    <th scope="col" className="py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((job) => (
                    <tr
                      key={job.id}
                      onClick={(event) => {
                        // A click on the job number link already navigates.
                        if ((event.target as HTMLElement).closest('a')) return;
                        navigate(`/jobs/${job.id}`);
                      }}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-background"
                    >
                      <td className="py-3 pr-4 font-semibold text-primary">
                        <Link to={`/jobs/${job.id}`} className="hover:underline">
                          {job.jobNo}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-text">{job.customerName}</td>
                      <td className="py-3 pr-4 text-text">
                        <AssignedTo job={job} />
                      </td>
                      <td className="py-3 pr-4">
                        <JobPriorityBadge priority={job.priority} />
                      </td>
                      <td className="py-3">
                        <JobStatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.data.map((job) => (
                <li key={job.id}>
                  <Link
                    to={`/jobs/${job.id}`}
                    className="block min-h-11 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-primary">{job.jobNo}</span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-text">{job.customerName}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-muted">
                      <span>
                        Assigned to: <AssignedTo job={job} />
                      </span>
                      <JobPriorityBadge priority={job.priority} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={(next) => update({ page: next })}
        />
      </>
    );
  };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">Jobs</h1>
        <Link to="/jobs/new" className={primaryButtonClass}>
          <Icon name="plus" size={18} />
          New Job
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
              <Icon name="search" size={18} />
            </div>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by job number or customer"
              aria-label="Search jobs"
              className={fieldClass(false)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={status ?? ''}
              onChange={(event) => update({ status: event.target.value as JobStatus | '' })}
              aria-label="Filter by status"
              className={fieldClass(false, { icon: false })}
            >
              <option value="">All statuses</option>
              {JOB_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {JOB_STATUS_LABELS[value]}
                </option>
              ))}
            </select>

            <select
              value={priority ?? ''}
              onChange={(event) => update({ priority: event.target.value as JobPriority | '' })}
              aria-label="Filter by priority"
              className={fieldClass(false, { icon: false })}
            >
              <option value="">All priorities</option>
              {JOB_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {JOB_PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>

            <select
              value={employeeId !== undefined ? String(employeeId) : ''}
              onChange={(event) => update({ employeeId: event.target.value })}
              aria-label="Filter by assigned employee"
              className={fieldClass(false, { icon: false })}
            >
              <option value="">All employees</option>
              {employeeOptions?.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <div>
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 text-sm font-medium text-primary hover:underline sm:min-h-0"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {renderResults()}
      </div>
    </section>
  );
}
