import Icon from './Icon';

interface FieldClassOptions {
  // Room for an icon on the left (default) or right of the input.
  icon?: boolean;
  rightIcon?: boolean;
}

// Shared input styling so every form looks the same.
export const fieldClass = (hasError: boolean, { icon = true, rightIcon = false }: FieldClassOptions = {}) =>
  `w-full ${icon ? 'pl-10' : 'pl-4'} ${rightIcon ? 'pr-10' : 'pr-4'} py-3 border rounded-xl text-sm text-text focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-danger/40 focus:ring-danger/20'
      : 'border-border focus:border-primary focus:ring-primary/20 bg-surface'
  }`;

export const labelClass = 'mb-1.5 block text-sm font-medium text-text';

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-danger">
      <Icon name="exclamation" size={14} strokeWidth={0.5} />
      {message}
    </p>
  );
}

export function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
    >
      <Icon name="exclamation" size={16} />
      {message}
    </div>
  );
}
