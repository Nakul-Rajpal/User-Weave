import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { useAuth } from '~/components/auth/Auth';
import Auth from '~/components/auth/Auth';
import { supabase } from '~/lib/supabase/client';
import { ImmersiveBackground } from '~/components/ui/ImmersiveBackground';
import type { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [{ title: 'User Weave - Video Meetings' }, { name: 'description', content: 'Collaborate with AI-powered coding in video meetings' }];
};

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

    navigate(`/${roomName.trim()}`);
  };

  const createNewRoom = async () => {
    const adminClaimSuccess = await handleAdminClaim();
    if (claimAdmin && !adminClaimSuccess) {
      return; // Don't navigate if admin claim failed
    }

    const newRoom = `room-${Math.random().toString(36).substring(2, 9)}`;
    navigate(`/${newRoom}`);
  };

  // Show auth modal if not authenticated
  if (!authLoading && !user) {
    return (
      <ImmersiveBackground variant="minimal">
        <div className="flex flex-col items-center justify-center flex-1 p-8">
          <div className="max-w-md w-full space-y-6 animate-fade-in-up">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2 text-bolt-elements-textPrimary">
                Login Required
              </h1>
              <p className="text-bolt-elements-textSecondary">
                Please sign in to access video meetings
              </p>
            </div>
            <Auth onSuccess={() => navigate('/', { replace: true })} />
          </div>
        </div>
      </ImmersiveBackground>
    );
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <ImmersiveBackground variant="minimal" orbs={false} grid={false}>
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-bolt-elements-borderColor border-t-accent-500" />
          <div className="text-bolt-elements-textPrimary">Loading...</div>
        </div>
      </ImmersiveBackground>
    );
  }

  return (
    <ImmersiveBackground>
      <div className="flex flex-col items-center justify-center flex-1 p-6 sm:p-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center animate-fade-in-up animate-fade-in-up-delay-1">
            <h1 className="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-bolt-elements-textPrimary via-accent-600 to-accent-500 bg-clip-text text-transparent">
              Video Meetings
            </h1>
            <p className="text-bolt-elements-textSecondary text-lg">
              Collaborate with AI-powered coding
            </p>
          </div>

          <div
            className="space-y-4 p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl shadow-xl animate-fade-in-up animate-fade-in-up-delay-2"
          >
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              className="w-full p-3.5 rounded-xl border border-bolt-elements-borderColor bg-white/80 dark:bg-gray-800/80 text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 transition-all"
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
            />

            <div className="border-t border-bolt-elements-borderColor pt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={claimAdmin}
                  onChange={(e) => {
                    setClaimAdmin(e.target.checked);
                    setAdminError('');
                  }}
                  className="w-4 h-4 rounded border-bolt-elements-borderColor text-accent-500 focus:ring-accent-500"
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
                    className="w-full p-2.5 rounded-xl border border-bolt-elements-borderColor bg-white/80 dark:bg-gray-800/80 text-bolt-elements-textPrimary text-sm focus:ring-2 focus:ring-accent-500/30 transition-all"
                  />
                  <p className="text-xs text-bolt-elements-textSecondary italic">
                    Admin privileges grant access to AI summarization and transcript downloads across all rooms.
                  </p>
                </div>
              )}

              {adminError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-xs text-red-500">{adminError}</p>
                </div>
              )}
            </div>

            <button
              onClick={joinRoom}
              disabled={!roomName.trim() || claiming || (claimAdmin && !adminPassword.trim())}
              className="w-full py-3.5 px-4 rounded-xl font-medium bg-gradient-to-r from-accent-600 to-accent-500 text-white shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 hover:from-accent-500 hover:to-accent-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-300"
            >
              {claiming ? 'Claiming Admin...' : 'Join Room'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-bolt-elements-borderColor" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white/70 dark:bg-gray-900/70 text-bolt-elements-textSecondary rounded-full">OR</span>
              </div>
            </div>

            <button
              onClick={createNewRoom}
              disabled={claiming || (claimAdmin && !adminPassword.trim())}
              className="w-full py-3.5 px-4 rounded-xl font-medium bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/35 hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-300"
            >
              {claiming ? 'Claiming Admin...' : 'Create New Room'}
            </button>
          </div>

          <div className="text-sm text-bolt-elements-textSecondary text-center p-4 rounded-xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border border-white/10 animate-fade-in-up animate-fade-in-up-delay-3">
            <p className="font-medium text-bolt-elements-textPrimary mb-2">Features</p>
            <ul className="space-y-1.5">
              <li className="flex items-center justify-center gap-2">✓ Multi-participant video conferencing</li>
              <li className="flex items-center justify-center gap-2">✓ Live transcription with Deepgram</li>
              <li className="flex items-center justify-center gap-2">✓ Dual chat: Users + AI Assistant</li>
              <li className="flex items-center justify-center gap-2">✓ Integrated coding with bolt.diy</li>
            </ul>
          </div>
        </div>
      </div>
    </ImmersiveBackground>
  );
}
