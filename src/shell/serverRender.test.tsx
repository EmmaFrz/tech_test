// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReactElement } from 'react';

import {
  historyStore,
  useNodeHistory,
  useTelemetryStore,
  useUiStore,
  useVisibleNodesStore,
} from '@/store';
import { makeNode } from '@/test/factories';

import { Dashboard } from './Dashboard';
import { startTelemetry } from './startTelemetry';

vi.mock('./startTelemetry', () => ({ startTelemetry: vi.fn(() => () => undefined) }));

function HistoryLength({ nodeId }: { readonly nodeId: string | null }): ReactElement {
  return <output>{useNodeHistory(nodeId).length}</output>;
}

describe('server rendering', () => {
  afterEach(() => {
    historyStore.clear();
  });

  it('renders the waiting-for-data dashboard', () => {
    const html = renderToString(<Dashboard />);

    expect(html).toContain('>Fleet Ops</h1>');
    expect(html).toContain('Waiting for telemetry');
    expect(html).toContain('No node selected');
    expect(html).toContain('data-state="connecting"');
    expect(html).not.toContain('Connection lost');
  });

  it('logs nothing while rendering', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderToString(<Dashboard />);

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('neither starts telemetry nor writes to the shared stores', () => {
    const stateBefore = [
      useTelemetryStore.getState(),
      useUiStore.getState(),
      useVisibleNodesStore.getState(),
    ];

    renderToString(<Dashboard />);

    expect(startTelemetry).not.toHaveBeenCalled();
    expect([
      useTelemetryStore.getState(),
      useUiStore.getState(),
      useVisibleNodesStore.getState(),
    ]).toEqual(stateBefore);
  });

  it('renders node history as empty, whatever the process has recorded', () => {
    historyStore.record([makeNode({ nodeId: 'node-0001' })]);

    expect(renderToString(<HistoryLength nodeId="node-0001" />)).toContain('>0</output>');
    expect(renderToString(<HistoryLength nodeId={null} />)).toContain('>0</output>');
  });
});
