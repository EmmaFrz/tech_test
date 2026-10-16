import { useId } from 'react';

import type { ReactElement } from 'react';

import styles from './Select.module.css';

export interface SelectOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

export interface SelectProps<TValue extends string> {
  readonly label: string;
  readonly options: readonly SelectOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
}

export function Select<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: SelectProps<TValue>): ReactElement {
  const selectId = useId();

  function handleChange(rawValue: string): void {
    const selected = options.find((option) => option.value === rawValue);
    if (selected !== undefined) {
      onChange(selected.value);
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
