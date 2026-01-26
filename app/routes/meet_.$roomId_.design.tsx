import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import VideoTileStrip from '~/components/meet/VideoTileStrip';
import { MeetingAuthProvider } from '~/components/meet/MeetingAuthProvider';
import { Chat } from '~/components/chat/Chat.client';
import { BaseChat } from '~/components/chat/BaseChat';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import RouteGuard from '~/components/meet/RouteGuard';
import { getLatestRoomDesignChat, getUserForkOfDesign, forkRoomDesignChat, setFinalVersion } from '~/lib/persistence/supabase';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatId } from '~/lib/persistence/useChatHistory';
import { toast } from 'react-toastify';

// Add loader to provide chat ID from query params for useChatHistory hook
export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const chatIdParam = url.searchParams.get('chat');

  console.log('[DESIGN_MODE_LOADER] Chat ID from query param:', chatIdParam);

  // Return the chat ID as "id" to match the expected format in useChatHistory
  return json({ id: chatIdParam });
};

function DesignModeClient() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomName = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [isChatReady, setIsChatReady] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [checkingRoomDesign, setCheckingRoomDesign] = useState(false);
  const [roomDesignChecked, setRoomDesignChecked] = useState(false);
  const [isSendingDesign, setIsSendingDesign] = useState(false);

  // Get current version and chat ID for Send Design button
  const currentVersion = useStore(workbenchStore.currentVersion);
  const currentChatId = useStore(chatId);

  // Compute authReady from auth state
  const authReady = !!user && !authLoading;

  const { navigateToNode, isHost } = useWorkflowStore();

  console.log('[DESIGN_MODE] Component rendered:', {
    roomName,
    hasToken: !!token,
    hasServerUrl: !!serverUrl,
    isChatReady,
    username,
    hasUser: !!user,
    authLoading,
    error
  });

  // Set username and userId from authenticated user
  useEffect(() => {
    if (user?.email) {
      const displayName = user.email.split('@')[0];
      console.log('[DESIGN_MODE] Using authenticated user:', {
        userId: user.id,
        email: user.email,
        displayName,
      });
      setUserId(user.id);
      setUsername(displayName);

      // Store in sessionStorage for debugging
      try {
        sessionStorage.setItem('current-meeting-username', displayName);
        sessionStorage.setItem('current-meeting-uuid', user.id);
        sessionStorage.setItem('current-meeting-session-id', user.id);
      } catch (e) {
        console.warn('[DESIGN_MODE] Could not store in sessionStorage:', e);
      }
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
              Please sign in to access the design stage
            </p>
          </div>
          <Auth />
        </div>
      </div>
    );
  }

  // Auto-fork room design if available
  useEffect(() => {
    if (!authReady || !userId || !roomName || roomDesignChecked || checkingRoomDesign) {
      return;
    }

    // Skip if there's already a chat ID in the URL (user navigated to specific chat)
    const chatFromUrl = searchParams.get('chat');
    if (chatFromUrl) {
      console.log('[DESIGN_MODE] Chat ID in URL, skipping room design check');
      setRoomDesignChecked(true);
      return;
    }

    const checkAndForkRoomDesign = async () => {
      try {
        setCheckingRoomDesign(true);
        console.log('[DESIGN_MODE] Checking for room design...');

        // Get latest room design
        const latestDesign = await getLatestRoomDesignChat(roomName);

        if (!latestDesign) {
          console.log('[DESIGN_MODE] No room design available');
          setRoomDesignChecked(true);
          return;
        }

        console.log('[DESIGN_MODE] Room design found:', latestDesign.chat_id);

        // Check if user already has a fork
        const existingFork = await getUserForkOfDesign(latestDesign.chat_id);

        if (existingFork) {
          console.log('[DESIGN_MODE] User already has fork, navigating:', existingFork.url_id);
          // Navigate to existing fork
          navigate(`/meet/${roomName}/design?chat=${existingFork.url_id}`);
          setRoomDesignChecked(true);
          return;
        }

        // Create fork for this user
        console.log('[DESIGN_MODE] Creating fork for user...');
        const forkedChat = await forkRoomDesignChat(latestDesign.chat_id, roomName);

        console.log('[DESIGN_MODE] Fork created, navigating to:', forkedChat.url_id);

        // Navigate to the forked chat
        navigate(`/meet/${roomName}/design?chat=${forkedChat.url_id}`);
        setRoomDesignChecked(true);
      } catch (error: any) {
        console.error('[DESIGN_MODE] Failed to check/fork room design:', error);
        // Don't block user - just log the error and continue
        setRoomDesignChecked(true);
      } finally {
        setCheckingRoomDesign(false);
      }
    };

    checkAndForkRoomDesign();
  }, [authReady, userId, roomName, roomDesignChecked, checkingRoomDesign, navigate, searchParams]);

  useEffect(() => {
    console.log('[DESIGN_MODE] Setting chat ready timer');
    // Set chat ready after a small delay to ensure all contexts are initialized
    const timer = setTimeout(() => {
      console.log('[DESIGN_MODE] Chat is now ready');
      setIsChatReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch LiveKit token after auth is ready
  useEffect(() => {
    console.log('[DESIGN_MODE] Token fetch effect triggered:', { roomName, authReady, username });

    if (!roomName) {
      console.log('[DESIGN_MODE] No room name, navigating to /meet');
      navigate('/meet');
      return;
    }

    // Don't fetch token until auth is ready
    if (!authReady || !username) {
      console.log('[DESIGN_MODE] Waiting for auth...', { authReady, hasUsername: !!username });
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('[DESIGN_MODE] Fetching LiveKit token for:', { roomName, username });

        const resp = await fetch(
          `/api/meet/token?room=${roomName}&username=${username}`
        );

        console.log('[DESIGN_MODE] Token response status:', resp.status);

        if (!resp.ok) {
          throw new Error('Failed to get token');
        }

        const data = await resp.json();
        console.log('[DESIGN_MODE] Token data received:', { hasToken: !!data.token, hasUrl: !!data.url, error: data.error });

        if (data.error) {
          throw new Error(data.error);
        }

        setToken(data.token);
        setServerUrl(data.url);
        console.log('[DESIGN_MODE] Token and server URL set successfully');
      } catch (e) {
        console.error('[DESIGN_MODE] Token fetch error:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect');
      }
    };

    fetchToken();
  }, [roomName, authReady, username, navigate]);

  // Handle Send Design button click
  const handleSendDesign = async () => {
    if (!currentVersion || !currentChatId) {
      toast.error('Please save a version before sending your design');
      return;
    }

    setIsSendingDesign(true);
    try {
      await setFinalVersion(currentVersion, currentChatId);
      toast.success('Design sent successfully!');

      // Navigate to rating page
      if (isHost) {
        navigateToNode('rating');
      }
      navigate(`/meet/${roomName}/rating`);
    } catch (error: any) {
      console.error('[DESIGN_MODE] Failed to send design:', error);
      toast.error(error.message || 'Failed to send design');
    } finally {
      setIsSendingDesign(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bolt-elements-background-depth-1">
        <div className="text-xl text-red-500">Error: {error}</div>
        <button
          onClick={() => navigate('/meet')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Wait for auth, LiveKit token, chat initialization, and room design check
  // MeetingAuthProvider will handle Supabase session verification
  if (!authReady || !username || !token || !serverUrl || !isChatReady || checkingRoomDesign) {
    return (
      <div className="flex items-center justify-center h-screen bg-bolt-elements-background-depth-1">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-bolt-elements-textPrimary"></div>
          <p className="text-bolt-elements-textSecondary">
            {!authReady && 'Authenticating...'}
            {authReady && !username && 'Loading identity...'}
            {authReady && username && checkingRoomDesign && 'Loading room design...'}
            {authReady && username && !checkingRoomDesign && !token && 'Connecting to meeting...'}
            {authReady && username && !checkingRoomDesign && token && !isChatReady && 'Setting up workspace...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bolt-elements-background-depth-1" data-meeting-design-mode="true">
      <BackgroundRays />

      <ClientOnly>
        {() => (
          <VideoTileStrip
            token={token}
            serverUrl={serverUrl}
            roomName={roomName}
          >
            {/* Bolt.diy UI wrapped with MeetingAuthProvider for LiveKit-based auth */}
            <MeetingAuthProvider>
              <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
                {/* Custom Header with Send Design button */}
                <div className="flex items-center justify-between px-4 py-2 bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor">
                  <Header />
                  <button
                    onClick={handleSendDesign}
                    disabled={isSendingDesign || !currentVersion || !currentChatId}
                    className={`
                      px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ml-4
                      ${isSendingDesign || !currentVersion || !currentChatId
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg'
                      }
                    `}
                  >
                    <span>Send Design</span>
                    {isSendingDesign ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <span>-&gt;</span>
                    )}
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <ClientOnly fallback={<BaseChat />}>
                    {() => <Chat />}
                  </ClientOnly>
                </div>
              </div>
            </MeetingAuthProvider>
          </VideoTileStrip>
        )}
      </ClientOnly>
    </div>
  );
}

export default function DesignModePage() {
  const params = useParams();
  const navigate = useNavigate();
  const roomId = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState('');

  const { initializeWorkflow, cleanup } = useWorkflowStore();

  const userId = user?.id || '';
  const authReady = !!user && !authLoading;

  // Initialize workflow after auth is ready
  useEffect(() => {
    if (!roomId) {
      navigate('/meet');
      return;
    }

    if (!authReady || !userId) {
      console.log('[DESIGN_PAGE] Waiting for auth...', { authReady, hasUserId: !!userId });
      return;
    }

    console.log('[DESIGN_PAGE] Initializing workflow state...');
    initializeWorkflow(roomId, userId);

    // Cleanup on unmount
    return () => {
      console.log('[DESIGN_PAGE] Cleaning up workflow state...');
      cleanup();
    };
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

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

  if (!authReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">Loading...</div>
          <div className="text-xl font-semibold text-gray-700">Loading Design Stage...</div>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly fallback={<div className="flex items-center justify-center h-screen bg-bolt-elements-background-depth-1"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-bolt-elements-textPrimary"></div></div>}>
      {() => (
        <RouteGuard nodeId="design" roomId={roomId}>
          <DesignModeClient />
        </RouteGuard>
      )}
    </ClientOnly>
  );
}
