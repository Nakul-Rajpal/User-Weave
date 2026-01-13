/**
 * Summary Discussion Page (formerly Poll Page)
 * Shows AI summary and discussion points with admin controls
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
import PromptTemplateEditor from '~/components/meet/PromptTemplateEditor';
import GenerateDesignButton from '~/components/meet/GenerateDesignButton';
import GenerationHistory from '~/components/meet/GenerationHistory';
import { supabase } from '~/lib/supabase/client';
import type { SummaryWithVotes } from '~/types/transcript';

export default function SummaryDiscussionPage() {
  const params = useParams();
  const navigate = useNavigate();
  const roomId = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const authReady = !!user && !authLoading;
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'discussion'>('summary');
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

                  {/* Tabs */}
                  <div className="bg-white border-b border-gray-200 px-6">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setActiveTab('summary')}
                        className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                          activeTab === 'summary'
                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-600 bg-white hover:text-blue-600'
                        }`}
                      >
                        📝 AI Summary
                      </button>
                      <button
                        onClick={() => setActiveTab('discussion')}
                        className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                          activeTab === 'discussion'
                            ? 'border-purple-500 text-purple-600 bg-purple-50'
                            : 'border-transparent text-gray-600 bg-white hover:text-purple-600'
                        }`}
                      >
                        💬 Discussion Points
                      </button>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 overflow-auto">
                    <ClientOnly fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
                      {() => (
                        activeTab === 'summary' ? (
                          <ReadOnlySummary roomId={roomId} isAdmin={isAdmin} />
                        ) : (
                          <TranscriptSummaryPanel roomId={roomId} readOnly={!isAdmin} />
                        )
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

/**
 * ReadOnly Summary Component
 * Displays the AI-generated summary in read-only mode (no voting)
 * Admin can edit/delete points and generate designs
 */
function ReadOnlySummary({ roomId, isAdmin }: { roomId: string; isAdmin: boolean }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SummaryWithVotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [roomId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/meet/summary/${roomId}`);
      const data = await response.json() as { success?: boolean; message?: string; summary?: SummaryWithVotes };

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch summary');
      }

      setSummary(data.summary || null);
    } catch (err: any) {
      console.error('Failed to fetch summary:', err);
      setError(err.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSuccess = (chatId: string) => {
    console.log('✅ Design generated successfully:', chatId);
    setGenerateSuccess('Design generated successfully! All users will see it in their code page.');
    setGenerateError(null);

    // Clear success message after 5 seconds
    setTimeout(() => setGenerateSuccess(null), 5000);

    // Optionally navigate to the generated chat
    // navigate(`/chat/${chatId}`);
  };

  const handleGenerateError = (error: string) => {
    console.error('❌ Design generation failed:', error);
    setGenerateError(error);
    setGenerateSuccess(null);
  };

  const handleEditPoint = (pointId: string, currentText: string) => {
    setEditingPointId(pointId);
    setEditText(currentText);
  };

  const handleSaveEdit = async (pointId: string) => {
    if (!editText.trim() || !summary) {
      alert('Point text cannot be empty');
      return;
    }

    // Find the point to get its category
    const point = summary.points.find(p => p.id === pointId);
    if (!point) {
      alert('Point not found');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/meet/summary/edit-point', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          summaryId: summary.id,
          pointId,
          text: editText.trim(),
          category: point.category,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to update point');
      }

      // Refresh summary
      await fetchSummary();
      setEditingPointId(null);
      setEditText('');
    } catch (err: any) {
      console.error('Failed to update point:', err);
      alert(`Failed to update point: ${err.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingPointId(null);
    setEditText('');
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!confirm('Are you sure you want to delete this point?') || !summary) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/meet/summary/delete-point', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          summaryId: summary.id,
          pointId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to delete point');
      }

      // Refresh summary
      await fetchSummary();
    } catch (err: any) {
      console.error('Failed to delete point:', err);
      alert(`Failed to delete point: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <div className="text-sm text-gray-600">Loading summary...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2">❌</div>
          <div className="text-sm text-red-600">{error}</div>
          <button
            onClick={fetchSummary}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2">📝</div>
          <div className="text-sm text-gray-600">No summary available yet</div>
          <p className="text-xs text-gray-500 mt-2">
            The meeting summary will appear here after it's generated
          </p>
        </div>
      </div>
    );
  }

  const CATEGORY_COLORS = {
    decision: 'bg-green-100 text-green-800 border-green-300',
    action: 'bg-orange-100 text-orange-800 border-orange-300',
    discussion: 'bg-blue-100 text-blue-800 border-blue-300',
    question: 'bg-purple-100 text-purple-800 border-purple-300',
  };

  const CATEGORY_ICONS = {
    decision: '✅',
    action: '📋',
    discussion: '💬',
    question: '❓',
  };

  return (
    <div className="h-full flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">AI Meeting Summary</h2>
          <button
            onClick={fetchSummary}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {summary.points.length} key points identified
        </p>
      </div>

      {/* Summary Points - With Admin Controls */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {summary.points.map((point, index) => (
          <div
            key={point.id}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            {/* Category Badge and Admin Controls */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <span
                className={`text-sm px-2 py-1 rounded border ${
                  CATEGORY_COLORS[point.category]
                } font-medium`}
              >
                {CATEGORY_ICONS[point.category]} {point.category}
              </span>

              {/* Admin-Only Edit/Delete Buttons */}
              {isAdmin && editingPointId !== point.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditPoint(point.id, point.text)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeletePoint(point.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>

            {/* Point Text - Editable for Admin */}
            {editingPointId === point.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(point.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    ✓ Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-800">{point.text}</p>
            )}
          </div>
        ))}
      </div>

      {/* Design Generation Panel (Admin Only) */}
      {isAdmin && (
        <div className="space-y-4 pb-4">
          <div className="border-t border-gray-300 pt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">🎨</span>
              AI Design Generation
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Generate an initial UI design for all users based on the summary points above
            </p>

            {/* Success/Error Messages */}
            {generateSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
                ✓ {generateSuccess}
              </div>
            )}
            {generateError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                ✗ {generateError}
              </div>
            )}

            {/* Prompt Template Editor */}
            <div className="mb-4">
              <PromptTemplateEditor roomId={roomId} />
            </div>

            {/* Generate Button */}
            <div className="mb-4">
              <GenerateDesignButton
                roomId={roomId}
                summaryPointsCount={summary.points.length}
                onSuccess={handleGenerateSuccess}
                onError={handleGenerateError}
              />
            </div>
          </div>
        </div>
      )}

      {/* Generation History (Visible to All Users) */}
      <div className="mt-4">
        <GenerationHistory roomId={roomId} />
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-gray-300">
        <div className="text-xs text-gray-500">
          Generated with {summary.llmModel || 'AI'} •{' '}
          {new Date(summary.generatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
