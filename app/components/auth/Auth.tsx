import React, { useState } from 'react';
import { supabase } from '~/lib/supabase/client';
import { signIn, signUp, signOut, getCurrentUser } from '~/lib/supabase/auth';
import { useStore } from '@nanostores/react';
import { atom } from 'nanostores';
import { toast } from 'react-toastify';

export const authStore = atom<{ user: any | null; loading: boolean }>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    // Get initial session
    getCurrentUser().then((user) => {
      authStore.set({ user, loading: false });
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        authStore.set({ user, loading: false });
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-bolt-elements-textPrimary"></div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuth() {
  const { user, loading } = useStore(authStore);

  return {
    user,
    loading,
    signIn: async (email: string, password: string) => {
      try {
        const { data, error } = await signIn(email, password);
        if (error) throw error;
        return { data, error: null };
      } catch (error: any) {
        toast.error(error.message);
        return { data: null, error };
      }
    },
    signUp: async (email: string, password: string) => {
      try {
        const { data, error } = await signUp(email, password);
        if (error) throw error;
        toast.success('Check your email for the confirmation link!');
        return { data, error: null };
      } catch (error: any) {
        toast.error(error.message);
        return { data: null, error };
      }
    },
    signOut: async () => {
      try {
        const { error } = await signOut();
        if (error) throw error;
        toast.success('Signed out successfully');
      } catch (error: any) {
        toast.error(error.message);
      }
    },
  };
}

export function AuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        const result = await signIn(email, password);
        if (result.data && !result.error) {
          onClose();
          // Force a small delay to let authStore update, then trigger onSuccess
          setTimeout(() => {
            onSuccess?.();
          }, 100);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-bolt-elements-background-depth-2 p-6 rounded-lg w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4 text-bolt-elements-textPrimary">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md text-bolt-elements-textPrimary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md text-bolt-elements-textPrimary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-bolt-elements-button-primary-bg text-bolt-elements-button-primary-text py-2 px-4 rounded-md hover:bg-bolt-elements-button-primary-bg-hover disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Default export for convenience - auto-opens the modal
export default function Auth({ onSuccess }: { onSuccess?: () => void } = {}) {
  const handleSuccess = () => {
    // Force a page reload to ensure proper re-render after auth state change
    if (onSuccess) {
      onSuccess();
    } else {
      // Default behavior: reload the page to pick up new auth state
      window.location.reload();
    }
  };

  return <AuthModal isOpen={true} onClose={() => {}} onSuccess={handleSuccess} />;
}
