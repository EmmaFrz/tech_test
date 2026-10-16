import { useCallback } from 'react';

import type { ReactElement, Ref } from 'react';

import { useSelectedNodeId, useUiActions } from '@/store';
import { Button, EmptyState, Panel } from '@/ui';

import { SelectedNodeDetail } from './SelectedNodeDetail';
import { useEscapeKey } from './useEscapeKey';

export interface NodeDetailPanelProps {
  /** The panel region, which takes programmatic focus while a node is selected. */
  readonly ref?: Ref<HTMLElement>;
}

export function NodeDetailPanel({ ref }: NodeDetailPanelProps): ReactElement {
  const selectedNodeId = useSelectedNodeId();
  const { selectNode } = useUiActions();
  const handleClose = useCallback(() => selectNode(null), [selectNode]);

  useEscapeKey(selectedNodeId !== null, handleClose);

  if (selectedNodeId === null) {
    return (
      <Panel ref={ref} title="Node details" data-testid="node-detail">
        <EmptyState
          title="No node selected"
          description="Choose a row to inspect its live telemetry."
        />
      </Panel>
    );
  }

  return (
    <Panel
      ref={ref}
      title={selectedNodeId}
      tabIndex={-1}
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
