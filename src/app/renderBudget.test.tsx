import { act, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReactElement } from 'react';

import { useTelemetryStore } from '@/store';
import { makeNode, makeNodes, TEST_TIMESTAMP } from '@/test/factories';
import { mockElementLayout } from '@/test/layout';
import { MockWebSocket } from '@/test/MockWebSocket';
import { resetStores } from '@/test/stores';
import type { BadgeProps } from '@/ui';

import { App } from './App';
import { startTelemetry } from './startTelemetry';

const badgeRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/ui/Badge', async (importOriginal) => {
  const actual = await importOriginal<{ Badge: (props: BadgeProps) => ReactElement }>();
  return {
    Badge: (props: BadgeProps): ReactElement => {
      badgeRenders.count += 1;
      return actual.Badge(props);
    },
  };
});

describe('render budget (NFR-02 and NFR-03)', () => {
  let frameCallbacks: (() => void)[];
  let commits: number;
  let stop: () => void;

  function runFrame(): void {
    const due = frameCallbacks;
    frameCallbacks = [];
    act(() => due.forEach((callback) => callback()));
  }

  function deltaMessage(seq: number, nodeIds: readonly string[]): unknown {
    return {
      type: 'delta',
      seq,
      updates: nodeIds.map((nodeId) =>
        makeNode({ nodeId, latencyMs: 100 + seq, timestamp: TEST_TIMESTAMP + seq }),
      ),
    };
  }

  beforeEach(() => {
    mockElementLayout({ viewportHeight: 440, rowHeight: 44 });
    MockWebSocket.reset();
    resetStores();
    frameCallbacks = [];
    commits = 0;
    stop = startTelemetry({
      createSocket: MockWebSocket.create,
      requestFrame: (callback) => frameCallbacks.push(callback),
      cancelFrame: () => undefined,
    });
    act(() => {
      MockWebSocket.latest().simulateMessage({ type: 'snapshot', seq: 1, nodes: makeNodes(200) });
    });
    render(
      <Profiler id="app" onRender={() => (commits += 1)}>
        <App />
      </Profiler>,
    );
    commits = 0;
    badgeRenders.count = 0;
  });

  afterEach(() => {
    stop();
  });

  it('commits once per frame no matter how many messages arrive in it', () => {
    const socket = MockWebSocket.latest();
    for (let seq = 2; seq < 62; seq += 1) {
      socket.simulateMessage(deltaMessage(seq, ['node-0001', 'node-0002', 'node-0003']));
    }
    expect(commits).toBe(0);

    runFrame();

    expect(commits).toBe(1);
  });

  it('re-renders only the rows whose node changed', () => {
    const socket = MockWebSocket.latest();
    socket.simulateMessage(deltaMessage(2, ['node-0001', 'node-0002', 'node-0003']));

    runFrame();

    expect(badgeRenders.count).toBe(3);
  });

  it('does not re-render any row for a heartbeat-only frame', () => {
    MockWebSocket.latest().simulateMessage({
      type: 'heartbeat',
      seq: 2,
      serverTime: TEST_TIMESTAMP + 2_000,
    });

    runFrame();

    expect(badgeRenders.count).toBe(0);
  });

  it('keeps the node map reference stable for nodes that were not updated', () => {
    const before = useTelemetryStore.getState().byId;
    MockWebSocket.latest().simulateMessage(deltaMessage(2, ['node-0001']));

    runFrame();

    const after = useTelemetryStore.getState().byId;
    expect(after['node-0001']).not.toBe(before['node-0001']);
    expect(after['node-0002']).toBe(before['node-0002']);
    expect(after['node-0200']).toBe(before['node-0200']);
  });
});
