import { json, type MetaFunction } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import { useState, useEffect } from 'react';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { useAuth, AuthModal } from '~/components/auth/Auth';
import { FinalVersionsList } from '~/components/final-versions/FinalVersionsList';
import { EmptyWorkbenchState } from '~/components/final-versions/EmptyWorkbenchState';
import { Workbench } from '~/components/workbench/Workbench.client';
import type { FinalVersionWithDetails } from '~/lib/persistence/supabase';
import { getAllFinalVersions } from '~/lib/persistence/supabase';
import { toast, ToastContainer } from 'react-toastify';
import { loadFinalVersionFiles } from '~/utils/finalVersionsLoader';

export const meta: MetaFunction = () => {
  return [
    { title: 'Final Versions - Bolt' },
    { name: 'description', content: 'View all users\' final code versions for review and merging' },
  ];
};

export const loader = () => json({});

function FinalVersionsClient() {
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [finalVersions, setFinalVersions] = useState<FinalVersionWithDetails[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<FinalVersionWithDetails | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading workspace...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch final versions when user is authenticated
  useEffect(() => {
    const loadFinalVersions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const versions = await getAllFinalVersions();
        setFinalVersions(versions);
      } catch (err: any) {
        console.error('Error loading final versions:', err);
        setError(err.message || 'Failed to load final versions');
        toast.error('Failed to load final versions');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadFinalVersions();
    }
  }, [user, authLoading]);

  // Handle version selection
  const handleSelectVersion = async (version: FinalVersionWithDetails) => {
    setSelectedVersion(version);
    setLoadingFiles(true);
    setLoadingMessage('Loading workspace...');

    try {
      console.log('🔄 [FINAL VERSION] Loading version:', version.userName, version.chatTitle);

      await loadFinalVersionFiles(version.files, (message: string) => {
        setLoadingMessage(message);
      });

      toast.success(`${version.userName}'s workspace is ready!`, {
        icon: <div className="i-ph:check-circle text-green-500" />,
      });
    } catch (err: any) {
      console.error('❌ [FINAL VERSION] Failed to load files:', err);
      toast.error('Failed to load workspace files');
    } finally {
      setLoadingFiles(false);
      setLoadingMessage('Loading workspace...');
    }
  };

  if (authLoading || (loading && user)) {
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
            <div className="i-ph:lock text-6xl text-bolt-elements-textTertiary mb-4" />
            <h1 className="text-4xl font-bold text-bolt-elements-textPrimary mb-4">
              Authentication Required
            </h1>
            <p className="text-bolt-elements-textSecondary mb-8">
              Please sign in to view final versions
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

  return (
    <>
      <div className="flex flex-col h-screen w-full bg-bolt-elements-background-depth-1">
        <BackgroundRays />
        <Header />

        {/* Split Layout: List (Left) | Workbench (Right) */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT SIDE: Final Versions List */}
          <div className="w-96 min-w-96 flex-shrink-0 border-r border-bolt-elements-borderColor overflow-hidden flex flex-col bg-bolt-elements-background-depth-2 relative">
            <FinalVersionsList
              finalVersions={finalVersions}
              onSelectVersion={handleSelectVersion}
              selectedVersionId={selectedVersion?.id}
            />

            {/* Loading overlay */}
            {loadingFiles && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-bolt-elements-background-depth-1 rounded-lg p-6 flex flex-col items-center gap-3 min-w-[300px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bolt-elements-textPrimary" />
                  <p className="text-bolt-elements-textPrimary text-center">{loadingMessage}</p>
                  {loadingMessage.includes('Installing') && (
                    <p className="text-bolt-elements-textSecondary text-xs text-center">
                      This may take a few moments...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Workbench */}
          <div className="flex-1 overflow-hidden">
            <ClientOnly fallback={<EmptyWorkbenchState />}>
              {() => (
                selectedVersion ? (
                  <>
                    {/* Read-Only Badge */}
                    <div className="absolute top-20 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-sm">
                      <div className="i-ph:eye" />
                      <span className="font-medium">Read-Only Preview</span>
                      <div className="w-px h-4 bg-yellow-500/30 mx-1" />
                      <span className="text-xs">{selectedVersion.userName}</span>
                    </div>

                    <Workbench chatStarted={true} isStreaming={false} />
                  </>
                ) : (
                  <EmptyWorkbenchState />
                )
              )}
            </ClientOnly>
          </div>
        </div>
      </div>
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
    </>
  );
}

export default function FinalVersionsPage() {
  return (
    <ClientOnly fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-bolt-elements-textPrimary"></div>
      </div>
    }>
      {() => <FinalVersionsClient />}
    </ClientOnly>
  );
}
