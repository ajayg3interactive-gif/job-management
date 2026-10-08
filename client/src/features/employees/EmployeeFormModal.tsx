import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { parseApiError } from '../../api/errors';
import { useCreateEmployeeMutation, useUpdateEmployeeMutation } from '../../api/employeesApi';
import { FieldError, FormAlert, fieldClass, labelClass } from '../../components/FormField';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { employeeSchema, type EmployeeFormValues } from '../../schemas/employee';
import type { Employee } from '../../types/employee';

const FORM_FIELDS: ReadonlyArray<keyof EmployeeFormValues> = ['name', 'email', 'phone'];

const isFormField = (field: string | undefined): field is keyof EmployeeFormValues =>
  FORM_FIELDS.includes(field as keyof EmployeeFormValues);

interface EmployeeFormModalProps {
  // Present when editing, absent when adding.
  employee?: Employee;
  onClose: () => void;
}

export default function EmployeeFormModal({ employee, onClose }: EmployeeFormModalProps) {
  const isEdit = employee !== undefined;
  const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdating }] = useUpdateEmployeeMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const isSaving = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    mode: 'onTouched',
    defaultValues: {
      name: employee?.name ?? '',
      email: employee?.email ?? '',
      phone: employee?.phone ?? '',
    },
  });

  const onSubmit = async (values: EmployeeFormValues) => {
    setFormError(null);
    const result = isEdit
      ? await updateEmployee({ id: employee.id, ...values })
      : await createEmployee(values);

    if (!('error' in result)) {
      onClose();
      return;
    }

    // Show server errors (including a duplicate email) next to the right input.
    const { message, details } = parseApiError(result.error);
    const fieldErrors = details.filter((detail) => isFormField(detail.field));
    fieldErrors.forEach((detail) => {
      setError(detail.field as keyof EmployeeFormValues, { message: detail.message });
    });
    if (fieldErrors.length === 0) setFormError(message);
  };

  return (
    <Modal title={isEdit ? 'Edit Employee' : 'Add Employee'} onClose={onClose}>
      {formError && <FormAlert message={formError} />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-5">
          <label htmlFor="employee-name" className={labelClass}>
            Name
          </label>
          <input
            id="employee-name"
            type="text"
            autoComplete="off"
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'employee-name-error' : undefined}
            className={fieldClass(!!errors.name, { icon: false })}
            {...register('name')}
          />
          {errors.name?.message && <FieldError id="employee-name-error" message={errors.name.message} />}
        </div>

        <div className="mb-5">
          <label htmlFor="employee-email" className={labelClass}>
            Email
          </label>
          <input
            id="employee-email"
            type="email"
            autoComplete="off"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'employee-email-error' : undefined}
            className={fieldClass(!!errors.email, { icon: false })}
            {...register('email')}
          />
          {errors.email?.message && <FieldError id="employee-email-error" message={errors.email.message} />}
        </div>

        <div className="mb-6">
          <label htmlFor="employee-phone" className={labelClass}>
            Phone <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <input
            id="employee-phone"
            type="tel"
            autoComplete="off"
            aria-invalid={errors.phone ? 'true' : 'false'}
            aria-describedby={errors.phone ? 'employee-phone-error' : undefined}
            className={fieldClass(!!errors.phone, { icon: false })}
            {...register('phone')}
          />
          {errors.phone?.message && <FieldError id="employee-phone-error" message={errors.phone.message} />}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Icon name="loading" size={16} className="animate-spin" />
                Saving…
              </span>
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Add Employee'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
