import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import VideoConference from '~/components/meet/VideoConference';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';

export default function MeetingRoom() {
  const params = useParams();
  const navigate = useNavigate();
  const roomName = params.roomId as string;
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');

  // Set username from authenticated user's email
  useEffect(() => {
    if (user?.email) {
      // Use email username or full email as display name
      const displayName = user.email.split('@')[0];
      console.log('✅ [MEETING] Using authenticated user:', {
        userId: user.id,
        email: user.email,
        displayName,
      });
      setUsername(displayName);
    }
  }, [user]);

  // Fetch LiveKit token after user is authenticated
  useEffect(() => {
    if (!roomName) {
      navigate('/meet');
      return;
    }

    // Wait for auth to complete and user to be set
    if (authLoading || !user || !username) {
      console.log('⏳ [MEETING] Waiting for auth...', { authLoading, hasUser: !!user, hasUsername: !!username });
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('🔑 [MEETING] Fetching LiveKit token with username:', username);
        const resp = await fetch(
          `/api/meet/token?room=${roomName}&username=${username}`
        );

        if (!resp.ok) {
          throw new Error('Failed to get token');
        }

        const data = await resp.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setToken(data.token);
        setServerUrl(data.url);
      } catch (e) {
        console.error('Token fetch error:', e);
        setError(e instanceof Error ? e.message : 'Failed to connect');
      }
    };

    fetchToken();
  }, [roomName, authLoading, user, username, navigate]);

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
              Please sign in to join the meeting room
            </p>
          </div>
          <Auth onSuccess={() => navigate(`/meet/${roomName}`, { replace: true })} />
        </div>
      </div>
    );
  }

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

  if (authLoading || !username || !token || !serverUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-bolt-elements-background-depth-1">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bolt-elements-textPrimary"></div>
          <div className="text-bolt-elements-textPrimary">
            {authLoading && 'Authenticating...'}
            {!authLoading && !username && 'Loading identity...'}
            {!authLoading && username && (!token || !serverUrl) && 'Connecting to room...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      {() => (
        <VideoConference
          token={token}
          serverUrl={serverUrl}
          roomName={roomName}
        />
      )}
    </ClientOnly>
  );
}
