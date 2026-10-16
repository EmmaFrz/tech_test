import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTelemetryStore } from '@/store';
import { makeNode } from '@/test/factories';
import { resetStores, seedFleet } from '@/test/stores';

import { DocumentTitle } from './DocumentTitle';

describe('DocumentTitle', () => {
  beforeEach(() => {
    resetStores();
    document.title = '';
  });

  it('uses the plain name while nothing is critical', () => {
    render(<DocumentTitle />);

    expect(document.title).toBe('Fleet Ops');
  });

  it('puts the number of critical nodes in the tab title', () => {
    seedFleet([
      makeNode({ nodeId: 'a', status: 'CRITICAL' }),
      makeNode({ nodeId: 'b', status: 'CRITICAL' }),
      makeNode({ nodeId: 'c', status: 'OK' }),
    ]);

    render(<DocumentTitle />);

    expect(document.title).toBe('(2) Fleet Ops');
  });

  it('follows the count as nodes recover', () => {
    seedFleet([makeNode({ nodeId: 'a', status: 'CRITICAL' })]);
    render(<DocumentTitle />);

    act(() =>
      useTelemetryStore.getState().actions.applyBatch({
        updates: [makeNode({ nodeId: 'a', status: 'OK', timestamp: 2_000_000_000_000 })],
        serverTime: null,
        receivedAt: 2,
      }),
    );

    expect(document.title).toBe('Fleet Ops');
  });
});
