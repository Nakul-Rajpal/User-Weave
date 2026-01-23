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
    id: 'design-implications',
    label: 'Design Implications',
    description: 'AI-generated design implications from transcript',
    route: '/meet/:roomId/design-implications',
    icon: '💡',
    color: '#8b5cf6', // violet-500
  },
  {
    id: 'design',
    label: 'Design Stage',
    description: 'Individual design work with LLM assistance',
    route: '/meet/:roomId/design',
    icon: '🎨',
    color: '#10b981', // green-500
  },
  {
    id: 'rating',
    label: 'Rating',
    description: 'Rate and discuss submitted designs',
    route: '/meet/:roomId/rating',
    icon: '⭐',
    color: '#f59e0b', // amber-500
  },
  {
    id: 'winner',
    label: 'Final Design',
    description: 'Group-selected final design',
    route: '/meet/:roomId/winner',
    icon: '✅',
    color: '#ec4899', // pink-500
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
    id: 'meeting-to-design-implications',
    source: 'meeting',
    target: 'design-implications',
    label: 'View Implications',
  },
  {
    id: 'design-implications-to-design',
    source: 'design-implications',
    target: 'design',
    label: 'Start Design',
  },
  {
    id: 'design-to-rating',
    source: 'design',
    target: 'rating',
    label: 'Submit & Rate',
  },
  {
    id: 'rating-to-winner',
    source: 'rating',
    target: 'winner',
    label: 'View Final',
  },
  {
    id: 'winner-to-exit',
    source: 'winner',
    target: 'exit',
    label: 'Complete',
  },
  // Allow going back to previous stages
  {
    id: 'design-implications-to-meeting',
    source: 'design-implications',
    target: 'meeting',
  },
  {
    id: 'design-to-design-implications',
    source: 'design',
    target: 'design-implications',
  },
  {
    id: 'rating-to-design',
    source: 'rating',
    target: 'design',
  },
  {
    id: 'winner-to-rating',
    source: 'winner',
    target: 'rating',
  },
  // Exit can be accessed from any node
  {
    id: 'meeting-to-exit',
    source: 'meeting',
    target: 'exit',
  },
  {
    id: 'design-implications-to-exit',
    source: 'design-implications',
    target: 'exit',
  },
  {
    id: 'design-to-exit',
    source: 'design',
    target: 'exit',
  },
  {
    id: 'rating-to-exit',
    source: 'rating',
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
