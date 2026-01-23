/**
 * Rating Page
 * Displays all users' submitted designs with voting functionality
 * Allows users to upvote/downvote designs and leave comments
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@remix-run/react';
import { json } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import { workbenchStore } from '~/lib/stores/workbench';
import RouteGuard from '~/components/meet/RouteGuard';
import VideoTileStrip from '~/components/meet/VideoTileStrip';
import { MeetingAuthProvider } from '~/components/meet/MeetingAuthProvider';
import { CodeReviewSidebar } from '~/components/final-versions/CodeReviewSidebar';
import type { FinalVersionWithDetails } from '~/lib/persistence/supabase';
import { getAllFinalVersions } from '~/lib/persistence/supabase';
import { supabase } from '~/lib/supabase/client';
import type { FinalVersionVoteType, VoteData } from '~/types/final-versions';
import { toast, ToastContainer } from 'react-toastify';
import { loadFinalVersionFiles } from '~/utils/finalVersionsLoader';
import { Workbench } from '~/components/workbench/Workbench.client';

// Loader required for Workbench component (uses useLoaderData internally)
export const loader = () => json({});

export default function RatingPage() {
  const params = useParams();
  const navigate = useNavigate();
  const roomId = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const authReady = !!user && !authLoading;

  // Auth state
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  // LiveKit state
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  // Final versions and votes state
  const [finalVersions, setFinalVersions] = useState<FinalVersionWithDetails[]>([]);
  const [votes, setVotes] = useState<Record<string, VoteData>>({});
  const [loading, setLoading] = useState(true);
  const [loadingVotes, setLoadingVotes] = useState(false);

  // Workbench state
  const [selectedVersion, setSelectedVersion] = useState<FinalVersionWithDetails | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading workspace...');

  const { initializeWorkflow, cleanup, isHost, navigateToNode } = useWorkflowStore();

  // Set username and userId from authenticated user
  useEffect(() => {
    if (user?.email) {
      const displayName = user.email.split('@')[0];
      console.log('[RATING] Using authenticated user:', {
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
              Please sign in to access design rating
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
      console.log('[RATING] Waiting for auth...', { authReady, hasUserId: !!userId });
      return;
    }

    console.log('[RATING] Initializing workflow state...');
    initializeWorkflow(roomId, userId);

    // Cleanup on unmount
    return () => {
      console.log('[RATING] Cleaning up workflow state...');
      cleanup();
    };
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  // Fetch LiveKit token after auth is ready
  useEffect(() => {
    console.log('[RATING] Token fetch effect triggered:', { roomId, authReady, username });

    if (!roomId || !authReady || !username) {
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('[RATING] Fetching LiveKit token...');

        const resp = await fetch(`/api/meet/token?room=${roomId}&username=${username}`);

        if (!resp.ok) {
          throw new Error('Failed to get token');
        }

        const data = await resp.json() as { token?: string; url?: string; error?: string };

        if (data.error) {
          throw new Error(data.error);
        }

        setToken(data.token || '');
        setServerUrl(data.url || '');
        console.log('[RATING] Token and server URL set successfully');
      } catch (e) {
        console.error('[RATING] Token fetch error:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect to video');
      }
    };

    fetchToken();
  }, [roomId, authReady, username]);

  // Fetch final versions
  useEffect(() => {
    if (!authReady || !userId) {
      console.log('[RATING] Waiting for auth...', { authReady, hasUserId: !!userId });
      return;
    }

    const loadFinalVersions = async () => {
      try {
        setLoading(true);
        console.log('[RATING] Fetching submitted designs...');

        // Verify session exists before fetching
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('[RATING] No session found, cannot fetch versions');
          toast.error('Authentication session not found. Please refresh the page.');
          return;
        }

        console.log('[RATING] Session verified, fetching designs...');
        const versions = await getAllFinalVersions();
        setFinalVersions(versions);
        console.log(`[RATING] Loaded ${versions.length} submitted designs`);
      } catch (err: any) {
        console.error('[RATING] Error loading submitted designs:', err);
        toast.error(`Failed to load submitted designs: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadFinalVersions();
  }, [authReady, userId]);

  // Fetch votes for this room
  useEffect(() => {
    if (!authReady || !roomId) {
      return;
    }

    loadVotes();
  }, [authReady, roomId]);

  const loadVotes = async () => {
    try {
      setLoadingVotes(true);
      console.log('[RATING] Fetching votes for room:', roomId, 'userId:', userId);

      const response = await fetch(`/api/meet/final-version-votes/${roomId}?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setVotes(data.votes || {});
        console.log('[RATING] Votes loaded successfully');
      } else {
        console.error('[RATING] Failed to fetch votes:', data.error);
      }
    } catch (err) {
      console.error('[RATING] Error fetching votes:', err);
    } finally {
      setLoadingVotes(false);
    }
  };

  // Real-time vote updates
  useEffect(() => {
    if (!roomId) {
      return;
    }

    console.log('[RATING] Setting up real-time vote updates...');

    const channel = supabase
      .channel(`rating:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'final_version_votes',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('[RATING] Vote changed, reloading votes...', payload);
          loadVotes();
        }
      )
      .subscribe();

    return () => {
      console.log('[RATING] Cleaning up real-time subscriptions');
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Handle vote submission
  const handleVote = async (versionId: string, vote: FinalVersionVoteType, comment?: string) => {
    try {
      console.log('[RATING] Submitting vote:', { versionId, vote, hasComment: !!comment, userId });

      const response = await fetch('/api/meet/final-version-vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          finalVersionId: versionId,
          roomId,
          vote,
          commentText: comment,
          userId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to vote');
      }

      console.log('[RATING] Vote submitted successfully');
      toast.success('Vote recorded successfully!');

      // Update local votes state
      await loadVotes();
    } catch (err: any) {
      console.error('[RATING] Error voting:', err);
      toast.error(err.message || 'Failed to submit vote');
    }
  };

  // Handle viewing code in workbench
  const handleViewCode = async (version: FinalVersionWithDetails) => {
    console.log('[RATING] View code clicked for version:', version.id);

    setSelectedVersion(version);
    setLoadingFiles(true);
    setLoadingMessage('Loading workspace...');

    try {
      console.log('[RATING] Loading files for version:', version.id);

      // Check if files exist
      if (!version.files || Object.keys(version.files).length === 0) {
        console.warn('[RATING] No files found in version snapshot');
        toast.warning('This design has no files to display');
        setSelectedVersion(null);
        return;
      }

      console.log('[RATING] Found', Object.keys(version.files).length, 'files/folders');

      // loadFinalVersionFiles handles showing/hiding the workbench
      await loadFinalVersionFiles(version.files, (message: string) => {
        console.log('[RATING] Progress:', message);
        setLoadingMessage(message);
      });

      console.log('[RATING] Files loaded successfully');
      toast.success(`${version.userName}'s design is ready!`);
    } catch (err: any) {
      console.error('[RATING] Failed to load files:', err);
      toast.error(`Failed to load design: ${err.message || 'Unknown error'}`);
      setSelectedVersion(null);

      // Hide workbench on error
      workbenchStore.showWorkbench.set(false);
    } finally {
      setLoadingFiles(false);
      setLoadingMessage('Loading workspace...');
    }
  };

  // Navigate to final design page
  const handleViewFinalDesign = () => {
    if (isHost) {
      navigateToNode('winner');
    }
    navigate(`/meet/${roomId}/winner`);
  };

  // Navigate to workflow
  const handleNavigateToWorkflow = () => {
    navigate(`/meet/${roomId}/workflow`);
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
        <RouteGuard nodeId="rating" roomId={roomId}>
          <div className="h-screen flex flex-col bg-gradient-to-br from-amber-50 to-orange-50" data-meeting-rating-mode="true">
            <VideoTileStrip token={token} serverUrl={serverUrl} roomName={roomId}>
              <MeetingAuthProvider>
                <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                      <span className="text-3xl">⭐</span>
                      Design Review
                    </h1>
                    <p className="text-sm text-gray-600">
                      Room: <span className="font-mono font-semibold">{roomId}</span> | User:{' '}
                      <span className="font-semibold">{username}</span>
                      {selectedVersion && (
                        <>
                          {' | '}
                          <span className="text-blue-600 font-semibold">
                            Viewing: {selectedVersion.userName}'s design
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleViewFinalDesign}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-colors font-medium shadow-md flex items-center gap-2"
                    >
                      <span>View Final Design</span>
                    </button>
                    <button
                      onClick={handleNavigateToWorkflow}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium shadow-md"
                    >
                      Workflow
                    </button>
                  </div>
                </div>

                {/* Sidebar - positioned on left when version selected */}
                <div className="flex-1 overflow-hidden relative">
                  <div className="w-96 min-w-96 flex-shrink-0 border-r border-gray-300 overflow-hidden bg-white h-full relative">
                    <CodeReviewSidebar
                      finalVersions={finalVersions}
                      votes={votes}
                      currentUserId={userId}
                      selectedVersionId={selectedVersion?.id || null}
                      roomId={roomId}
                      onVote={handleVote}
                      onViewCode={handleViewCode}
                      loading={loading || loadingVotes}
                    />

                    {/* Loading overlay inside sidebar */}
                    {loadingFiles && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3 min-w-[300px]">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
                          <p className="text-gray-800 text-center font-semibold">{loadingMessage}</p>
                          {loadingMessage.includes('Installing') && (
                            <p className="text-gray-600 text-xs text-center">
                              This may take a few moments...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Workbench at root level - controlled by workbenchStore */}
              <ClientOnly>
                {() => <Workbench chatStarted={true} isStreaming={false} />}
              </ClientOnly>
            </MeetingAuthProvider>
          </VideoTileStrip>
        </div>

        {/* Toast notifications */}
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        </RouteGuard>
      )}
    </ClientOnly>
  );
}
