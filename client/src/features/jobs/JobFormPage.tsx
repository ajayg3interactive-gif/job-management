import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGetEmployeeOptionsQuery } from '../../api/employeesApi';
import { parseApiError } from '../../api/errors';
import { useCreateJobMutation, useGetJobQuery, useUpdateJobMutation } from '../../api/jobsApi';
import { FieldError, FormAlert, fieldClass, labelClass } from '../../components/FormField';
import Icon from '../../components/Icon';
import { jobSchema, toJobPayload, type JobFormValues } from '../../schemas/job';
import type { Job } from '../../types/job';
import { JOB_PRIORITIES, JOB_PRIORITY_LABELS, JOB_STATUS_LABELS, isJobLocked } from './jobConstants';

const FORM_FIELDS: ReadonlyArray<keyof JobFormValues> = [
  'customerName',
  'product',
  'quantity',
  'priority',
  'assignedEmployeeId',
  'startDate',
  'dueDate',
  'notes',
];

const isFormField = (field: string | undefined): field is keyof JobFormValues =>
  FORM_FIELDS.includes(field as keyof JobFormValues);

const backLinkClass = 'inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline';
const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background';

const emptyValues: JobFormValues = {
  customerName: '',
  product: '',
  quantity: '',
  priority: '',
  assignedEmployeeId: '',
  startDate: '',
  dueDate: '',
  notes: '',
};

const valuesFromJob = (job: Job): JobFormValues => ({
  customerName: job.customerName,
  product: job.product,
  quantity: String(job.quantity),
  priority: job.priority,
  assignedEmployeeId: job.assignedEmployee ? String(job.assignedEmployee.id) : '',
  startDate: job.startDate ?? '',
  dueDate: job.dueDate,
  notes: job.notes ?? '',
});

interface JobFormProps {
  // Present when editing, absent when creating.
  job?: Job;
}

