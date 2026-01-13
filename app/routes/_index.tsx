import { json, type MetaFunction } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { useAuth, AuthModal } from '~/components/auth/Auth';
import { useState, useEffect } from 'react';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

function IndexClient() {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isChatReady, setIsChatReady] = useState(false);

  useEffect(() => {
    setIsChatReady(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-bolt-elements-textPrimary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
        <BackgroundRays />
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-bolt-elements-textPrimary mb-4">
              Welcome to Bolt
            </h1>
            <p className="text-bolt-elements-textSecondary mb-8">
              Please sign in to start chatting with AI
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-bolt-elements-button-primary-bg text-bolt-elements-button-primary-text px-6 py-3 rounded-lg hover:bg-bolt-elements-button-primary-bg-hover"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  if (!isChatReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-bolt-elements-textPrimary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <Chat />
    </div>
  );
}

/**
 * Landing page component for Bolt
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  return (
    <ClientOnly fallback={<BaseChat />}>
      {() => <IndexClient />}
    </ClientOnly>
  );
}
