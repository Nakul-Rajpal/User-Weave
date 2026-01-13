/**
 * Route Guard Component
 * Checks if a workflow node is accessible (both visited requirements AND host-enabled)
 * Shows blocked message if not accessible
 */

import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import type { WorkflowNodeId } from '~/types/workflow';

interface RouteGuardProps {
  nodeId: WorkflowNodeId;
  roomId: string;
  children: React.ReactNode;
}

export default function RouteGuard({ nodeId, roomId, children }: RouteGuardProps) {
  const navigate = useNavigate();
  const { isNodeAccessible, isNodeEnabled, isHost, workflowState } = useWorkflowStore();
  const [checkComplete, setCheckComplete] = useState(false);

  const accessible = isNodeAccessible(nodeId);
  const enabled = isNodeEnabled(nodeId);
  const fullyAccessible = accessible && enabled;

  // Debug logging
  useEffect(() => {
    if (checkComplete && workflowState) {
      console.log('🔒 [RouteGuard] Access check for node:', nodeId, {
        accessible,
        enabled,
        fullyAccessible,
        visitedNodes: workflowState.visitedNodes,
        metadata: workflowState.metadata,
        metadataType: typeof workflowState.metadata,
        enabledNodes: workflowState.metadata?.enabledNodes,
      });
    }
  }, [checkComplete, nodeId, accessible, enabled, fullyAccessible, workflowState]);

  useEffect(() => {
    // Allow a brief moment for workflow state to load
    const timer = setTimeout(() => {
      setCheckComplete(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (!checkComplete) {
    // Loading state
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-xl font-semibold text-gray-700">Checking access...</div>
        </div>
      </div>
    );
  }

  if (!fullyAccessible) {
    // Blocked state
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h1>

          {!accessible && (
            <p className="text-gray-600 mb-6">
              You need to complete previous sections before accessing this page.
            </p>
          )}

          {accessible && !enabled && (
            <>
              <p className="text-gray-600 mb-2">
                The host has not enabled this section yet.
              </p>
              {!isHost && (
                <p className="text-sm text-gray-500 mb-6">
                  Please wait for the host to enable access.
                </p>
              )}
              {isHost && (
                <p className="text-sm text-gray-500 mb-6">
                  Go to the workflow page and enable this section in the Host Control Panel.
                </p>
              )}
            </>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/meet/${roomId}/workflow`)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              🔀 View Workflow
            </button>
            <button
              onClick={() => navigate(`/meet/${roomId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              📹 Back to Meeting
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Accessible - render children
  return <>{children}</>;
}
