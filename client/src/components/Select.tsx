import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  options: SelectOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Extra classes for the wrapper, e.g. "sm:w-44" */
  className?: string;
  /** Show a pencil icon on options listed in `editableValues` */
  showEditIcon?: boolean;
  editableValues?: T[];
  onEdit?: (value: T) => void;
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  ariaLabel,
  className = '',
  showEditIcon = false,
  editableValues = [],
  onEdit,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  // Close when clicking outside (replaces the fixed overlay from the Angular version)
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      setActiveIndex(options.findIndex((o) => o.value === value));
    }
    setOpen((o) => !o);
  };

  const select = (option: SelectOption<T>) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleEditClick = (e: MouseEvent, optionValue: T) => {
    e.stopPropagation();
    onEdit?.(optionValue);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'Escape':
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          toggleOpen();
        } else {
          setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) {
          toggleOpen();
        } else if (activeIndex >= 0 && options[activeIndex]) {
          select(options[activeIndex]);
        }
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border-[1.5px] border-border bg-background px-3 py-3 text-left text-[13.5px] outline-none transition-colors focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? 'text-text' : 'text-text-muted'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-[220px] overflow-y-auto rounded-xl border-[1.5px] border-border bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => select(option)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-center justify-between px-3 py-2.5 text-[13.5px] text-text ${
                index === activeIndex ? 'bg-text/5' : ''
              } ${option.value === value ? 'font-medium' : ''}`}
            >
              <span>{option.label}</span>

              {showEditIcon && editableValues.includes(option.value) && (
                <button
                  type="button"
                  aria-label="Edit"
                  onClick={(e) => handleEditClick(e, option.value)}
                  className="group relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-primary"
                >
                  <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 origin-bottom-right scale-95 whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-text opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
                    Edit
                    <span className="absolute right-3 top-full -mt-px h-2 w-2 rotate-45 border-b border-r border-border bg-surface" />
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
