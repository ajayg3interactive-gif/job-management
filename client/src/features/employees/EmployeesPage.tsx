import { useState } from 'react';
import { useGetEmployeesQuery, useSetEmployeeStatusMutation } from '../../api/employeesApi';
import { parseApiError } from '../../api/errors';
import { FormAlert, fieldClass } from '../../components/FormField';
import Icon from '../../components/Icon';
import Pagination from '../../components/Pagination';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import type { Employee, EmployeeStatusFilter } from '../../types/employee';
import DeactivateEmployeeModal from './DeactivateEmployeeModal';
import EmployeeFormModal from './EmployeeFormModal';
import { EMPLOYEES_PAGE_SIZE, useEmployeeListParams } from './useEmployeeListParams';

type FormTarget = { mode: 'create' } | { mode: 'edit'; employee: Employee };

const actionButtonClass =
  'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? 'bg-accent/15 text-accent' : 'bg-text-muted/15 text-text-muted'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function EmployeesPage() {
  const { search, status, page, update } = useEmployeeListParams();

  // The box updates instantly; the URL (and so the request) follows once typing pauses.
  const {
    input: searchInput,
    setInput: setSearchInput,
    reset: resetSearchInput,
  } = useDebouncedSearch(search, (value) => update({ search: value }));

  const { data, isLoading, isFetching, isError, refetch } = useGetEmployeesQuery({
    search,
    status,
    page,
    pageSize: EMPLOYEES_PAGE_SIZE,
  });

  const [setEmployeeStatus, { isLoading: isChangingStatus, originalArgs }] =
    useSetEmployeeStatusMutation();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deactivating, setDeactivating] = useState<Employee | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasFilters = search !== '' || status !== undefined;
  const pendingId = isChangingStatus ? originalArgs?.id : undefined;

  const changeStatus = async (employee: Employee, isActive: boolean) => {
    setActionError(null);
    const result = await setEmployeeStatus({ id: employee.id, isActive });
    if ('error' in result) setActionError(parseApiError(result.error).message);
  };

  const confirmDeactivate = async () => {
    if (!deactivating) return;
    await changeStatus(deactivating, false);
    setDeactivating(null);
  };

  const clearFilters = () => {
    resetSearchInput();
    update({ search: '', status: '' });
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <p role="status" className="py-12 text-center text-sm text-text-muted">
          Loading employees…
        </p>
      );
    }

    if (isError || !data) {
      return (
        <div className="py-12 text-center">
          <FormAlert message="Could not load employees." />
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

    if (data.data.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-text">No employees found</p>
          <p className="mt-1 text-sm text-text-muted">
            {hasFilters
              ? 'Try a different search or filter.'
              : 'Add your first employee to get started.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-background"
            >
              Clear filters
            </button>
          )}
          {!hasFilters && page === 1 && (
            <button
              type="button"
              onClick={() => setFormTarget({ mode: 'create' })}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              Add Employee
            </button>
          )}
          {page > 1 && (
            <button
              type="button"
              onClick={() => update({ page: 1 })}
              className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-background"
            >
              Go to first page
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <div className={`overflow-x-auto ${isFetching ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th scope="col" className="py-3 pr-4 font-medium">Name</th>
                <th scope="col" className="py-3 pr-4 font-medium">Email</th>
                <th scope="col" className="py-3 pr-4 font-medium">Phone</th>
                <th scope="col" className="py-3 pr-4 font-medium">Status</th>
                <th scope="col" className="py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((employee) => (
                <tr key={employee.id} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-4 font-medium text-text">{employee.name}</td>
                  <td className="py-3 pr-4 text-text">{employee.email}</td>
                  <td className="py-3 pr-4 text-text">{employee.phone ?? '—'}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge isActive={employee.isActive} />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setFormTarget({ mode: 'edit', employee })}
                        aria-label={`Edit ${employee.name}`}
                        className={`${actionButtonClass} flex items-center gap-1 text-text hover:bg-background`}
                      >
                        <Icon name="edit" size={16} />
                        Edit
                      </button>
                      {employee.isActive ? (
                        <button
                          type="button"
                          onClick={() => setDeactivating(employee)}
                          disabled={pendingId === employee.id}
                          aria-label={`Deactivate ${employee.name}`}
                          className={`${actionButtonClass} text-danger hover:bg-danger/10`}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => changeStatus(employee, true)}
                          disabled={pendingId === employee.id}
                          aria-label={`Activate ${employee.name}`}
                          className={`${actionButtonClass} text-accent hover:bg-accent/10`}
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <h1 className="text-2xl font-bold text-text">Employees</h1>
        <button
          type="button"
          onClick={() => setFormTarget({ mode: 'create' })}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          <Icon name="addUser" size={18} />
          Add Employee
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
              <Icon name="search" size={18} />
            </div>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or email"
              aria-label="Search employees"
              className={fieldClass(false)}
            />
          </div>
          <select
            value={status ?? ''}
            onChange={(event) => update({ status: event.target.value as EmployeeStatusFilter | '' })}
            aria-label="Filter by status"
            className={`${fieldClass(false, { icon: false })} sm:w-44`}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {actionError && <FormAlert message={actionError} />}

        {renderBody()}
      </div>

      {formTarget && (
        <EmployeeFormModal
          employee={formTarget.mode === 'edit' ? formTarget.employee : undefined}
          onClose={() => setFormTarget(null)}
        />
      )}

      {deactivating && (
        <DeactivateEmployeeModal
          employee={deactivating}
          isLoading={isChangingStatus}
          onConfirm={confirmDeactivate}
          onClose={() => setDeactivating(null)}
        />
      )}
    </section>
  );
}
