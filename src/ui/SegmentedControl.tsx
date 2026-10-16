import { useId } from 'react';

import type { ReactElement } from 'react';

import styles from './SegmentedControl.module.css';

export interface SegmentedOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly count?: number;
}

export interface SegmentedControlProps<TValue extends string> {
  readonly label: string;
  readonly options: readonly SegmentedOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
}

/** Native radio inputs, so arrow-key navigation and screen reader semantics come for free. */
export function SegmentedControl<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<TValue>): ReactElement {
  const groupName = useId();

  return (
    <div role="radiogroup" aria-label={label} className={styles.group}>
      {options.map((option) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name={groupName}
            className={styles.input}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className={styles.text}>
            {option.label}
            {option.count === undefined ? null : (
              <span className={styles.count}>{option.count}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
