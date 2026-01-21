/**
 * Discussion Points Page (formerly Poll Page)
 * Shows discussion points with admin controls
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
import { supabase } from '~/lib/supabase/client';

export default function SummaryDiscussionPage() {
  const params = useParams();
  const navigate = useNavigate();
  const roomId = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const authReady = !!user && !authLoading;
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  // Removed activeTab state - only showing discussion points now
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const { initializeWorkflow, cleanup } = useWorkflowStore();

  // Check if current user is global admin
  const checkAdminStatus = async () => {
    // Check localStorage first (fast)
    const localAdminStatus = localStorage.getItem('isAdmin');
    if (localAdminStatus === 'true') {
      setIsAdmin(true);
    }

    // Always verify with server
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/meet/check-admin', { headers });
      const data = await response.json();

      setIsAdmin(data.isAdmin);

      if (data.isAdmin) {
        localStorage.setItem('isAdmin', 'true');
      } else {
        localStorage.removeItem('isAdmin');
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
      localStorage.removeItem('isAdmin');
    }
  };

  // Set username from authenticated user
  useEffect(() => {
    if (user?.email) {
      const displayName = user.email.split('@')[0];
      console.log('✅ [SUMMARY] Using authenticated user:', {
        userId: user.id,
        email: user.email,
        displayName,
      });
      setUserId(user.id);
      setUsername(displayName);

      // Check admin status
      checkAdminStatus();
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
              Please sign in to access the summary discussion page
            </p>
          </div>
          <Auth />
        </div>
      </div>
    );
  }

  // Old auth initialization code - replaced with useAuth()
  // useEffect(() => {
  //   console.log('🔐 [POLL] Initializing meeting authentication...');
  //   initializeMeetingAuth()
  //     .then(({ uuid, username, session }) => {
  //       console.log('✅ [POLL] Auth initialized:', {
  //         uuid,
  //         username,
  //         sessionUserId: session.user.id,
  //       });
  //       setUserId(session.user.id);
  //       setUsername(username);
  //       setAuthReady(true);
  //     })
  //     .catch((error) => {
  //       console.error('❌ [POLL] Auth initialization failed:', error);
  //       setError('Failed to initialize authentication. Please refresh the page.');
  //       setAuthReady(false);
  //     });
  // }, []);

  // Initialize workflow after auth is ready
  useEffect(() => {
    if (!roomId) {
      navigate('/meet');
      return;
    }

    if (!authReady || !userId) {
      console.log('⏳ [POLL] Waiting for auth...', { authReady, hasUserId: !!userId });
      return;
    }

    console.log('🔄 [POLL] Initializing workflow state...');
    initializeWorkflow(roomId, userId);

    // Cleanup on unmount
    return () => {
      console.log('🧹 [POLL] Cleaning up workflow state...');
      cleanup();
    };
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  // Fetch LiveKit token after auth is ready
  useEffect(() => {
    console.log('🔑 [POLL] Token fetch effect triggered:', { roomId, authReady, username });

    if (!roomId) {
      console.log('❌ [POLL] No room ID');
      return;
    }

    // Don't fetch token until auth is ready
    if (!authReady || !username) {
      console.log('⏳ [POLL] Waiting for auth...', { authReady, hasUsername: !!username });
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('📡 [POLL] Fetching LiveKit token for:', { roomId, username });

        const resp = await fetch(
          `/api/meet/token?room=${roomId}&username=${username}`
        );

        console.log('📥 [POLL] Token response status:', resp.status);

        if (!resp.ok) {
          throw new Error('Failed to get token');
        }

        const data = await resp.json() as { token?: string; url?: string; error?: string };
        console.log('📦 [POLL] Token data received:', { hasToken: !!data.token, hasUrl: !!data.url, error: data.error });

        if (data.error) {
          throw new Error(data.error);
        }

        setToken(data.token || '');
        setServerUrl(data.url || '');
        console.log('✅ [POLL] Token and server URL set successfully');
      } catch (e) {
        console.error('❌ [POLL] Token fetch error:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect to video');
      }
    };

    fetchToken();
  }, [roomId, authReady, username]);

  // Navigate to workflow
  const handleNavigateToWorkflow = () => {
    navigate(`/meet/${roomId}/workflow`);
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
        <RouteGuard nodeId="poll" roomId={roomId}>
          <div className="h-screen flex flex-col">
            <VideoTileStrip
              token={token}
              serverUrl={serverUrl}
              roomName={roomId}
            >
              <MeetingAuthProvider>
                <div className="flex flex-col bg-gradient-to-br from-purple-50 to-blue-50" style={{ height: 'calc(100vh - 8rem)' }}>
                  {/* Header */}
                  <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-3xl">📋</span>
                        Summary Discussion
                        {isAdmin && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500 text-white rounded uppercase">
                            ADMIN
                          </span>
                        )}
                      </h1>
                      <p className="text-sm text-gray-600">
                        Room: <span className="font-mono font-semibold">{roomId}</span> | User:{' '}
                        <span className="font-semibold">{username}</span>
                      </p>
                    </div>
                  </div>

                  {/* Main Content - Discussion Points Only */}
                  <div className="flex-1 overflow-auto">
                    <ClientOnly fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
                      {() => (
                        <TranscriptSummaryPanel roomId={roomId} readOnly={!isAdmin} />
                      )}
                    </ClientOnly>
                  </div>

                  {/* Footer Instructions */}
                  <div className="bg-white border-t border-gray-200 px-6 py-4">
                    <p className="text-sm text-gray-600 text-center">
                      Use the <span className="font-semibold">Workflow</span> button in the video bar to navigate between
                      different meeting stages
                    </p>
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

