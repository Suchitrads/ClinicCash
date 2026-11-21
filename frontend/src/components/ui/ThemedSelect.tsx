import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface ThemedSelectOption {
  value: string;
  label: string;
}

export interface ThemedSelectProps {
  /** Optional id on the trigger button, so a <label htmlFor> can point at it. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

const TRIGGER =
  'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';
const LISTBOX =
  'absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-2xl border border-border bg-card p-1 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const OPTION = 'flex min-h-[44px] cursor-pointer items-center rounded-xl px-3 text-sm';
const OPTION_IDLE = 'text-text';
const OPTION_ACTIVE = 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]';

export function ThemedSelect({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  disabled = false,
}: ThemedSelectProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : '';
  const listboxId = `${uid}-listbox`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  function openList() {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeList(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(i: number) {
    const opt = options[i];
    if (opt) onChange(opt.value);
    closeList(true);
  }

  // Move focus into the listbox when it opens so arrow keys work immediately.
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the active item visible while using the keyboard.
  useEffect(() => {
    if (open && active >= 0) {
      document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    }
    // optionId depends only on uid, which is stable for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  // Close if the select becomes disabled while open.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function handleTriggerKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openList();
    }
  }

  function handleListKey(e: ReactKeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, last));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (active >= 0) choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        closeList(true);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`.trim()}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={handleTriggerKey}
        className={TRIGGER}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-text/60 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          onKeyDown={handleListKey}
          className={LISTBOX}
        >
          {options.map((opt, i) => {
            const isActive = i === active;
            return (
              <li
                key={opt.value}
                id={optionId(i)}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`${OPTION} ${isActive ? OPTION_ACTIVE : OPTION_IDLE}`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
