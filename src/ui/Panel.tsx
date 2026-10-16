import { useId } from 'react';

import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';

import styles from './Panel.module.css';

export interface PanelProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title'> {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
}

export function Panel({ title, actions, children, className, ...rest }: PanelProps): ReactElement {
  const titleId = useId();
  const classNames = [styles.panel, className].filter(Boolean).join(' ');

  return (
    <section className={classNames} aria-labelledby={titleId} {...rest}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