function JobForm({ job }: JobFormProps) {
  const navigate = useNavigate();
  const isEdit = job !== undefined;
  const [createJob, { isLoading: isCreating }] = useCreateJobMutation();
  const [updateJob, { isLoading: isUpdating }] = useUpdateJobMutation();
  const { data: activeEmployees, isLoading: isLoadingEmployees, isError: employeesFailed } =
    useGetEmployeeOptionsQuery();
  const [formError, setFormError] = useState<string | null>(null);
  const isSaving = isCreating || isUpdating;
  const cancelTo = isEdit ? `/jobs/${job.id}` : '/jobs';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    mode: 'onTouched',
    defaultValues: job ? valuesFromJob(job) : emptyValues,
  });

  // Active employees, plus the current assignee even when they have since been deactivated, so
  // saving without changing them keeps working. The current assignee comes from the job itself,
  // so the select always has a matching option, even before the employee list has loaded.
  // No other inactive employee can be picked.
  const currentAssignee = job?.assignedEmployee ?? null;
  const assigneeOptions = [
    ...(currentAssignee
      ? [{ id: currentAssignee.id, name: currentAssignee.name, isActive: currentAssignee.isActive }]
      : []),
    ...(activeEmployees ?? [])
      .filter((employee) => employee.id !== currentAssignee?.id)
      .map((employee) => ({ ...employee, isActive: true })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const onSubmit = async (values: JobFormValues) => {
    setFormError(null);
    const payload = toJobPayload(values);
    const result = isEdit ? await updateJob({ id: job.id, ...payload }) : await createJob(payload);

    if (!('error' in result)) {
      navigate(`/jobs/${result.data.id}`);
      return;
    }

    // Show server errors next to the right input.
    const { message, details } = parseApiError(result.error);
    const fieldErrors = details.filter((detail) => isFormField(detail.field));
    fieldErrors.forEach((detail) => {
      setError(detail.field as keyof JobFormValues, { message: detail.message });
    });
    if (fieldErrors.length === 0) setFormError(message);
  };

  const describedBy = (field: keyof JobFormValues) => (errors[field] ? `job-${field}-error` : undefined);
  const invalid = (field: keyof JobFormValues) => (errors[field] ? 'true' : 'false');
  const errorFor = (field: keyof JobFormValues) =>
    errors[field]?.message && <FieldError id={`job-${field}-error`} message={errors[field].message} />;

  return (
    <section>
      <div className="mb-4">
        <Link to={cancelTo} className={backLinkClass}>
          <Icon name="chevronLeft" size={16} />
          {isEdit ? 'Back to job' : 'Back to jobs'}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-text">{isEdit ? `Edit ${job.jobNo}` : 'New Job'}</h1>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        {formError && <FormAlert message={formError} />}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div>
              <label htmlFor="job-customerName" className={labelClass}>
                Customer Name
              </label>
              <input
                id="job-customerName"
                type="text"
                autoComplete="off"
                aria-invalid={invalid('customerName')}
                aria-describedby={describedBy('customerName')}
                className={fieldClass(!!errors.customerName, { icon: false })}
                {...register('customerName')}
              />
              {errorFor('customerName')}
            </div>

            <div>
              <label htmlFor="job-product" className={labelClass}>
                Product
              </label>
              <input
                id="job-product"
                type="text"
                autoComplete="off"
                aria-invalid={invalid('product')}
                aria-describedby={describedBy('product')}
                className={fieldClass(!!errors.product, { icon: false })}
                {...register('product')}
              />
              {errorFor('product')}
            </div>

            <div>
              <label htmlFor="job-quantity" className={labelClass}>
                Quantity
              </label>
              <input
                id="job-quantity"
                type="number"
                inputMode="numeric"
                step={1}
                aria-invalid={invalid('quantity')}
                aria-describedby={describedBy('quantity')}
                className={fieldClass(!!errors.quantity, { icon: false })}
                {...register('quantity')}
              />
              {errorFor('quantity')}
            </div>

            <div>
              <label htmlFor="job-priority" className={labelClass}>
                Priority
              </label>
              <select
                id="job-priority"
                aria-invalid={invalid('priority')}
                aria-describedby={describedBy('priority')}
                className={fieldClass(!!errors.priority, { icon: false })}
                {...register('priority')}
              >
                <option value="">Select priority</option>
                {JOB_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {JOB_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
              {errorFor('priority')}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="job-assignedEmployeeId" className={labelClass}>
                Assigned Employee <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <select
                id="job-assignedEmployeeId"
                aria-invalid={invalid('assignedEmployeeId')}
                aria-describedby={describedBy('assignedEmployeeId')}
                className={fieldClass(!!errors.assignedEmployeeId, { icon: false })}
                {...register('assignedEmployeeId')}
              >
                <option value="">{isLoadingEmployees ? 'Loading employees…' : 'Unassigned'}</option>
                {assigneeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
              {employeesFailed && (
                <p className="mt-1.5 text-xs text-danger">Could not load employees. Reload the page to try again.</p>
              )}
              {errorFor('assignedEmployeeId')}
            </div>

            <div>
              <label htmlFor="job-startDate" className={labelClass}>
                Start Date <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <input
                id="job-startDate"
                type="date"
                aria-invalid={invalid('startDate')}
                aria-describedby={describedBy('startDate')}
                className={fieldClass(!!errors.startDate, { icon: false })}
                {...register('startDate')}
              />
              {errorFor('startDate')}
            </div>

            <div>
              <label htmlFor="job-dueDate" className={labelClass}>
                Due Date
              </label>
              <input
                id="job-dueDate"
                type="date"
                aria-invalid={invalid('dueDate')}
                aria-describedby={describedBy('dueDate')}
                className={fieldClass(!!errors.dueDate, { icon: false })}
                {...register('dueDate')}
              />
              {errorFor('dueDate')}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="job-notes" className={labelClass}>
                Notes <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <textarea
                id="job-notes"
                rows={4}
                aria-invalid={invalid('notes')}
                aria-describedby={describedBy('notes')}
                className={fieldClass(!!errors.notes, { icon: false })}
                {...register('notes')}
              />
              {errorFor('notes')}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to={cancelTo} className={secondaryButtonClass}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Icon name="loading" size={16} className="animate-spin" />
                  Saving…
                </span>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create Job'
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function EditJob({ id }: { id: number }) {
  const { data: job, error, isLoading, isError, refetch } = useGetJobQuery(id);

  if (isLoading) {
    return (
      <p role="status" className="py-12 text-center text-sm text-text-muted">
        Loading job…
      </p>
    );
  }

  if (isError && 'status' in error && error.status === 404) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-text">Job not found</p>
        <p className="mt-1 mb-4 text-sm text-text-muted">It may have been removed, or the link is wrong.</p>
        <Link to="/jobs" className={backLinkClass}>
          <Icon name="chevronLeft" size={16} />
          Back to jobs
        </Link>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="py-12 text-center">
        <FormAlert message="Could not load this job." />
        <button type="button" onClick={() => refetch()} className={secondaryButtonClass}>
          Try again
        </button>
      </div>
    );
  }

  // Completed and Cancelled jobs are locked (the server enforces this too).
  if (isJobLocked(job.status)) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-text">{job.jobNo} can no longer be edited</p>
        <p className="mt-1 mb-4 text-sm text-text-muted">
          Jobs that are {JOB_STATUS_LABELS[job.status]} are locked.
        </p>
        <Link to={`/jobs/${job.id}`} className={backLinkClass}>
          <Icon name="chevronLeft" size={16} />
          Back to job
        </Link>
      </div>
    );
  }

  return <JobForm job={job} />;
}

// Create at /jobs/new, edit at /jobs/:id/edit.
export default function JobFormPage() {
  const { id } = useParams();
  if (id === undefined) return <JobForm />;

  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId < 1) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-text">Job not found</p>
        <Link to="/jobs" className={`mt-4 ${backLinkClass}`}>
          <Icon name="chevronLeft" size={16} />
          Back to jobs
        </Link>
      </div>
    );
  }

  return <EditJob id={jobId} />;
}
