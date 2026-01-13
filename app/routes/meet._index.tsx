import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
import { supabase } from '~/lib/supabase/client';

export default function MeetLobby() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [claimAdmin, setClaimAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [claiming, setClaiming] = useState(false);

  const handleAdminClaim = async () => {
    if (!claimAdmin) return true; // Not claiming admin, proceed normally

    setAdminError('');
    setClaiming(true);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Call admin claim API
      const response = await fetch('/api/meet/claim-admin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: adminPassword }),
      });

      const data = await response.json();

      if (data.success) {
        // Store admin status in localStorage
        localStorage.setItem('isAdmin', 'true');
        return true;
      } else {
        setAdminError(data.message || 'Failed to claim admin role');
        return false;
      }
    } catch (error: any) {
      console.error('Failed to claim admin:', error);
      setAdminError('Failed to claim admin role. Please try again.');
      return false;
    } finally {
      setClaiming(false);
    }
  };

  const joinRoom = async () => {
    if (!roomName.trim()) return;

    const adminClaimSuccess = await handleAdminClaim();
    if (claimAdmin && !adminClaimSuccess) {
      return; // Don't navigate if admin claim failed
    }

    navigate(`/meet/${roomName.trim()}`);
  };

  const createNewRoom = async () => {
    const adminClaimSuccess = await handleAdminClaim();
    if (claimAdmin && !adminClaimSuccess) {
      return; // Don't navigate if admin claim failed
    }

    const newRoom = `room-${Math.random().toString(36).substring(2, 9)}`;
    navigate(`/meet/${newRoom}`);
  };

  // Show auth modal if not authenticated
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-bolt-elements-background-depth-1">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2 text-bolt-elements-textPrimary">
              Login Required
            </h1>
            <p className="text-bolt-elements-textSecondary">
              Please sign in to access video meetings
            </p>
          </div>
          <Auth />
        </div>
      </div>
    );
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bolt-elements-background-depth-1">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bolt-elements-textPrimary"></div>
          <div className="text-bolt-elements-textPrimary">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-bolt-elements-background-depth-1">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-bolt-elements-textPrimary">
            Video Meetings
          </h1>
          <p className="text-bolt-elements-textSecondary">
            Collaborate with AI-powered coding
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name"
            className="w-full p-3 border rounded-lg bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor"
            onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
          />

          {/* Admin checkbox and password */}
          <div className="border-t border-bolt-elements-borderColor pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary cursor-pointer">
              <input
                type="checkbox"
                checked={claimAdmin}
                onChange={(e) => {
                  setClaimAdmin(e.target.checked);
                  setAdminError('');
                }}
                className="w-4 h-4 rounded border-bolt-elements-borderColor"
              />
              I am the meeting administrator
            </label>

            {claimAdmin && (
              <div className="space-y-2">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setAdminError('');
                  }}
                  placeholder="Enter admin password"
                  className="w-full p-2 border rounded-lg bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor text-sm"
                />
                <p className="text-xs text-bolt-elements-textSecondary italic">
                  Admin privileges grant access to AI summarization and transcript downloads across all rooms.
                </p>
              </div>
            )}

            {adminError && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-500">{adminError}</p>
              </div>
            )}
          </div>

          <button
            onClick={joinRoom}
            disabled={!roomName.trim() || claiming || (claimAdmin && !adminPassword.trim())}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {claiming ? 'Claiming Admin...' : 'Join Room'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-bolt-elements-borderColor"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary">OR</span>
            </div>
          </div>

          <button
            onClick={createNewRoom}
            disabled={claiming || (claimAdmin && !adminPassword.trim())}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {claiming ? 'Claiming Admin...' : 'Create New Room'}
          </button>
        </div>

        <div className="text-sm text-bolt-elements-textSecondary text-center">
          <p>Features:</p>
          <ul className="mt-2 space-y-1">
            <li>✓ Multi-participant video conferencing</li>
            <li>✓ Live transcription with Deepgram</li>
            <li>✓ Dual chat: Users + AI Assistant</li>
            <li>✓ Integrated coding with bolt.diy</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
