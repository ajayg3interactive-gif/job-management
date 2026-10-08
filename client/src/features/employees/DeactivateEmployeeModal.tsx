import Modal from '../../components/Modal';
import type { Employee } from '../../types/employee';

interface DeactivateEmployeeModalProps {
  employee: Employee;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeactivateEmployeeModal({
  employee,
  isLoading,
  onConfirm,
  onClose,
}: DeactivateEmployeeModalProps) {
  return (
    <Modal title="Deactivate employee?" onClose={onClose}>
      <p className="text-sm text-text">
        <span className="font-semibold">{employee.name}</span> will no longer appear in the job
        assignment list.
      </p>
      <p className="mt-2 text-sm text-text-muted">
        Jobs already assigned to them keep their assignment. You can activate them again at any time.
      </p>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Deactivating…' : 'Deactivate'}
        </button>
      </div>
    </Modal>
  );
}
