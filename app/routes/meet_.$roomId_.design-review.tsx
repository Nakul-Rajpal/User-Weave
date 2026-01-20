/**
 * Design Review Page
 * Allows all participants to review and edit design implications (summary points)
 * before proceeding to the coding stage
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import RouteGuard from '~/components/meet/RouteGuard';
import TranscriptSummaryPanel from '~/components/meet/TranscriptSummaryPanel';
import VideoTileStrip from '~/components/meet/VideoTileStrip';
import { MeetingAuthProvider } from '~/components/meet/MeetingAuthProvider';

export default function DesignReviewPage() {
  const params = useParams();
  const navigate = useNavigate();
  const roomId = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const authReady = !!user && !authLoading;
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  const { initializeWorkflow, cleanup, isHost, navigateToNode } = useWorkflowStore();

  // Set username from authenticated user
  useEffect(() => {
    if (user?.email) {
      const displayName = user.email.split('@')[0];
      console.log('✅ [DESIGN-REVIEW] Using authenticated user:', {
        userId: user.id,
        email: user.email,
        displayName,
      });
      setUserId(user.id);
      setUsername(displayName);
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
              Please sign in to access the design review page
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

    if (!authReady || !userId) {
      console.log('⏳ [DESIGN-REVIEW] Waiting for auth...', { authReady, hasUserId: !!userId });
      return;
    }

    console.log('🔄 [DESIGN-REVIEW] Initializing workflow state...');
    initializeWorkflow(roomId, userId);

    // Cleanup on unmount
    return () => {
      console.log('🧹 [DESIGN-REVIEW] Cleaning up workflow state...');
      cleanup();
    };
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  // Fetch LiveKit token after auth is ready
  useEffect(() => {
    console.log('🔑 [DESIGN-REVIEW] Token fetch effect triggered:', { roomId, authReady, username });

    if (!roomId) {
      console.log('❌ [DESIGN-REVIEW] No room ID');
      return;
    }

    // Don't fetch token until auth is ready
    if (!authReady || !username) {
      console.log('⏳ [DESIGN-REVIEW] Waiting for auth...', { authReady, hasUsername: !!username });
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('📡 [DESIGN-REVIEW] Fetching LiveKit token for:', { roomId, username });

        const resp = await fetch(
          `/api/meet/token?room=${roomId}&username=${username}`
        );

        console.log('📥 [DESIGN-REVIEW] Token response status:', resp.status);

        if (!resp.ok) {
          throw new Error('Failed to get token');
        }

        const data = await resp.json() as { token?: string; url?: string; error?: string };
        console.log('📦 [DESIGN-REVIEW] Token data received:', { hasToken: !!data.token, hasUrl: !!data.url, error: data.error });

        if (data.error) {
          throw new Error(data.error);
        }

        setToken(data.token || '');
        setServerUrl(data.url || '');
        console.log('✅ [DESIGN-REVIEW] Token and server URL set successfully');
      } catch (e) {
        console.error('❌ [DESIGN-REVIEW] Token fetch error:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect to video');
      }
    };

    fetchToken();
  }, [roomId, authReady, username]);

  // Navigate back to poll
  const handleBackToPoll = () => {
    if (isHost) {
      navigateToNode('poll');
    }
    navigate(`/meet/${roomId}/poll`);
  };

  // Navigate to coding
  const handleContinueToCoding = () => {
    if (isHost) {
      navigateToNode('coding');
    }
    navigate(`/meet/${roomId}/code`);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl font-semibold text-red-700 mb-2">Error</div>
          <div className="text-sm text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!authReady || !token || !serverUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-xl font-semibold text-gray-700">
            {!authReady && 'Authenticating...'}
            {authReady && !username && 'Loading identity...'}
            {authReady && username && !token && 'Connecting to video...'}
            {authReady && username && token && !serverUrl && 'Finalizing connection...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      {() => (
        <RouteGuard nodeId="design-review" roomId={roomId}>
          <div className="h-screen flex flex-col">
            <VideoTileStrip
              token={token}
              serverUrl={serverUrl}
              roomName={roomId}
            >
              <MeetingAuthProvider>
                <div className="flex flex-col bg-gradient-to-br from-orange-50 to-amber-50" style={{ height: 'calc(100vh - 8rem)' }}>
                  {/* Header */}
                  <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-3xl">📝</span>
                        Design Review
                      </h1>
                      <p className="text-sm text-gray-600">
                        Room: <span className="font-mono font-semibold">{roomId}</span> | User:{' '}
                        <span className="font-semibold">{username}</span>
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      Review and finalize design implications before coding
                    </div>
                  </div>

                  {/* Instructions Banner */}
                  <div className="bg-orange-100 border-b border-orange-200 px-6 py-3">
                    <p className="text-sm text-orange-800">
                      <strong>All participants</strong> can edit, add, or remove design points below.
                      Once everyone is satisfied, proceed to the coding stage.
                    </p>
                  </div>

                  {/* Main Content - Summary Panel with Edit Access */}
                  <div className="flex-1 overflow-auto">
                    <ClientOnly fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
                      {() => (
                        <TranscriptSummaryPanel roomId={roomId} readOnly={false} />
                      )}
                    </ClientOnly>
                  </div>

                  {/* Navigation Footer */}
                  <div className="bg-white border-t border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleBackToPoll}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
                      >
                        <span>←</span>
                        <span>Back to Idea Generation</span>
                      </button>

                      <p className="text-sm text-gray-500">
                        Use the <span className="font-semibold">Workflow</span> button in the video bar for full navigation
                      </p>

                      <button
                        onClick={handleContinueToCoding}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
                      >
                        <span>Continue to Coding</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </MeetingAuthProvider>
            </VideoTileStrip>
          </div>
        </RouteGuard>
      )}
    </ClientOnly>
  );
}
