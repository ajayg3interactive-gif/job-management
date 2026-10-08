import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGetDashboardQuery } from '../../api/dashboardApi';
import { FormAlert } from '../../components/FormField';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { DashboardCounts, DashboardRecentJob } from '../../types/dashboard';
import { JOB_STATUS, type JobStatus } from '../../types/job';
import { formatDate } from '../../utils/format';
import { JobStatusBadge } from '../jobs/JobBadges';
import { JOB_STATUS_LABELS, JOB_STATUSES } from '../jobs/jobConstants';

const secondaryButtonClass =
  'min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-background';

const cardClass = 'rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6';

// The counts object is keyed by camelCase names, the statuses by their enum values.
const COUNT_KEY: Record<JobStatus, keyof DashboardCounts> = {
  [JOB_STATUS.PENDING]: 'pending',
  [JOB_STATUS.IN_PRODUCTION]: 'inProduction',
  [JOB_STATUS.READY_FOR_DISPATCH]: 'readyForDispatch',
  [JOB_STATUS.COMPLETED]: 'completed',
  [JOB_STATUS.CANCELLED]: 'cancelled',
};

function OverdueBadge() {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-medium text-danger">
      Overdue
    </span>
  );
}

// Same gradient cycle as the Money-Management dashboard, built from the theme tokens only.
const CARD_GRADIENTS = [
  'from-primary to-accent',
  'from-secondary to-accent',
  'from-accent to-primary',
  'from-primary to-secondary',
] as const;

function StatusCard({ label, count, to, index }: { label: ReactNode; count: number; to: string; index: number }) {
  return (
    <Link
      to={to}
      className={`relative flex min-h-28 flex-col justify-between gap-3 overflow-hidden rounded-2xl bg-linear-to-br p-4 text-on-primary shadow-md transition-all duration-300 hover:-translate-y-0.5 sm:p-5 ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]}`}
    >
      <span aria-hidden className="absolute -top-4 -right-4 size-24 rounded-full bg-on-primary/10" />
      <span aria-hidden className="absolute right-4 -bottom-5 size-16 rounded-full bg-on-primary/5" />
      <span className="relative text-xs font-semibold tracking-wider text-on-primary/80 uppercase">{label}</span>
      <span className="relative text-3xl font-bold">{count.toLocaleString('en-US')}</span>
    </Link>
  );
}

function RecentJobs({ jobs }: { jobs: DashboardRecentJob[] }) {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (jobs.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm font-medium text-text">No jobs yet</p>
        <Link
          to="/jobs/new"
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          New Job
        </Link>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
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
              <p className="mt-2 text-xs text-text-muted">Due {formatDate(job.dueDate)}</p>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th scope="col" className="py-3 pr-4 font-medium">Job No</th>
            <th scope="col" className="py-3 pr-4 font-medium">Customer</th>
            <th scope="col" className="py-3 pr-4 font-medium">Status</th>
            <th scope="col" className="py-3 font-medium">Due Date</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
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
              <td className="py-3 pr-4">
                <JobStatusBadge status={job.status} />
              </td>
              <td className="py-3 text-text">{formatDate(job.dueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboardQuery();

  const renderBody = () => {
    if (isLoading) {
      return (
        <p role="status" className="py-12 text-center text-sm text-text-muted">
          Loading dashboard…
        </p>
      );
    }

    if (isError || !data) {
      return (
        <div className="py-12 text-center">
          <FormAlert message="Could not load the dashboard." />
          <button type="button" onClick={() => refetch()} className={secondaryButtonClass}>
            Try again
          </button>
        </div>
      );
    }

    const { counts, recentJobs, dueSoon } = data;

    return (
      <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          <StatusCard label="Total Jobs" count={counts.total} to="/jobs" index={0} />
          {JOB_STATUSES.map((status, i) => (
            <StatusCard
              key={status}
              index={i + 1}
              label={JOB_STATUS_LABELS[status]}
              count={counts[COUNT_KEY[status]]}
              to={`/jobs?status=${status}`}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={`${cardClass} lg:col-span-2`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-text">Recent Jobs</h2>
              <Link to="/jobs" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            <RecentJobs jobs={recentJobs} />
          </div>

          <div className={cardClass}>
            <h2 className="mb-1 text-lg font-bold text-text">Due Soon</h2>
            <p className="mb-4 text-xs text-text-muted">Open jobs due in the next 7 days, and overdue ones.</p>
            {dueSoon.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">No jobs are due soon.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {dueSoon.map((job) => (
                  <li key={job.id}>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="block min-h-11 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-primary">{job.jobNo}</span>
                        <span className="flex flex-wrap justify-end gap-1">
                          {job.isOverdue && <OverdueBadge />}
                          <JobStatusBadge status={job.status} />
                        </span>
                      </div>
                      <p className="mt-1 wrap-break-word text-sm text-text">{job.customerName}</p>
                      <p className="mt-1 text-xs text-text-muted">Due {formatDate(job.dueDate)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold text-text">Dashboard</h1>
      {renderBody()}
    </section>
  );
}
