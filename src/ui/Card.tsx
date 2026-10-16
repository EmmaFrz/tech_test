import type { ComponentPropsWithoutRef, ReactElement } from 'react';

import styles from './Card.module.css';

export type CardTone = 'neutral' | 'warning' | 'alert';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  readonly tone?: CardTone;
}

export function Card({ tone = 'neutral', className, ...rest }: CardProps): ReactElement {
  const classNames = [styles.card, styles[tone], className].filter(Boolean).join(' ');
  return <div className={classNames} data-tone={tone} {...rest} />;
}
