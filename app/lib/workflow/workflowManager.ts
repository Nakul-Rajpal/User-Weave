/**
 * Workflow Manager
 * Central manager for workflow operations
 */

import type { WorkflowNodeId, WorkflowNavigationContext } from '~/types/workflow';
import { getNodeRoute, getNodeById } from './nodeDefinitions';
import { isNodeAccessible, canNavigate, getInaccessibilityReason } from './conditionalAccess';

export class WorkflowManager {
  /**
   * Validate navigation request
   */
  static validateNavigation(
    roomId: string,
    userId: string,
    currentNode: WorkflowNodeId,
    targetNode: WorkflowNodeId,
    visitedNodes: WorkflowNodeId[]
  ): WorkflowNavigationContext {
    const accessible = isNodeAccessible(targetNode, visitedNodes);
    const { allowed, reason } = canNavigate(currentNode, targetNode, visitedNodes);

    return {
      roomId,
      userId,
      currentNode,
      targetNode,
      isAccessible: accessible && allowed,
      reason: !allowed ? reason : undefined,
    };
  }

  /**
   * Get route for navigation
   */
  static getNavigationRoute(nodeId: WorkflowNodeId, roomId: string): string {
    return getNodeRoute(nodeId, roomId);
  }

  /**
   * Check if node exists
   */
  static isValidNode(nodeId: string): nodeId is WorkflowNodeId {
    const validNodes: WorkflowNodeId[] = ['meeting', 'poll', 'coding', 'code-review', 'exit'];
    return validNodes.includes(nodeId as WorkflowNodeId);
  }

  /**
   * Get node display information
   */
  static getNodeInfo(nodeId: WorkflowNodeId) {
    const node = getNodeById(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    return node;
  }

  /**
   * Get accessibility status for all nodes
   */
  static getNodesAccessibility(visitedNodes: WorkflowNodeId[]): Record<
    WorkflowNodeId,
    {
      accessible: boolean;
      reason?: string;
    }
  > {
    const nodes: WorkflowNodeId[] = ['meeting', 'poll', 'coding', 'code-review', 'exit'];

    const result: any = {};

    nodes.forEach((nodeId) => {
      const accessible = isNodeAccessible(nodeId, visitedNodes);
      result[nodeId] = {
        accessible,
        reason: accessible ? undefined : getInaccessibilityReason(nodeId, visitedNodes),
      };
    });

    return result;
  }

  /**
   * Add node to visited list if not already present
   */
  static addVisitedNode(
    visitedNodes: WorkflowNodeId[],
    nodeId: WorkflowNodeId
  ): WorkflowNodeId[] {
    if (visitedNodes.includes(nodeId)) {
      return visitedNodes;
    }
    return [...visitedNodes, nodeId];
  }
}
