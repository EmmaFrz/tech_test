import { useCallback } from 'react';

import type { ReactElement } from 'react';

import { useSelectedNodeId, useUiActions } from '@/store';
import { Button, EmptyState, Panel } from '@/ui';

import { SelectedNodeDetail } from './SelectedNodeDetail';
import { useEscapeKey } from './useEscapeKey';

export function NodeDetailPanel(): ReactElement {
  const selectedNodeId = useSelectedNodeId();
  const { selectNode } = useUiActions();
  const handleClose = useCallback(() => selectNode(null), [selectNode]);

  useEscapeKey(selectedNodeId !== null, handleClose);

  if (selectedNodeId === null) {
    return (
      <Panel title="Node details" data-testid="node-detail">
        <EmptyState
          title="No node selected"
          description="Choose a row to inspect its live telemetry."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title={selectedNodeId}
      data-testid="node-detail"
      actions={
        <Button variant="ghost" onClick={handleClose}>
          Close
        </Button>
      }
    >
      <SelectedNodeDetail nodeId={selectedNodeId} />
    </Panel>
  );
}
