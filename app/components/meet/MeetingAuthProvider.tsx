'use client';

import { useEffect, useState } from 'react';
import { supabase } from '~/lib/supabase/client';

/**
 * MeetingAuthProvider
 *
 * Ensures a valid Supabase authentication session exists before rendering children.
 * This component should be used after meeting authentication has been initialized.
 *
 * How it works:
 * 1. Checks for an active Supabase session
 * 2. Waits for session to be ready (auto signup/signin happens in parent)
 * 3. Monitors auth state changes
 * 4. Only renders children when session is active
 *
 * Prerequisites:
 * - Meeting auth must be initialized (via initializeMeetingAuth) before this component renders
 * - User must be auto-signed in to Supabase
 *
 * @example
 * ```tsx
 * // After calling initializeMeetingAuth()
 * <LiveKitRoom token={token} serverUrl={serverUrl}>
 *   <MeetingAuthProvider>
 *     <Chat />
 *   </MeetingAuthProvider>
 * </LiveKitRoom>
 * ```
 */
export function MeetingAuthProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    console.log('🔐 [MEETING_AUTH_PROVIDER] Checking for active session...');

    // Check if we have a valid Supabase session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ [MEETING_AUTH_PROVIDER] Error getting session:', error);
        setAuthReady(false);
        return;
      }

      if (session) {
        console.log('✅ [MEETING_AUTH_PROVIDER] Active session found:', {
          userId: session.user.id,
          email: session.user.email,
        });
        setAuthReady(true);
      } else {
        console.log('⏳ [MEETING_AUTH_PROVIDER] No session yet, waiting...');
        setAuthReady(false);
      }
    });

    // Listen for auth state changes
    // This will catch when the session is established
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 [MEETING_AUTH_PROVIDER] Auth state changed:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
      });

      if (session) {
        setAuthReady(true);
      } else if (event === 'SIGNED_OUT') {
        setAuthReady(false);
      }
    });

    return () => {
      console.log('🔄 [MEETING_AUTH_PROVIDER] Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  // Show loading state while waiting for session to be ready
  if (!authReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bolt-elements-textPrimary"></div>
          <p className="text-bolt-elements-textSecondary text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Only render children after auth session is active
  return <>{children}</>;
}
