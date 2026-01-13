/**
 * Workflow node definitions
 * Defines all nodes in the meeting workflow with their properties
 */

import type { WorkflowNode, WorkflowEdge } from '~/types/workflow';

export const WORKFLOW_NODES: WorkflowNode[] = [
  {
    id: 'meeting',
    label: 'Meeting',
    description: 'Video conference with all participants',
    route: '/meet/:roomId',
    icon: '📹',
    color: '#3b82f6', // blue-500
  },
  {
    id: 'poll',
    label: 'Poll/Voting',
    description: 'Conduct polls and voting sessions',
    route: '/meet/:roomId/poll',
    icon: '📊',
    color: '#8b5cf6', // violet-500
  },
  {
    id: 'coding',
    label: 'Coding Mode',
    description: 'Collaborative coding environment',
    route: '/meet/:roomId/code',
    icon: '💻',
    color: '#10b981', // green-500
  },
  {
    id: 'code-review',
    label: 'Code Review',
    description: 'Review and discuss code changes',
    route: '/meet/:roomId/code-review',
    icon: '🔍',
    color: '#f59e0b', // amber-500
  },
  {
    id: 'exit',
    label: 'Exit',
    description: 'Leave the meeting',
    route: '#exit',
    icon: '🚪',
    color: '#ef4444', // red-500
  },
];

export const WORKFLOW_EDGES: WorkflowEdge[] = [
  {
    id: 'meeting-to-poll',
    source: 'meeting',
    target: 'poll',
    label: 'Start Poll',
  },
  {
    id: 'poll-to-coding',
    source: 'poll',
    target: 'coding',
    label: 'Begin Coding',
  },
  {
    id: 'coding-to-code-review',
    source: 'coding',
    target: 'code-review',
    label: 'Review Code',
  },
  {
    id: 'code-review-to-exit',
    source: 'code-review',
    target: 'exit',
    label: 'Complete',
  },
  // Allow going back to previous stages
  {
    id: 'poll-to-meeting',
    source: 'poll',
    target: 'meeting',
  },
  {
    id: 'coding-to-poll',
    source: 'coding',
    target: 'poll',
  },
  {
    id: 'code-review-to-coding',
    source: 'code-review',
    target: 'coding',
  },
  // Exit can be accessed from any node
  {
    id: 'meeting-to-exit',
    source: 'meeting',
    target: 'exit',
  },
  {
    id: 'poll-to-exit',
    source: 'poll',
    target: 'exit',
  },
  {
    id: 'coding-to-exit',
    source: 'coding',
    target: 'exit',
  },
];

// Helper function to get node by ID
export function getNodeById(nodeId: string): WorkflowNode | undefined {
  return WORKFLOW_NODES.find((node) => node.id === nodeId);
}

// Helper function to get route for a node with room ID
export function getNodeRoute(nodeId: string, roomId: string): string {
  const node = getNodeById(nodeId);
  if (!node) return '/meet';
  return node.route.replace(':roomId', roomId);
}

// Helper function to get all edges for a specific node
export function getNodeEdges(nodeId: string): {
  outgoing: WorkflowEdge[];
  incoming: WorkflowEdge[];
} {
  return {
    outgoing: WORKFLOW_EDGES.filter((edge) => edge.source === nodeId),
    incoming: WORKFLOW_EDGES.filter((edge) => edge.target === nodeId),
  };
}

// Get next possible nodes from current node
export function getNextNodes(currentNodeId: string): WorkflowNode[] {
  const outgoingEdges = WORKFLOW_EDGES.filter((edge) => edge.source === currentNodeId);
  return outgoingEdges
    .map((edge) => getNodeById(edge.target))
    .filter((node): node is WorkflowNode => node !== undefined);
}

// Get previous possible nodes to current node
export function getPreviousNodes(currentNodeId: string): WorkflowNode[] {
  const incomingEdges = WORKFLOW_EDGES.filter((edge) => edge.target === currentNodeId);
  return incomingEdges
    .map((edge) => getNodeById(edge.source))
    .filter((node): node is WorkflowNode => node !== undefined);
}
