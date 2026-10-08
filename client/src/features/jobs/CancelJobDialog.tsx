import { useChangeJobStatusMutation } from '../../api/jobsApi';
import { parseApiError } from '../../api/errors';
import { FormAlert } from '../../components/FormField';
import Modal from '../../components/Modal';
import { JOB_STATUS, type Job } from '../../types/job';

const secondaryButtonClass =
  'min-h-11 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background';

interface CancelJobDialogProps {
  job: Job;
  onClose: () => void;
}

export default function CancelJobDialog({ job, onClose }: CancelJobDialogProps) {
  const [changeStatus, { isLoading, error }] = useChangeJobStatusMutation();

  const confirm = async () => {
    try {
      await changeStatus({ id: job.id, status: JOB_STATUS.CANCELLED }).unwrap();
      onClose();
    } catch {
      // The error is shown from the mutation state below.
    }
  };

  return (
    <Modal title="Cancel Job" onClose={onClose}>
      {error && <FormAlert message={parseApiError(error).message} />}

      <p className="mb-6 text-sm text-text">
        Cancel <span className="font-semibold">{job.jobNo}</span>? A cancelled job is locked and can no
        longer be edited or moved to another status.
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          Keep Job
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={isLoading}
          className="min-h-11 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? 'Cancelling…' : 'Cancel Job'}
        </button>
      </div>
    </Modal>
  );
}
