import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGetJobQuery } from '../../api/jobsApi';
import { FormAlert } from '../../components/FormField';
import Icon from '../../components/Icon';
import { formatDate } from '../../utils/format';
import CancelJobDialog from './CancelJobDialog';
import ChangeStatusDialog from './ChangeStatusDialog';
import { JobPriorityBadge, JobStatusBadge } from './JobBadges';
import JobHistoryTimeline from './JobHistoryTimeline';
import { canCancelJob, getNextStatuses, isJobLocked } from './jobConstants';

const actionButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background';
const cancelButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10';

const backLinkClass = 'inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline';

function BackToJobs() {
  return (
    <Link to="/jobs" className={backLinkClass}>
      <Icon name="chevronLeft" size={16} />
      Back to jobs
    </Link>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-text">{children}</dd>
    </div>
  );
}

const dash = <span className="text-text-muted">—</span>;

export default function JobDetailsPage() {
  const [dialog, setDialog] = useState<'status' | 'cancel' | null>(null);
  const { id } = useParams();
  const jobId = Number(id);
  const validId = Number.isInteger(jobId) && jobId > 0;

  const { data: job, error, isLoading, isError, refetch } = useGetJobQuery(jobId, { skip: !validId });

  const notFound = !validId || (isError && 'status' in error && error.status === 404);

  if (isLoading) {
    return (
      <p role="status" className="py-12 text-center text-sm text-text-muted">
        Loading job…
      </p>
    );
  }

  if (notFound) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-text">Job not found</p>
        <p className="mt-1 mb-4 text-sm text-text-muted">It may have been removed, or the link is wrong.</p>
        <BackToJobs />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="py-12 text-center">
        <FormAlert message="Could not load this job." />
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-background"
        >
          Try again
        </button>
      </div>
    );
  }

  const locked = isJobLocked(job.status);
  const nextStatuses = getNextStatuses(job.status);

  return (
    <section>
      <div className="mb-4">
        <BackToJobs />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text">{job.jobNo}</h1>
          <JobStatusBadge status={job.status} />
        </div>
        {!locked && (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {nextStatuses.length > 0 && (
              <button type="button" onClick={() => setDialog('status')} className={actionButtonClass}>
                Change Status
              </button>
            )}
            {canCancelJob(job.status) && (
              <button
                type="button"
                onClick={() => setDialog('cancel')}
                className={cancelButtonClass}
              >
                Cancel Job
              </button>
            )}
            <Link
              to={`/jobs/${job.id}/edit`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              <Icon name="edit" size={16} />
              Edit Job
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <Field label="Job No">{job.jobNo}</Field>
          <Field label="Status">
            <JobStatusBadge status={job.status} />
          </Field>
          <Field label="Customer">{job.customerName}</Field>
          <Field label="Product">{job.product}</Field>
          <Field label="Quantity">{job.quantity.toLocaleString('en-US')}</Field>
          <Field label="Priority">
            <JobPriorityBadge priority={job.priority} />
          </Field>
          <Field label="Assigned To">
            {job.assignedEmployee ? (
              <>
                {job.assignedEmployee.name}
                {!job.assignedEmployee.isActive && <span className="text-text-muted"> (inactive)</span>}
              </>
            ) : (
              dash
            )}
          </Field>
          <Field label="Start Date">{job.startDate ? formatDate(job.startDate) : dash}</Field>
          <Field label="Due Date">{formatDate(job.dueDate)}</Field>
        </dl>

        <div className="mt-5 border-t border-border pt-5">
          <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Notes</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-text">{job.notes ?? dash}</dd>
        </div>
      </div>

      <JobHistoryTimeline jobId={job.id} />

      {dialog === 'status' && !locked && <ChangeStatusDialog job={job} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && !locked && <CancelJobDialog job={job} onClose={() => setDialog(null)} />}
    </section>
  );
}
