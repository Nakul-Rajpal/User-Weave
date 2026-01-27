/**
 * Design Implications Page
 * AI-generated design implications from meeting transcript
 * All participants can edit, add, or remove design points
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import RouteGuard from '~/components/meet/RouteGuard';
import DesignImplicationsPanel from '~/components/meet/DesignImplicationsPanel';
import VideoTileStrip from '~/components/meet/VideoTileStrip';
import { MeetingAuthProvider } from '~/components/meet/MeetingAuthProvider';

export default function DesignImplicationsPage() {
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
      console.log('[DESIGN-IMPLICATIONS] Using authenticated user:', {
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
              Please sign in to access the design implications page
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
      navigate('/');
      return;
    }

    if (!authReady || !userId) {
      console.log('[DESIGN-IMPLICATIONS] Waiting for auth...', { authReady, hasUserId: !!userId });
      return;
    }

    console.log('[DESIGN-IMPLICATIONS] Initializing workflow state...');
    initializeWorkflow(roomId, userId);

    // Cleanup on unmount
    return () => {
      console.log('[DESIGN-IMPLICATIONS] Cleaning up workflow state...');
      cleanup();
    };
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  // Fetch LiveKit token after auth is ready
  useEffect(() => {
    console.log('[DESIGN-IMPLICATIONS] Token fetch effect triggered:', { roomId, authReady, username });

    if (!roomId) {
      console.log('[DESIGN-IMPLICATIONS] No room ID');
      return;
    }

    // Don't fetch token until auth is ready
    if (!authReady || !username) {
      console.log('[DESIGN-IMPLICATIONS] Waiting for auth...', { authReady, hasUsername: !!username });
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('[DESIGN-IMPLICATIONS] Fetching LiveKit token for:', { roomId, username });

        const resp = await fetch(
          `/api/meet/token?room=${roomId}&username=${username}`
        );

        console.log('[DESIGN-IMPLICATIONS] Token response status:', resp.status);

        if (!resp.ok) {
          throw new Error('Failed to get token');
        }

        const data = await resp.json() as { token?: string; url?: string; error?: string };
        console.log('[DESIGN-IMPLICATIONS] Token data received:', { hasToken: !!data.token, hasUrl: !!data.url, error: data.error });

        if (data.error) {
          throw new Error(data.error);
        }

        setToken(data.token || '');
        setServerUrl(data.url || '');
        console.log('[DESIGN-IMPLICATIONS] Token and server URL set successfully');
      } catch (e) {
        console.error('[DESIGN-IMPLICATIONS] Token fetch error:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect to video');
      }
    };

    fetchToken();
  }, [roomId, authReady, username]);

  // Navigate back to meeting
  const handleBackToMeeting = () => {
    if (isHost) {
      navigateToNode('meeting');
    }
    navigate(`/${roomId}`);
  };

  // Navigate to design stage
  const handleContinueToDesign = () => {
    if (isHost) {
      navigateToNode('design');
    }
    navigate(`/${roomId}/design`);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center">
          <div className="text-4xl mb-4">Error</div>
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
          <div className="text-4xl mb-4">Loading...</div>
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
        <RouteGuard nodeId="design-implications" roomId={roomId}>
          <div className="h-screen flex flex-col overflow-hidden bg-white">
            <VideoTileStrip
              token={token}
              serverUrl={serverUrl}
              roomName={roomId}
            >
              <MeetingAuthProvider>
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Header */}
                  <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-3xl">💡</span>
                        Design Implications
                      </h1>
                      <p className="text-sm text-gray-600">
                        Room: <span className="font-mono font-semibold">{roomId}</span> | User:{' '}
                        <span className="font-semibold">{username}</span>
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      AI-generated implications from your meeting transcript
                    </div>
                  </div>

                  {/* Instructions Banner */}
                  <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex-shrink-0">
                    <p className="text-sm text-blue-800">
                      <strong>All participants</strong> can edit, add, or remove design implications below.
                      Once everyone is satisfied, proceed to the design stage.
                    </p>
                  </div>

                  {/* Main Content - Design Implications Panel with Edit Access for Everyone */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ClientOnly fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
                      {() => (
                        <DesignImplicationsPanel roomId={roomId} readOnly={false} />
                      )}
                    </ClientOnly>
                  </div>

                  {/* Navigation Footer */}
                  <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleBackToMeeting}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
                      >
                        <span>Back to Meeting</span>
                      </button>

                      <p className="text-sm text-gray-500">
                        Use the <span className="font-semibold">Workflow</span> button in the video bar for full navigation
                      </p>

                      <button
                        onClick={handleContinueToDesign}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
                      >
                        <span>Continue to Design</span>
                        <span>-&gt;</span>
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
