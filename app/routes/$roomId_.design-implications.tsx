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

  useEffect(() => {
    if (user?.email) {
      setUserId(user.id);
      setUsername(user.email.split('@')[0]);
    }
  }, [user]);

  // Show auth modal if not authenticated
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bolt-elements-bg-depth-1">
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

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }
    if (!authReady || !userId) return;
    initializeWorkflow(roomId, userId);
    return () => cleanup();
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  useEffect(() => {
    if (!roomId || !authReady || !username) return;

    const fetchToken = async () => {
      try {
        const resp = await fetch(`/api/meet/token?room=${roomId}&username=${username}`);
        if (!resp.ok) throw new Error('Failed to get token');
        const data = await resp.json() as { token?: string; url?: string; error?: string };
        if (data.error) throw new Error(data.error);
        setToken(data.token || '');
        setServerUrl(data.url || '');
      } catch (e) {
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
          <div className="h-screen flex flex-col overflow-hidden bg-bolt-elements-bg-depth-1">
            <VideoTileStrip
              token={token}
              serverUrl={serverUrl}
              roomName={roomId}
            >
              <MeetingAuthProvider>
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Header - glass */}
                  <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-white/10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm">
                    <div>
                      <h1 className="text-2xl font-bold text-bolt-elements-textPrimary flex items-center gap-2">
                        <span className="text-3xl" aria-hidden>💡</span>
                        Design Implications
                      </h1>
                      <p className="text-sm text-bolt-elements-textSecondary mt-0.5">
                        Room: <span className="font-mono font-semibold">{roomId}</span> | User:{' '}
                        <span className="font-semibold">{username}</span>
                      </p>
                    </div>
                    <p className="text-sm text-bolt-elements-textTertiary max-w-xs text-right">
                      AI-generated implications from your meeting transcript
                    </p>
                  </div>

                  {/* Instructions Banner - accent glass */}
                  <div className="px-6 py-3 flex-shrink-0 border-b border-accent-500/20 bg-accent-500/10 backdrop-blur-sm">
                    <p className="text-sm text-bolt-elements-textPrimary">
                      <strong>All participants</strong> can edit, add, or remove design implications below.
                      Once everyone is satisfied, proceed to the design stage.
                    </p>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ClientOnly fallback={<div className="flex items-center justify-center h-64 text-bolt-elements-textSecondary">Loading...</div>}>
                      {() => (
                        <DesignImplicationsPanel roomId={roomId} readOnly={false} />
                      )}
                    </ClientOnly>
                  </div>

                  {/* Navigation Footer - glass + gradient CTAs */}
                  <div className="px-6 py-4 flex-shrink-0 border-t border-white/10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <button
                        type="button"
                        onClick={handleBackToMeeting}
                        className="px-5 py-2.5 rounded-xl font-medium bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary border border-bolt-elements-borderColor hover:bg-bolt-elements-bg-depth-4 hover:border-accent-500/30 transition-all duration-200"
                      >
                        <span>← Back to Meeting</span>
                      </button>

                      <p className="text-sm text-bolt-elements-textTertiary text-center order-last w-full sm:order-none sm:w-auto">
                        Use the <span className="font-semibold">Workflow</span> button in the video bar for full navigation
                      </p>

                      <button
                        type="button"
                        onClick={handleContinueToDesign}
                        className="px-5 py-2.5 rounded-xl font-medium bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:from-green-500 hover:to-emerald-400 transition-all duration-300 flex items-center gap-2"
                      >
                        <span>Continue to Design</span>
                        <span aria-hidden>→</span>
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
