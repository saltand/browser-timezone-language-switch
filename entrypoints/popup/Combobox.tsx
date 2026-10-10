import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary text shown on the right, e.g. a region group. */
  detail?: string;
};

type ComboboxProps = {
  label: string;
  value: string;
  options: ComboboxOption[];
  /** Display text for the committed value (including custom values). */
  formatValue: (value: string) => string;
  /** Validate free text; return the value to store, or null if invalid. */
  parseCustom: (text: string) => string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  customHint?: string;
};

const MAX_VISIBLE_OPTIONS = 60;

/**
 * Searchable select that also accepts a custom value. The option list renders
 * in flow (not as an overlay) so the popup window grows instead of clipping it.
 */
export function Combobox({
  label,
  value,
  options,
  formatValue,
  parseCustom,
  onChange,
  placeholder,
  customHint,
}: ComboboxProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [invalid, setInvalid] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => (
      option.label.toLowerCase().includes(normalizedQuery)
      || option.value.toLowerCase().includes(normalizedQuery)
      || (option.detail?.toLowerCase().includes(normalizedQuery) ?? false)
    ));
  }, [normalizedQuery, options]);

  const customValue = normalizedQuery ? parseCustom(query) : null;
  const showCustom = customValue !== null && !options.some((option) => option.value === customValue);
  // Listed options come first so Enter picks a known value over raw input.
  const items: ComboboxOption[] = [
    ...filtered.slice(0, MAX_VISIBLE_OPTIONS),
    ...(showCustom ? [{ value: customValue, label: `Use "${query.trim()}"`, detail: 'custom' }] : []),
  ];

  const open = () => {
    setQuery('');
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setInvalid(false);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  const commit = (nextValue: string) => {
    onChange(nextValue);
    setInvalid(false);
    close();
  };

  const commitQuery = () => {
    if (!normalizedQuery) {
      close();
      return;
    }

    const parsed = parseCustom(query);
    if (filtered.length === 1) {
      commit(filtered[0].value);
    } else if (parsed !== null) {
      commit(parsed);
    } else {
      setInvalid(true);
      close();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        open();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
        // Pick from the list instead of submitting the form.
        event.preventDefault();
        if (items[activeIndex]) {
          commit(items[activeIndex].value);
        } else {
          commitQuery();
        }
        break;
      case 'Escape':
        // Close the list only; Escape again cancels the form.
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        commitQuery();
        break;
    }
  };

  const listId = `${id}-list`;

  return (
    <div className="form-group combobox">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && items[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        spellCheck={false}
        value={isOpen ? query : formatValue(value)}
        placeholder={isOpen ? formatValue(value) : placeholder}
        onFocus={open}
        onClick={() => {
          if (!isOpen) open();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onBlur={commitQuery}
        onKeyDown={handleKeyDown}
      />
      {invalid && <span className="hint is-error">Not a valid value. {customHint}</span>}
      {isOpen && (
        <ul className="combobox-list" id={listId} role="listbox">
          {items.length === 0 && (
            <li className="combobox-empty">No matches. {customHint}</li>
          )}
          {items.map((option, index) => (
            <li
              key={`${option.detail === 'custom' ? 'custom:' : ''}${option.value}`}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`combobox-option ${index === activeIndex ? 'is-active' : ''} ${option.value === value ? 'is-selected' : ''}`}
              // Keep focus in the input so blur doesn't commit the raw query first.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(option.value)}
            >
              <span className="combobox-option-label">{option.label}</span>
              {option.detail && <span className="combobox-option-detail">{option.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
