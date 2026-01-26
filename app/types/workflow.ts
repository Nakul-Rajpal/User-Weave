/**
 * Workflow system types for meeting room navigation
 */

export type WorkflowNodeId = 'meeting' | 'design-implications' | 'design' | 'rating' | 'winner' | 'exit';

export interface WorkflowNode {
  id: WorkflowNodeId;
  label: string;
  description: string;
  route: string; // Route path for this node
  icon?: string; // Emoji or icon identifier
  color?: string; // Node color in workflow view
}

export interface WorkflowEdge {
  id: string;
  source: WorkflowNodeId;
  target: WorkflowNodeId;
  label?: string;
}

export interface WorkflowMetadata {
  enabledNodes?: WorkflowNodeId[]; // Nodes enabled by host (undefined = all enabled)
  summaryId?: string; // ID of the transcript summary
  agreedPoints?: string[]; // IDs of summary points with >50% agree votes
  actionItems?: string[]; // IDs of action item points
  [key: string]: any; // Allow additional metadata
}

export interface WorkflowState {
  id: string;
  roomId: string;
  currentNode: WorkflowNodeId;
  hostUserId: string;
  visitedNodes: WorkflowNodeId[];
  metadata: WorkflowMetadata; // Typed metadata for better type safety
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStore {
  // State
  workflowState: WorkflowState | null;
  isLoading: boolean;
  error: string | null;
  isHost: boolean;

  // Actions
  initializeWorkflow: (roomId: string, userId: string) => Promise<void>;
  navigateToNode: (nodeId: WorkflowNodeId) => Promise<void>;
  updateMetadata: (metadata: Record<string, any>) => Promise<void>;
  cleanup: () => void;

  // Helpers
  isNodeAccessible: (nodeId: WorkflowNodeId) => boolean;
  isNodeVisited: (nodeId: WorkflowNodeId) => boolean;
  getNextNode: () => WorkflowNodeId | null;
  getPreviousNode: () => WorkflowNodeId | null;
}

export interface ConditionalAccessRule {
  nodeId: WorkflowNodeId;
  requires: WorkflowNodeId[]; // Nodes that must be visited before this one
  requiresAll?: boolean; // If true, all required nodes must be visited; if false, any one is sufficient
}

// Supabase real-time payload types
export interface WorkflowRealtimePayload {
  new: WorkflowState;
  old: WorkflowState | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

// Navigation context
export interface WorkflowNavigationContext {
  roomId: string;
  userId: string;
  currentNode: WorkflowNodeId;
  targetNode: WorkflowNodeId;
  isAccessible: boolean;
  reason?: string; // Reason why navigation is blocked (if not accessible)
}
