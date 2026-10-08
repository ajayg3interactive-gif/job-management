import type { JobPriority, JobStatus } from '../../types/job';
import {
  JOB_PRIORITY_BADGE_CLASSES,
  JOB_PRIORITY_LABELS,
  JOB_STATUS_BADGE_CLASSES,
  JOB_STATUS_LABELS,
} from './jobConstants';

const baseClass = 'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium';

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={`${baseClass} ${JOB_STATUS_BADGE_CLASSES[status]}`}>{JOB_STATUS_LABELS[status]}</span>;
}

export function JobPriorityBadge({ priority }: { priority: JobPriority }) {
  return (
    <span className={`${baseClass} ${JOB_PRIORITY_BADGE_CLASSES[priority]}`}>
      {JOB_PRIORITY_LABELS[priority]}
    </span>
  );
}
