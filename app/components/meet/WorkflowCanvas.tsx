/**
 * WorkflowCanvas Component
 * Main ReactFlow canvas for workflow visualization and navigation
 *
 * Note: This is a client-only component (.client.tsx extension)
 */

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
// Note: CSS is loaded via links function in the route file (meet_.$roomId_.workflow.tsx)
// to ensure proper loading during client-side navigation
import { useNavigate } from '@remix-run/react';
import { WorkflowNodeComponent, type WorkflowNodeData } from './WorkflowNodes';
import { WORKFLOW_NODES, WORKFLOW_EDGES, getNodeRoute } from '~/lib/workflow/nodeDefinitions';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import type { WorkflowNodeId } from '~/types/workflow';
import HostControlPanel from './HostControlPanel';

interface WorkflowCanvasProps {
  roomId: string;
}

// Define node types for ReactFlow
const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

// Node positions for layout (can be adjusted)
const NODE_POSITIONS: Record<WorkflowNodeId, { x: number; y: number }> = {
  meeting: { x: 100, y: 200 },
  'design-implications': { x: 350, y: 200 },
  design: { x: 600, y: 200 },
  rating: { x: 850, y: 200 },
  winner: { x: 1100, y: 200 },
  exit: { x: 1350, y: 200 },
};

export default function WorkflowCanvas({ roomId }: WorkflowCanvasProps) {
  const navigate = useNavigate();
  const {
    workflowState,
    isLoading,
    error,
    navigateToNode,
    isNodeAccessible,
    isNodeVisited,
    isNodeEnabled,
    isHost, // Use isHost for workflow control (not global isAdmin)
  } = useWorkflowStore();

  // Handle node click - navigate to that node's page
  const handleNodeClick = useCallback(
    (nodeId: WorkflowNodeId) => {
      const accessible = isNodeAccessible(nodeId);
      const enabled = isNodeEnabled(nodeId);
      const fullyAccessible = accessible && enabled;

      if (!fullyAccessible) {
        // Show appropriate error message
        if (!accessible) {
          alert(`This node is not accessible yet. Complete previous steps first.`);
        } else if (!enabled) {
          alert(`This section has not been enabled by the host yet.`);
        }
        return;
      }

      // Handle exit node specially
      if (nodeId === 'exit') {
        const confirmExit = window.confirm(
          'Are you sure you want to exit the meeting? This will disconnect you from LiveKit.'
        );

        if (confirmExit) {
          // Navigate to meeting lobby
          navigate('/meet');
        }
        return;
      }

      // Update workflow state (host only - the person who created this room's workflow)
      if (isHost) {
        navigateToNode(nodeId);
      }

      // Navigate to the node's route
      const route = getNodeRoute(nodeId, roomId);
      navigate(route);
    },
    [roomId, navigate, isHost, navigateToNode, isNodeAccessible, isNodeEnabled]
  );

  // Create ReactFlow nodes from workflow definitions
  const reactFlowNodes: Node[] = useMemo(() => {
    return WORKFLOW_NODES.map((node) => {
      const isEnabled = isNodeEnabled(node.id);
      const isAccessible = isNodeAccessible(node.id);
      const fullyAccessible = isAccessible && isEnabled;

      return {
        id: node.id,
        type: 'workflowNode',
        position: NODE_POSITIONS[node.id],
        data: {
          id: node.id,
          label: node.label,
          description: node.description,
          icon: node.icon,
          color: node.color,
          isCurrent: workflowState?.currentNode === node.id,
          isVisited: isNodeVisited(node.id),
          isAccessible: fullyAccessible, // Must be both accessible AND enabled
          onClick: handleNodeClick,
        },
      };
    });
  }, [workflowState, isNodeVisited, isNodeAccessible, isNodeEnabled, handleNodeClick]);

  // Create ReactFlow edges from workflow edge definitions
  const reactFlowEdges: Edge[] = useMemo(() => {
    return WORKFLOW_EDGES.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: workflowState?.currentNode === edge.source, // Animate edges from current node
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      style: {
        strokeWidth: 2,
      },
    }));
  }, [workflowState]);

  const [nodes, setNodes, onNodesChange] = useNodesState(reactFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(reactFlowEdges);

  // Update nodes and edges when workflow state changes
  useEffect(() => {
    setNodes(reactFlowNodes);
    setEdges(reactFlowEdges);
  }, [reactFlowNodes, reactFlowEdges, setNodes, setEdges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-xl font-semibold text-gray-700">Loading workflow...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl font-semibold text-red-700 mb-2">Error loading workflow</div>
          <div className="text-sm text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Meeting Workflow</h1>
          <p className="text-sm text-gray-600">
            Room: <span className="font-mono font-semibold">{roomId}</span>
            {isHost && (
              <span className="ml-3 px-2 py-1 bg-orange-500 text-white rounded text-xs font-medium uppercase">
                HOST
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {workflowState && (
            <div className="text-sm text-gray-600">
              Current: <span className="font-semibold">{workflowState.currentNode}</span>
            </div>
          )}
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <div className="h-[calc(100vh-80px)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as WorkflowNodeData;
              if (data.isCurrent) return '#3b82f6'; // blue
              if (data.isVisited) return '#10b981'; // green
              return '#9ca3af'; // gray
            }}
          />
        </ReactFlow>
      </div>

      {/* Host Control Panel - Right side (only visible to room host) */}
      {isHost && (
        <div className="absolute top-20 right-6">
          <HostControlPanel isAdmin={isHost} />
        </div>
      )}

      {/* Instructions - Bottom left */}
      <div className="absolute bottom-20 left-6 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="font-semibold text-gray-800 mb-2">How to navigate:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click on accessible nodes to navigate</li>
          <li>• 🔒 Locked nodes require completing previous steps</li>
          <li>• ✓ Visited nodes show your progress</li>
          {isHost && <li>• 🎛️ Use the control panel to enable/disable sections</li>}
        </ul>
      </div>
    </div>
  );
}
