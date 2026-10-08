import { useGetJobHistoryQuery } from '../../api/jobsApi';
import { formatTime, formatTimestampDate } from '../../utils/format';
import { JobStatusBadge } from './JobBadges';

// Oldest first. The first row is the creation row ("Created by"), later rows are changes.
export default function JobHistoryTimeline({ jobId }: { jobId: number }) {
  const { data: history, isLoading, isError, refetch } = useGetJobHistoryQuery(jobId);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-text">Status History</h2>

      {isLoading && (
        <p role="status" className="text-sm text-text-muted">
          Loading history…
        </p>
      )}

      {isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
          Could not load the status history.
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-11 rounded-xl border border-border px-4 py-2 font-semibold text-text hover:bg-background"
          >
            Try again
          </button>
        </div>
      )}

      {history && (
        <ol className="relative">
          {history.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
              {index < history.length - 1 && (
                <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-border" />
              )}
              <span aria-hidden className="relative mt-1.5 size-3 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <JobStatusBadge status={entry.newStatus} />
                <p className="mt-1 text-sm text-text">
                  {formatTimestampDate(entry.createdAt)} - {formatTime(entry.createdAt)}
                </p>
                <p className="text-sm text-text-muted">
                  {index === 0 ? 'Created by' : 'Changed by'} {entry.changedBy.name}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
