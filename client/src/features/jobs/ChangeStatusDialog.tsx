import { useState } from 'react';
import { useChangeJobStatusMutation } from '../../api/jobsApi';
import { parseApiError } from '../../api/errors';
import { FormAlert } from '../../components/FormField';
import Modal from '../../components/Modal';
import type { Job, JobStatus } from '../../types/job';
import { JobStatusBadge } from './JobBadges';
import { getNextStatuses, JOB_STATUS_LABELS } from './jobConstants';

interface ChangeStatusDialogProps {
  job: Job;
  onClose: () => void;
}

const secondaryButtonClass =
  'min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background';

// Offers only the valid next statuses. Cancelling is a separate action.
export default function ChangeStatusDialog({ job, onClose }: ChangeStatusDialogProps) {
  const options = getNextStatuses(job.status);
  const [selected, setSelected] = useState<JobStatus | undefined>(options[0]);
  const [changeStatus, { isLoading, error }] = useChangeJobStatusMutation();

  const submit = async () => {
    if (!selected) return;
    try {
      await changeStatus({ id: job.id, status: selected }).unwrap();
      onClose();
    } catch {
      // The error is shown from the mutation state below.
    }
  };

  return (
    <Modal title="Change Status" onClose={onClose}>
      {error && <FormAlert message={parseApiError(error).message} />}

      <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-text-muted">
        Current status <JobStatusBadge status={job.status} />
      </p>

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-medium text-text">Move to</legend>
        <div className="space-y-2">
          {options.map((status) => (
            <label
              key={status}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm text-text has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="next-status"
                value={status}
                checked={selected === status}
                onChange={() => setSelected(status)}
                className="accent-primary"
              />
              {JOB_STATUS_LABELS[status]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          Close
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!selected || isLoading}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? 'Saving…' : 'Change Status'}
        </button>
      </div>
    </Modal>
  );
}
