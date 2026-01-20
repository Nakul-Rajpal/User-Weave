/**
 * Workflow Route
 * Displays the ReactFlow workflow canvas for meeting navigation
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import WorkflowCanvas from '~/components/meet/WorkflowCanvas';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
// Note: React Flow CSS is loaded globally in root.tsx to ensure
// it's available during client-side navigation

export default function WorkflowPage() {
  const params = useParams();
  const navigate = useNavigate();
  const roomId = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const authReady = !!user && !authLoading;
  const [userId, setUserId] = useState('');

  const { initializeWorkflow, cleanup, error } = useWorkflowStore();

  // Set userId from authenticated user
  useEffect(() => {
    if (user?.id) {
      console.log('✅ [WORKFLOW] Using authenticated user:', user.id);
      setUserId(user.id);
    }
  }, [user]);

  // Show auth modal if not authenticated
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bolt-elements-background-depth-1">
        <div className="max-w-md w-full p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">
              Login Required
            </h1>
            <p className="text-bolt-elements-textSecondary">
              Please sign in to access the workflow page
            </p>
          </div>
          <Auth />
        </div>
      </div>
    );
  }

  // Initialize workflow after auth is ready
  useEffect(() => {
    if (!roomId) {
      navigate('/meet');
      return;
    }

    if (authLoading || !user || !userId) {
      console.log('⏳ [WORKFLOW] Waiting for auth...', { authLoading, hasUser: !!user, hasUserId: !!userId });
      return;
    }

    console.log('🔄 [WORKFLOW] Initializing workflow state...');
    initializeWorkflow(roomId, userId);

    // Cleanup on unmount
    return () => {
      console.log('🧹 [WORKFLOW] Cleaning up workflow state...');
      cleanup();
    };
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl font-semibold text-red-700 mb-2">Error</div>
          <div className="text-sm text-red-600">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!authReady || !userId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-xl font-semibold text-gray-700">Initializing workflow...</div>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-xl font-semibold text-gray-700">Loading workflow...</div>
        </div>
      </div>
    }>
      {() => <WorkflowCanvas roomId={roomId} />}
    </ClientOnly>
  );
}
