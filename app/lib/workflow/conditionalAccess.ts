/**
 * Conditional access logic for workflow nodes
 * Determines which nodes can be accessed based on current state
 * Now includes host-controlled access (nodes can be enabled/disabled by host)
 */

import type { WorkflowNodeId, ConditionalAccessRule, WorkflowMetadata } from '~/types/workflow';

/**
 * Define access rules for each node
 * Meeting is always accessible (entry point)
 * Exit is always accessible
 * Other nodes require previous nodes to be visited
 */
export const ACCESS_RULES: ConditionalAccessRule[] = [
  {
    nodeId: 'meeting',
    requires: [], // Always accessible
  },
  {
    nodeId: 'design-implications',
    requires: ['meeting'], // Must have visited meeting
    requiresAll: true,
  },
  {
    nodeId: 'design',
    requires: ['meeting', 'design-implications'], // Must have visited meeting and design-implications
    requiresAll: true,
  },
  {
    nodeId: 'rating',
    requires: ['meeting', 'design-implications', 'design'], // Must have visited meeting, design-implications, and design
    requiresAll: true,
  },
  {
    nodeId: 'winner',
    requires: ['meeting', 'design-implications', 'design', 'rating'], // Must have visited all previous stages
    requiresAll: true,
  },
  {
    nodeId: 'exit',
    requires: [], // Always accessible
  },
];

/**
 * Check if a node is accessible based on visited nodes
 */
export function isNodeAccessible(
  targetNodeId: WorkflowNodeId,
  visitedNodes: WorkflowNodeId[]
): boolean {
  const rule = ACCESS_RULES.find((r) => r.nodeId === targetNodeId);

  if (!rule) {
    // If no rule defined, assume not accessible
    return false;
  }

  // If no requirements, it's always accessible
  if (rule.requires.length === 0) {
    return true;
  }

  // Check if requirements are met
  if (rule.requiresAll) {
    // All required nodes must be visited
    return rule.requires.every((requiredNode) => visitedNodes.includes(requiredNode));
  } else {
    // At least one required node must be visited
    return rule.requires.some((requiredNode) => visitedNodes.includes(requiredNode));
  }
}

/**
 * Get the reason why a node is not accessible
 */
export function getInaccessibilityReason(
  targetNodeId: WorkflowNodeId,
  visitedNodes: WorkflowNodeId[]
): string | null {
  if (isNodeAccessible(targetNodeId, visitedNodes)) {
    return null;
  }

  const rule = ACCESS_RULES.find((r) => r.nodeId === targetNodeId);

  if (!rule || rule.requires.length === 0) {
    return 'This node is not accessible';
  }

  const missingNodes = rule.requires.filter((node) => !visitedNodes.includes(node));

  if (missingNodes.length === 0) {
    return null;
  }

  const nodeNames = missingNodes.map((id) => {
    // Capitalize first letter
    return id.charAt(0).toUpperCase() + id.slice(1).replace('-', ' ');
  });

  if (rule.requiresAll) {
    if (nodeNames.length === 1) {
      return `You must visit ${nodeNames[0]} first`;
    }
    return `You must visit ${nodeNames.join(', ')} first`;
  } else {
    return `You must visit at least one of: ${nodeNames.join(', ')}`;
  }
}

/**
 * Get all accessible nodes from current state
 */
export function getAccessibleNodes(visitedNodes: WorkflowNodeId[]): WorkflowNodeId[] {
  return ACCESS_RULES.filter((rule) => isNodeAccessible(rule.nodeId, visitedNodes)).map(
    (rule) => rule.nodeId
  );
}

/**
 * Get the next recommended node based on visited nodes
 * Returns the first unvisited node that is accessible
 */
export function getRecommendedNextNode(
  visitedNodes: WorkflowNodeId[],
  currentNode: WorkflowNodeId
): WorkflowNodeId | null {
  // Define the recommended order
  const recommendedOrder: WorkflowNodeId[] = ['meeting', 'design-implications', 'design', 'rating', 'winner', 'exit'];

  // Find the current node index
  const currentIndex = recommendedOrder.indexOf(currentNode);

  // Look for the next unvisited accessible node
  for (let i = currentIndex + 1; i < recommendedOrder.length; i++) {
    const nodeId = recommendedOrder[i];
    if (!visitedNodes.includes(nodeId) && isNodeAccessible(nodeId, visitedNodes)) {
      return nodeId;
    }
  }

  return null;
}

/**
 * Check if a node is enabled by the host
 * If enabledNodes is undefined, all nodes are DISABLED (no backwards compatibility)
 * If enabledNodes is defined, only listed nodes are enabled
 * Note: 'meeting' and 'exit' are ALWAYS enabled (not controlled by host)
 */
export function isNodeEnabledByHost(
  nodeId: WorkflowNodeId,
  metadata: WorkflowMetadata
): boolean {
  // Meeting and exit are ALWAYS enabled (not controlled by host)
  if (nodeId === 'meeting' || nodeId === 'exit') {
    return true;
  }

  // If enabledNodes is not set, all nodes are disabled
  if (!metadata.enabledNodes) {
    return false;
  }

  // Check if this node is in the enabled list
  return metadata.enabledNodes.includes(nodeId);
}

/**
 * Check if a node is fully accessible (both visited requirements AND host-enabled)
 */
export function isNodeFullyAccessible(
  nodeId: WorkflowNodeId,
  visitedNodes: WorkflowNodeId[],
  metadata: WorkflowMetadata
): boolean {
  // Must pass both checks:
  // 1. Visited node requirements (workflow progression)
  const meetsVisitedRequirements = isNodeAccessible(nodeId, visitedNodes);

  // 2. Host has enabled this node
  const enabledByHost = isNodeEnabledByHost(nodeId, metadata);

  return meetsVisitedRequirements && enabledByHost;
}

/**
 * Get the reason why a node is not fully accessible
 */
export function getFullInaccessibilityReason(
  nodeId: WorkflowNodeId,
  visitedNodes: WorkflowNodeId[],
  metadata: WorkflowMetadata
): string | null {
  // Check visited requirements first
  const meetsVisitedRequirements = isNodeAccessible(nodeId, visitedNodes);
  if (!meetsVisitedRequirements) {
    return getInaccessibilityReason(nodeId, visitedNodes);
  }

  // Check host-enabled status
  const enabledByHost = isNodeEnabledByHost(nodeId, metadata);
  if (!enabledByHost) {
    return 'This section has not been enabled by the host yet';
  }

  return null;
}

/**
 * Validate if a user can navigate from one node to another
 */
export function canNavigate(
  fromNode: WorkflowNodeId,
  toNode: WorkflowNodeId,
  visitedNodes: WorkflowNodeId[],
  metadata?: WorkflowMetadata
): { allowed: boolean; reason?: string } {
  // Check if target node is accessible based on visited nodes
  if (!isNodeAccessible(toNode, visitedNodes)) {
    return {
      allowed: false,
      reason: getInaccessibilityReason(toNode, visitedNodes) || 'Node is not accessible',
    };
  }

  // Check if host has enabled this node (if metadata provided)
  if (metadata) {
    const enabledByHost = isNodeEnabledByHost(toNode, metadata);
    if (!enabledByHost) {
      return {
        allowed: false,
        reason: 'This section has not been enabled by the host yet',
      };
    }
  }

  return { allowed: true };
}
