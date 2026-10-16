import { useId } from 'react';

import type { ComponentPropsWithoutRef, ReactElement } from 'react';

import styles from './Input.module.css';
import { VisuallyHidden } from './VisuallyHidden';

export interface InputProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'onChange' | 'value' | 'id'
> {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}

export function Input({
  label,
  value,
  onValueChange,
  className,
  ...rest
}: InputProps): ReactElement {
  const inputId = useId();
  const classNames = [styles.input, className].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>
        <VisuallyHidden>{label}</VisuallyHidden>
      </label>
      <input
        id={inputId}
        className={classNames}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        {...rest}
      />
    </div>
  );
}
