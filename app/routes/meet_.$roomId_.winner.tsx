/**
 * Final Design Page
 * Displays the group-selected final design that can be explored and tested
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
import type { FinalVersionWithDetails } from '~/lib/persistence/supabase';
import { getAllFinalVersions } from '~/lib/persistence/supabase';
import { supabase } from '~/lib/supabase/client';
import type { VoteData } from '~/types/final-versions';
import { toast, ToastContainer } from 'react-toastify';
import { loadFinalVersionFiles } from '~/utils/finalVersionsLoader';
import { Workbench } from '~/components/workbench/Workbench.client';

// Loader required for Workbench component (uses useLoaderData internally)
export const loader = () => json({});

interface WinnerData {
  version: FinalVersionWithDetails;
  voteData: VoteData;
  score: number;
}

export default function WinnerPage() {
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

  // Winner state
  const [winner, setWinner] = useState<WinnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading final design...');
  const [filesLoaded, setFilesLoaded] = useState(false);

  const { initializeWorkflow, cleanup } = useWorkflowStore();

  // Set username and userId from authenticated user
  useEffect(() => {
    if (user?.email) {
      const displayName = user.email.split('@')[0];
      console.log('[WINNER] Using authenticated user:', {
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
              Please sign in to view the final design
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
      console.log('[WINNER] Waiting for auth...', { authReady, hasUserId: !!userId });
      return;
    }

    console.log('[WINNER] Initializing workflow state...');
    initializeWorkflow(roomId, userId);

    // Cleanup on unmount
    return () => {
      console.log('[WINNER] Cleaning up workflow state...');
      cleanup();
    };
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  // Fetch LiveKit token after auth is ready
  useEffect(() => {
    console.log('[WINNER] Token fetch effect triggered:', { roomId, authReady, username });

    if (!roomId || !authReady || !username) {
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('[WINNER] Fetching LiveKit token...');

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
        console.log('[WINNER] Token and server URL set successfully');
      } catch (e) {
        console.error('[WINNER] Token fetch error:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect to video');
      }
    };

    fetchToken();
  }, [roomId, authReady, username]);

  // Calculate winner from final versions and votes
  useEffect(() => {
    if (!authReady || !userId || !roomId) {
      return;
    }

    const calculateWinner = async () => {
      try {
        setLoading(true);
        console.log('[WINNER] Calculating winner...');

        // Verify session exists before fetching
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('[WINNER] No session found');
          toast.error('Authentication session not found. Please refresh the page.');
          return;
        }

        // Fetch all final versions
        const versions = await getAllFinalVersions();
        console.log(`[WINNER] Loaded ${versions.length} submitted designs`);

        if (versions.length === 0) {
          console.log('[WINNER] No designs submitted yet');
          setWinner(null);
          setLoading(false);
          return;
        }

        // Fetch all votes for this room
        const response = await fetch(`/api/meet/final-version-votes/${roomId}?userId=${userId}`);
        const voteData = await response.json();

        if (!voteData.success) {
          console.error('[WINNER] Failed to fetch votes');
          // Still show winner based on any version if votes fail
        }

        const votes: Record<string, VoteData> = voteData.votes || {};

        // Calculate scores and find winner
        let maxScore = -Infinity;
        let winningVersion: WinnerData | null = null;

        for (const version of versions) {
          const vd = votes[version.id] || { like: 0, dislike: 0 };
          const score = vd.like - vd.dislike;

          console.log(`[WINNER] Version ${version.userName}: score=${score} (${vd.like} upvotes, ${vd.dislike} downvotes)`);

          if (score > maxScore || (score === maxScore && !winningVersion)) {
            maxScore = score;
            winningVersion = {
              version,
              voteData: vd,
              score,
            };
          }
        }

        if (winningVersion) {
          console.log('[WINNER] Winner found:', winningVersion.version.userName, 'with score:', winningVersion.score);
          setWinner(winningVersion);
        } else {
          // Default to first version if no votes yet
          const defaultWinner = versions[0];
          setWinner({
            version: defaultWinner,
            voteData: { like: 0, dislike: 0 },
            score: 0,
          });
        }
      } catch (err: any) {
        console.error('[WINNER] Error calculating winner:', err);
        toast.error(`Failed to load winner: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    calculateWinner();
  }, [authReady, userId, roomId]);

  // Load winner's files into workbench
  useEffect(() => {
    if (!winner || filesLoaded || loadingFiles) {
      return;
    }

    const loadWinnerFiles = async () => {
      try {
        setLoadingFiles(true);
        setLoadingMessage('Loading final design...');

        const { version } = winner;

        if (!version.files || Object.keys(version.files).length === 0) {
          console.warn('[FINAL] No files found in final design');
          toast.warning('The final design has no files to display');
          return;
        }

        console.log('[FINAL] Loading files for final design:', version.userName);
        console.log('[FINAL] Found', Object.keys(version.files).length, 'files/folders');

        await loadFinalVersionFiles(version.files, (message: string) => {
          console.log('[FINAL] Progress:', message);
          setLoadingMessage(message);
        });

        console.log('[FINAL] Files loaded successfully');
        setFilesLoaded(true);
        toast.success(`${version.userName}'s design is ready to explore!`);
      } catch (err: any) {
        console.error('[FINAL] Failed to load files:', err);
        toast.error(`Failed to load final design: ${err.message || 'Unknown error'}`);
        workbenchStore.showWorkbench.set(false);
      } finally {
        setLoadingFiles(false);
        setLoadingMessage('Loading final design...');
      }
    };

    loadWinnerFiles();
  }, [winner, filesLoaded, loadingFiles]);

  // Navigate to workflow
  const handleNavigateToWorkflow = () => {
    navigate(`/meet/${roomId}/workflow`);
  };

  // Navigate back to rating
  const handleBackToRating = () => {
    navigate(`/meet/${roomId}/rating`);
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
        <RouteGuard nodeId="winner" roomId={roomId}>
          <div className="h-screen flex flex-col bg-gradient-to-br from-pink-50 to-rose-50" data-meeting-winner-mode="true">
            <VideoTileStrip token={token} serverUrl={serverUrl} roomName={roomId}>
              <MeetingAuthProvider>
                <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
                  {/* Header */}
                  <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-3xl">✅</span>
                        Final Design
                      </h1>
                      <p className="text-sm text-gray-600">
                        Room: <span className="font-mono font-semibold">{roomId}</span> | User:{' '}
                        <span className="font-semibold">{username}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBackToRating}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Back to Rating
                      </button>
                      <button
                        onClick={handleNavigateToWorkflow}
                        className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium shadow-md"
                      >
                        Workflow
                      </button>
                    </div>
                  </div>

                  {/* Final Design Info Card */}
                  {loading ? (
                    <div className="flex items-center justify-center flex-1">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-500 mx-auto mb-4" />
                        <p className="text-gray-600">Determining final design...</p>
                      </div>
                    </div>
                  ) : winner ? (
                    <div className="p-6 bg-gradient-to-r from-green-100 via-emerald-50 to-teal-100 border-b border-green-200">
                      <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-6xl">✅</div>
                          <div>
                            <h2 className="text-2xl font-bold text-gray-800">
                              {winner.version.userName}'s Design
                            </h2>
                            <p className="text-gray-600">
                              {winner.version.userEmail}
                            </p>
                            <p className="text-sm text-green-700 mt-1">
                              Selected by group consensus
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">
                              {winner.voteData.like}
                            </div>
                            <div className="text-sm text-gray-500">Upvotes</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-red-600">
                              {winner.voteData.dislike}
                            </div>
                            <div className="text-sm text-gray-500">Downvotes</div>
                          </div>
                          <div className="text-center border-l border-gray-300 pl-6">
                            <div className="text-3xl font-bold text-blue-600">
                              {winner.score}
                            </div>
                            <div className="text-sm text-gray-500">Net Score</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center flex-1">
                      <div className="text-center p-8 bg-white rounded-lg shadow-md">
                        <div className="text-6xl mb-4">📋</div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">No Designs Submitted Yet</h2>
                        <p className="text-gray-600 mb-4">
                          Submit your design in the Design stage to see it here!
                        </p>
                        <button
                          onClick={() => navigate(`/meet/${roomId}/design`)}
                          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                        >
                          Go to Design Stage
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading overlay */}
                  {loadingFiles && (
                    <div className="flex-1 flex items-center justify-center bg-gray-100">
                      <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4 shadow-lg">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-500" />
                        <p className="text-gray-800 font-semibold">{loadingMessage}</p>
                        {loadingMessage.includes('Installing') && (
                          <p className="text-gray-600 text-sm">
                            This may take a few moments...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Workbench at root level - controlled by workbenchStore */}
                {filesLoaded && (
                  <ClientOnly>
                    {() => <Workbench chatStarted={true} isStreaming={false} />}
                  </ClientOnly>
                )}
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
