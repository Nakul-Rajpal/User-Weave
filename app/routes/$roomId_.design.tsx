import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import VideoTileStrip from '~/components/meet/VideoTileStrip';
import { MeetingAuthProvider } from '~/components/meet/MeetingAuthProvider';
import { Chat } from '~/components/chat/Chat.client';
import { BaseChat } from '~/components/chat/BaseChat';
import { Header } from '~/components/header/Header';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import RouteGuard from '~/components/meet/RouteGuard';
import { getLatestRoomDesignChat, getUserForkOfDesign, forkRoomDesignChat, setFinalVersion } from '~/lib/persistence/supabase';
import { buildDesignPrompt } from '~/lib/prompts/design-implications-prompt';
import { useStore } from '@nanostores/react';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatId } from '~/lib/persistence/useChatHistory';
import { toast } from 'react-toastify';

// Add loader to provide chat ID from query params for useChatHistory hook
export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const chatIdParam = url.searchParams.get('chat');
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

  // Force light theme and body background while on design page (chat must stay readable)
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', 'light');
    html.setAttribute('data-design-page', 'true');
    return () => {
      html.removeAttribute('data-design-page');
      html.setAttribute('data-theme', themeStore.get());
    };
  }, []);

  // Set username and userId from authenticated user
  useEffect(() => {
    if (user?.email) {
      const displayName = user.email.split('@')[0];
      setUserId(user.id);
      setUsername(displayName);
      try {
        sessionStorage.setItem('current-meeting-username', displayName);
        sessionStorage.setItem('current-meeting-uuid', user.id);
        sessionStorage.setItem('current-meeting-session-id', user.id);
      } catch {
        // ignore sessionStorage errors
      }
    }
  }, [user]);

  // Show auth modal if not authenticated
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-bg-depth-1">
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

    // Skip if there's already a chat ID or prompt in the URL
    const chatFromUrl = searchParams.get('chat');
    const promptFromUrl = searchParams.get('prompt');
    if (chatFromUrl || promptFromUrl) {
      setRoomDesignChecked(true);
      return;
    }

    const checkAndForkRoomDesign = async () => {
      try {
        setCheckingRoomDesign(true);
        const latestDesign = await getLatestRoomDesignChat(roomName);

        if (!latestDesign) {
          try {
            const summaryResponse = await fetch(`/api/meet/summary/${roomName}`);
            const summaryData = await summaryResponse.json();
            const points = summaryData.success && summaryData.summary?.points?.length > 0
              ? summaryData.summary.points
              : [];
            const prompt = buildDesignPrompt(points, roomName);
            navigate(`/${roomName}/design?prompt=${encodeURIComponent(prompt)}`);
          } catch {
            const prompt = buildDesignPrompt([], roomName);
            navigate(`/${roomName}/design?prompt=${encodeURIComponent(prompt)}`);
          }
          setRoomDesignChecked(true);
          return;
        }

        const existingFork = await getUserForkOfDesign(latestDesign.chat_id);
        if (existingFork) {
          navigate(`/${roomName}/design?chat=${existingFork.url_id}`);
          setRoomDesignChecked(true);
          return;
        }

        const forkedChat = await forkRoomDesignChat(latestDesign.chat_id, roomName);
        navigate(`/${roomName}/design?chat=${forkedChat.url_id}`);
        setRoomDesignChecked(true);
      } catch {
        setRoomDesignChecked(true);
      } finally {
        setCheckingRoomDesign(false);
      }
    };

    checkAndForkRoomDesign();
  }, [authReady, userId, roomName, roomDesignChecked, checkingRoomDesign, navigate, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setIsChatReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    workbenchStore.showWorkbench.set(true);
  }, []);

  useEffect(() => {
    if (!roomName) {
      navigate('/');
      return;
    }
    if (!authReady || !username) return;

    const fetchToken = async () => {
      try {
        const resp = await fetch(`/api/meet/token?room=${roomName}&username=${username}`);
        if (!resp.ok) throw new Error('Failed to get token');
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        setToken(data.token);
        setServerUrl(data.url);
      } catch (e) {
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
      navigate(`/${roomName}/rating`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send design');
    } finally {
      setIsSendingDesign(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-bg-depth-1">
        <div className="text-xl text-bolt-elements-icon-error">Error: {error}</div>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 rounded-lg bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Wait for auth, LiveKit token, chat initialization, and room design check
  if (!authReady || !username || !token || !serverUrl || !isChatReady || checkingRoomDesign) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bolt-elements-bg-depth-1">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-12 w-12 rounded-full border-2 border-bolt-elements-borderColor border-t-bolt-elements-borderColorActive" />
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
    <div
      className="min-h-screen flex flex-col bg-bolt-elements-bg-depth-1 overflow-hidden"
      data-meeting-design-mode="true"
      data-theme="light"
    >
      <ClientOnly>
        {() => (
          <VideoTileStrip token={token} serverUrl={serverUrl} roomName={roomName}>
            <MeetingAuthProvider>
              {/* Two-box layout: header + content (1/3 chat, 2/3 workbench via CSS variables) */}
              <div className="flex flex-col flex-1 min-h-0 h-full" data-theme="light">
                <header className="flex items-center justify-between px-4 h-[var(--header-height)] flex-shrink-0 border-b border-gray-300 bg-gray-100">
                  <Header />
                  <button
                    type="button"
                    onClick={handleSendDesign}
                    disabled={isSendingDesign || !currentVersion || !currentChatId}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                      ${isSendingDesign || !currentVersion || !currentChatId
                        ? 'bg-bolt-elements-bg-depth-3 text-bolt-elements-textTertiary cursor-not-allowed'
                        : 'bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text'
                      }
                    `}
                  >
                    <span>Send Design</span>
                    {isSendingDesign ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <span aria-hidden>→</span>
                    )}
                  </button>
                </header>
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
  const { initializeWorkflow, cleanup } = useWorkflowStore();

  const userId = user?.id || '';
  const authReady = !!user && !authLoading;

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }
    if (!authReady || !userId) return;
    initializeWorkflow(roomId, userId);
    return () => cleanup();
  }, [roomId, userId, authReady, initializeWorkflow, cleanup, navigate]);

  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bolt-elements-bg-depth-1">
        <div className="text-center">
          <div className="text-4xl mb-4 text-bolt-elements-textPrimary">Loading...</div>
          <div className="text-xl font-semibold text-bolt-elements-textSecondary">Loading Design Stage...</div>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly fallback={<div className="flex items-center justify-center min-h-screen bg-bolt-elements-bg-depth-1"><div className="animate-spin h-12 w-12 rounded-full border-2 border-bolt-elements-borderColor border-t-bolt-elements-borderColorActive" /></div>}>
      {() => (
        <RouteGuard nodeId="design" roomId={roomId}>
          <DesignModeClient />
        </RouteGuard>
      )}
    </ClientOnly>
  );
}
