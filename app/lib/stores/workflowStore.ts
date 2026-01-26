/**
 * Workflow Store
 * Manages workflow state with Supabase real-time synchronization
 */

import { create } from 'zustand';
import type { WorkflowNodeId, WorkflowState } from '~/types/workflow';
import { supabase } from '~/lib/supabase/client';
import { WorkflowManager } from '~/lib/workflow/workflowManager';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface WorkflowStoreState {
  // State
  workflowState: WorkflowState | null;
  isLoading: boolean;
  error: string | null;
  isHost: boolean;
  currentUserId: string | null;
  realtimeChannel: RealtimeChannel | null;

  // Actions
  initializeWorkflow: (roomId: string, userId: string) => Promise<void>;
  navigateToNode: (nodeId: WorkflowNodeId) => Promise<void>;
  updateMetadata: (metadata: Record<string, any>) => Promise<void>;
  toggleNodeEnabled: (nodeId: WorkflowNodeId) => Promise<void>;
  cleanup: () => void;
  subscribeToRealtimeUpdates: (roomId: string) => void;
  unsubscribeFromRealtime: () => void;

  // Helpers
  isNodeAccessible: (nodeId: WorkflowNodeId) => boolean;
  isNodeVisited: (nodeId: WorkflowNodeId) => boolean;
  isNodeEnabled: (nodeId: WorkflowNodeId) => boolean;
  getEnabledNodes: () => WorkflowNodeId[];
}

