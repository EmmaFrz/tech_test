import { Component } from 'react';

import type { ErrorInfo, ReactNode } from 'react';

import { createLogger } from '@/lib/logger';
import { Button } from '@/ui';

import styles from './RegionBoundary.module.css';

const log = createLogger('app');

export interface RegionBoundaryProps {
  readonly region: string;
  readonly children: ReactNode;
}

interface RegionBoundaryState {
  readonly hasError: boolean;
}

/** React only supports error boundaries as classes; every other component is a function. */
export class RegionBoundary extends Component<RegionBoundaryProps, RegionBoundaryState> {
  override state: RegionBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RegionBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('region crashed', {
      region: this.props.region,
      error: error.message,
      componentStack: info.componentStack,
    });
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div role="alert" className={styles.fallback}>
        <p className={styles.message}>Something went wrong in {this.props.region}.</p>
        <Button onClick={this.handleRetry}>Try again</Button>
      </div>
    );
  }
}