export const useWorkflowStore = create<WorkflowStoreState>((set, get) => ({
  // Initial state
  workflowState: null,
  isLoading: false,
  error: null,
  isHost: false,
  currentUserId: null,
  realtimeChannel: null,

  /**
   * Initialize workflow for a room
   * Creates workflow state if it doesn't exist, or loads existing state
   */
  initializeWorkflow: async (roomId: string, userId: string) => {
    set({ isLoading: true, error: null, currentUserId: userId });

    try {
      // Check if workflow state exists for this room
      const { data: existingState, error: fetchError } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = not found, which is okay
        throw fetchError;
      }

      if (existingState) {
        // Workflow state exists, load it
        const state: WorkflowState = {
          id: existingState.id,
          roomId: existingState.room_id,
          currentNode: existingState.current_node as WorkflowNodeId,
          hostUserId: existingState.host_user_id,
          visitedNodes: existingState.visited_nodes as WorkflowNodeId[],
          metadata: existingState.metadata || {},
          createdAt: existingState.created_at,
          updatedAt: existingState.updated_at,
        };

        set({
          workflowState: state,
          isHost: userId === existingState.host_user_id,
          isLoading: false,
        });
      } else {
        // Create new workflow state (this user is the host)
        // Initialize with all controllable nodes enabled by default
        const { data: newState, error: createError } = await supabase
          .from('workflow_states')
          .insert({
            room_id: roomId,
            current_node: 'meeting',
            host_user_id: userId,
            visited_nodes: ['meeting'],
            metadata: {
              enabledNodes: ['design-implications', 'design', 'rating', 'winner'] as WorkflowNodeId[],
            },
          })
          .select()
          .single();

        if (createError) throw createError;

        const state: WorkflowState = {
          id: newState.id,
          roomId: newState.room_id,
          currentNode: newState.current_node as WorkflowNodeId,
          hostUserId: newState.host_user_id,
          visitedNodes: newState.visited_nodes as WorkflowNodeId[],
          metadata: newState.metadata || {},
          createdAt: newState.created_at,
          updatedAt: newState.updated_at,
        };

        set({
          workflowState: state,
          isHost: true,
          isLoading: false,
        });
      }

      // Subscribe to real-time updates
      get().subscribeToRealtimeUpdates(roomId);
    } catch (error: any) {
      console.error('Error initializing workflow:', error);
      set({
        error: error.message || 'Failed to initialize workflow',
        isLoading: false,
      });
    }
  },

  /**
   * Navigate to a different node
   * Admin permissions checked at UI level before calling this function
   */
  navigateToNode: async (nodeId: WorkflowNodeId) => {
    const { workflowState } = get();

    if (!workflowState) {
      set({ error: 'Workflow not initialized' });
      return;
    }

    // Check if node is accessible
    const accessible = get().isNodeAccessible(nodeId);
    if (!accessible) {
      set({ error: 'This node is not yet accessible' });
      return;
    }

    try {
      // Add node to visited nodes if not already there
      const updatedVisitedNodes = WorkflowManager.addVisitedNode(
        workflowState.visitedNodes,
        nodeId
      );

      // Update in database
      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({
          current_node: nodeId,
          visited_nodes: updatedVisitedNodes,
        })
        .eq('room_id', workflowState.roomId);

      if (updateError) throw updateError;

      // Local state will be updated via real-time subscription
    } catch (error: any) {
      console.error('Error navigating to node:', error);
      set({ error: error.message || 'Failed to navigate' });
    }
  },

  /**
   * Update workflow metadata (e.g., poll results)
   */
  updateMetadata: async (metadata: Record<string, any>) => {
    const { workflowState } = get();

    if (!workflowState) {
      set({ error: 'Workflow not initialized' });
      return;
    }

    try {
      const updatedMetadata = {
        ...workflowState.metadata,
        ...metadata,
      };

      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({ metadata: updatedMetadata })
        .eq('room_id', workflowState.roomId);

      if (updateError) throw updateError;

      // Local state will be updated via real-time subscription
    } catch (error: any) {
      console.error('Error updating metadata:', error);
      set({ error: error.message || 'Failed to update metadata' });
    }
  },

  /**
   * Toggle a node's enabled status (Admin only)
   * Admin permissions checked at UI level before calling this function
   * Adds or removes a node from the enabledNodes list
   */
  toggleNodeEnabled: async (nodeId: WorkflowNodeId) => {
    const { workflowState } = get();

    if (!workflowState) {
      set({ error: 'Workflow not initialized' });
      return;
    }

    try {
      const currentEnabledNodes = workflowState.metadata.enabledNodes || [];
      let updatedEnabledNodes: WorkflowNodeId[];

      if (currentEnabledNodes.includes(nodeId)) {
        // Remove from enabled list (disable)
        updatedEnabledNodes = currentEnabledNodes.filter(n => n !== nodeId);
      } else {
        // Add to enabled list (enable)
        updatedEnabledNodes = [...currentEnabledNodes, nodeId];
      }

      // Update metadata with new enabled nodes
      const updatedMetadata = {
        ...workflowState.metadata,
        enabledNodes: updatedEnabledNodes,
      };

      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({ metadata: updatedMetadata })
        .eq('room_id', workflowState.roomId);

      if (updateError) throw updateError;

      console.log(`Node ${nodeId} ${updatedEnabledNodes.includes(nodeId) ? 'enabled' : 'disabled'}`);

      // Local state will be updated via real-time subscription
    } catch (error: any) {
      console.error('Error toggling node enabled status:', error);
      set({ error: error.message || 'Failed to toggle node' });
    }
  },

  /**
   * Subscribe to real-time updates for workflow state
   */
  subscribeToRealtimeUpdates: (roomId: string) => {
    const { realtimeChannel } = get();

    // Unsubscribe from existing channel if any
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    // Create new channel
    const channel = supabase
      .channel(`workflow:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_states',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          console.log('Workflow state changed:', payload);

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newData = payload.new;
            const { currentUserId } = get();

            const state: WorkflowState = {
              id: newData.id,
              roomId: newData.room_id,
              currentNode: newData.current_node as WorkflowNodeId,
              hostUserId: newData.host_user_id,
              visitedNodes: newData.visited_nodes as WorkflowNodeId[],
              metadata: newData.metadata || {},
              createdAt: newData.created_at,
              updatedAt: newData.updated_at,
            };

            set({
              workflowState: state,
              isHost: currentUserId === newData.host_user_id,
            });
          } else if (payload.eventType === 'DELETE') {
            set({ workflowState: null, isHost: false });
          }
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromRealtime: () => {
    const { realtimeChannel } = get();

    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      set({ realtimeChannel: null });
    }
  },

  /**
   * Clean up workflow state
   */
  cleanup: () => {
    get().unsubscribeFromRealtime();
    set({
      workflowState: null,
      isLoading: false,
      error: null,
      isHost: false,
      currentUserId: null,
      realtimeChannel: null,
    });
  },

  /**
   * Check if a node is accessible based on visited nodes
   */
  isNodeAccessible: (nodeId: WorkflowNodeId) => {
    const { workflowState } = get();
    if (!workflowState) return false;

    const visitedNodes = workflowState.visitedNodes;
    return WorkflowManager.getNodesAccessibility(visitedNodes)[nodeId].accessible;
  },

  /**
   * Check if a node has been visited
   */
  isNodeVisited: (nodeId: WorkflowNodeId) => {
    const { workflowState } = get();
    if (!workflowState) return false;

    return workflowState.visitedNodes.includes(nodeId);
  },

  /**
   * Check if a node is enabled by the host
   */
  isNodeEnabled: (nodeId: WorkflowNodeId) => {
    const { workflowState } = get();
    if (!workflowState) return false;

    // Meeting and exit are ALWAYS enabled (not controlled by host)
    if (nodeId === 'meeting' || nodeId === 'exit') {
      return true;
    }

    const enabledNodes = workflowState.metadata.enabledNodes;

    // If enabledNodes is not set, all nodes are disabled
    if (!enabledNodes) {
      return false;
    }

    // Check if the node is in the enabled nodes array
    return enabledNodes.includes(nodeId);
  },

  /**
   * Get list of enabled nodes
   */
  getEnabledNodes: () => {
    const { workflowState } = get();
    if (!workflowState) return [];

    return workflowState.metadata.enabledNodes || [];
  },
}));

// Export helper hooks for common operations
export function useCurrentNode(): WorkflowNodeId | null {
  return useWorkflowStore((state) => state.workflowState?.currentNode || null);
}

export function useIsHost(): boolean {
  return useWorkflowStore((state) => state.isHost);
}

export function useWorkflowLoading(): boolean {
  return useWorkflowStore((state) => state.isLoading);
}

export function useWorkflowError(): string | null {
  return useWorkflowStore((state) => state.error);
}
