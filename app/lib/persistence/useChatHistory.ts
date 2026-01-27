import { useLoaderData, useLocation, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { generateId, type JSONValue, type Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs';
import { getCurrentUser } from '~/lib/supabase/auth';
import { authStore } from '~/components/auth/Auth';
import {
  getAllChats,
  getChatById,
  getChatByUrlId,
  saveChat,
  deleteChat,
  updateChatDescription,
  createChatFromMessages,
  forkChat,
  duplicateChat,
  getNextUrlId,
  saveSnapshot,
  getSnapshot,
  getVersions,
  type ChatHistoryItem,
} from './supabase';
import type { IChatMetadata } from './db';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import { webcontainer } from '~/lib/webcontainer';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';

const persistenceEnabled = true;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);
export function useChatHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useStore(authStore);

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  // Detect if we're in a meeting context to adjust navigation behavior
  const meetingContext = useMemo(() => {
    // Check if we're on a room route (/:roomId or /:roomId/*)
    // Exclude known non-room routes like /api, /chat, etc.
    const pathParts = location.pathname.split('/').filter(Boolean);
    const firstSegment = pathParts[0];

    // Skip if it's the index page or a known non-room route
    if (!firstSegment || firstSegment === 'api' || firstSegment === 'chat' || firstSegment === 'git' || firstSegment === 'final-versions') {
      return null;
    }

    // Assume first segment is a roomId if it's not a known route
    const roomId = firstSegment;

    return {
      basePath: `/${roomId}/design`,
      roomId,
    };
  }, [location.pathname]);

  // Helper to navigate while respecting meeting context
  const contextualNavigate = useCallback((path: string, options?: any) => {
    if (meetingContext && path === '/') {
      // If trying to go home from a meeting, stay in the meeting
      navigate(meetingContext.basePath, options);
    } else if (meetingContext && path.startsWith('/chat/')) {
      // If trying to navigate to a chat from a meeting, use query param
      const chatId = path.replace('/chat/', '');
      navigate(`${meetingContext.basePath}?chat=${chatId}`, options);
    } else {
      // Normal navigation
      navigate(path, options);
    }
  }, [navigate, meetingContext]);

  useEffect(() => {
    console.log('🔄 [INIT] useChatHistory useEffect triggered:', {
      mixedId,
      authLoading,
      hasUser: !!user,
      ready,
    });

    // Wait for authentication to complete before loading chat data
    if (authLoading) {
      console.log('⏳ [INIT] Waiting for authentication...');
      return;
    }

    // If no user is authenticated, redirect to home
    if (!user && mixedId) {
      console.log('❌ [INIT] No authenticated user, redirecting to home');
      contextualNavigate('/', { replace: true });
      return;
    }

    if (mixedId && user) {
      console.log('🔄 [INIT] Loading chat data for:', mixedId);
      Promise.all([
        getChatById(mixedId),
        getSnapshot(mixedId),
        getVersions(mixedId).catch(() => []), // Load versions, default to empty array on error
      ])
        .then(async ([storedMessages, snapshot, versions]) => {
          console.log('📖 [INIT] Loaded data:', {
            hasMessages: !!storedMessages,
            messageCount: storedMessages?.messages.length,
            hasSnapshot: !!snapshot,
            versionCount: versions.length,
          });
          if (storedMessages && Array.isArray(storedMessages.messages) && storedMessages.messages.length > 0) {
            const validSnapshot = snapshot || { chatIndex: '', files: {} };
            const summary = validSnapshot.summary;

            // Load versions into workbench store
            workbenchStore.versions.set(versions);
            if (versions.length > 0) {
              const latestVersionId = versions[0].id;
              workbenchStore.latestVersion.set(latestVersionId);
              workbenchStore.currentVersion.set(latestVersionId);
              console.log('📦 [VERSIONS] Loaded versions:', {
                count: versions.length,
                latestId: latestVersionId,
                versions: versions.map(v => ({
                  id: v.id,
                  versionNumber: v.versionNumber,
                  timestamp: v.timestamp,
                  messageId: v.messageId,
                })),
              });
            } else {
              console.log('📦 [VERSIONS] No versions found for this chat');
            }

            const rewindId = searchParams.get('rewindTo');
            let startingIdx = -1;
            const endingIdx = rewindId
              ? storedMessages.messages.findIndex((m) => m.id === rewindId) + 1
              : storedMessages.messages.length;
            const snapshotIndex = storedMessages.messages.findIndex((m) => m.id === validSnapshot.chatIndex);

            // Only show snapshot restoration view if explicitly rewinding to a snapshot
            // or if rewindId matches the snapshot message
            if (rewindId && snapshotIndex >= 0 && storedMessages.messages[snapshotIndex].id === rewindId) {
              startingIdx = snapshotIndex;
            }

            let filteredMessages = storedMessages.messages.slice(startingIdx + 1, endingIdx);
            let archivedMessages: Message[] = [];

            if (startingIdx >= 0) {
              archivedMessages = storedMessages.messages.slice(0, startingIdx + 1);
            }

            setArchivedMessages(archivedMessages);

            // Restore snapshot files if available (regardless of view mode)
            if (validSnapshot.files && Object.keys(validSnapshot.files).length > 0) {
              restoreSnapshot(mixedId, validSnapshot);
            }

            setInitialMessages(filteredMessages);

            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
            chatMetadata.set(storedMessages.metadata);
            setReady(true);  // MOVE ready set INSIDE success case
          } else {
            contextualNavigate('/', { replace: true });
          }
        })
        .catch((error) => {
          console.error(error);
          logStore.logError('Failed to load chat messages or snapshot', error);
          toast.error('Failed to load chat: ' + error.message);
          setReady(true);  // Ensure ready is set even on error
        });
    } else {
      setReady(true);
    }
  }, [mixedId, contextualNavigate, searchParams, authLoading, user]);

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      const id = chatId.get();

      if (!id) {
        console.log('⚠️ [SNAPSHOT] Cannot take snapshot - no chat ID');
        return;
      }

      console.log('📸 [SNAPSHOT] Taking snapshot...', {
        chatId: id,
        messageId: chatIdx,
        fileCount: Object.keys(files).length,
        hasSummary: !!chatSummary,
      });

      try {
        await saveSnapshot(id, chatIdx, files, chatSummary);

        // Update versions state after saving snapshot
        console.log('📦 [VERSIONS] Snapshot saved, refreshing versions...');
        try {
          const updatedVersions = await getVersions(id);
          workbenchStore.versions.set(updatedVersions);

          if (updatedVersions.length > 0) {
            const latestVersionId = updatedVersions[0].id;
            const wasOnLatest = workbenchStore.currentVersion.get() === workbenchStore.latestVersion.get();

            workbenchStore.latestVersion.set(latestVersionId);

            // If user was viewing latest, update current to new latest
            if (wasOnLatest || workbenchStore.currentVersion.get() === null) {
              workbenchStore.currentVersion.set(latestVersionId);
            }

            console.log('✅ [VERSIONS] Versions updated after snapshot:', {
              count: updatedVersions.length,
              latestId: latestVersionId,
              wasOnLatest,
              versions: updatedVersions.map(v => ({
                id: v.id,
                versionNumber: v.versionNumber,
                timestamp: v.timestamp,
                messageId: v.messageId,
              })),
            });
          }
        } catch (versionError) {
          console.error('❌ [VERSIONS] Failed to refresh versions after snapshot:', versionError);
          // Don't show error toast - snapshot was saved successfully
        }
      } catch (error) {
        console.error('Failed to save snapshot:', error);
        toast.error('Failed to save chat snapshot.');
      }
    },
    [],
  );

  const restoreSnapshot = useCallback(async (id: string, snapshot?: Snapshot) => {
    try {
      const container = await webcontainer;

      const validSnapshot = snapshot || { chatIndex: '', files: {} };

      if (!validSnapshot?.files) {
        return;
      }

      // Create directories first
      const directories = new Set<string>();
      Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
        if (key.startsWith(container.workdir)) {
          key = key.replace(container.workdir, '');
        }

        if (value?.type === 'folder') {
          directories.add(key);
        } else if (value?.type === 'file') {
          const dir = key.substring(0, key.lastIndexOf('/'));
          if (dir) directories.add(dir);
        }
      });

      // Create all directories
      for (const dir of directories) {
        try {
          await container.fs.mkdir(dir, { recursive: true });
        } catch (error) {
          console.warn('Failed to create directory during snapshot restore:', dir, error);
        }
      }

      // Then write files
      for (const [key, value] of Object.entries(validSnapshot.files)) {
        if (value?.type === 'file') {
          let filePath = key;
          if (filePath.startsWith(container.workdir)) {
            filePath = filePath.replace(container.workdir, '');
          }

          try {
            await container.fs.writeFile(filePath, value.content, {
              encoding: value.isBinary ? undefined : 'utf8'
            });
          } catch (error) {
            console.warn('Failed to write file during snapshot restore:', filePath, error);
          }
        }
      }

      // Update workbench store
      // Note: Files are updated via webcontainer watchers, no need to set manually
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      logStore.logError('Snapshot restoration failed', error);
      toast.error('Failed to restore project snapshot');
    }
  }, []);

  return {
    ready: ready,
    initialMessages,
    updateChatMestaData: async (metadata: IChatMetadata) => {
      const id = chatId.get();

      if (!id) {
        return;
      }

      try {
        // For now, we'll skip metadata updates as the current schema doesn't support it
        // await updateChatMetadata(id, metadata);
        chatMetadata.set(metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      console.log('🔄 [STORE] storeMessageHistory called:', {
        messageCount: messages.length,
        messageIds: messages.map(m => m.id),
        hasAnnotations: messages.map(m => m.annotations),
      });

      if (messages.length === 0) {
        console.log('⚠️ [STORE] No messages to store');
        return;
      }

      const { firstArtifact } = workbenchStore;
      const beforeFilter = messages.length;
      messages = messages.filter((m) => !m.annotations?.includes('no-store'));
      console.log(`🔄 [STORE] Filtered out 'no-store' messages: ${beforeFilter} → ${messages.length}`);

      let _urlId = urlId;

      console.log('🔄 [STORE] Checking URL ID:', {
        urlId,
        hasFirstArtifact: !!firstArtifact,
        firstArtifactId: firstArtifact?.id,
      });

      if (!urlId && firstArtifact?.id) {
        console.log('🔄 [STORE] Getting next URL ID from artifact:', firstArtifact.id);
        const newUrlId = await getNextUrlId(firstArtifact.id);
        console.log('🔄 [STORE] Generated URL ID:', newUrlId);
        _urlId = newUrlId;
        navigateChat(newUrlId);
        setUrlId(newUrlId);
      }

      let chatSummary: string | undefined = undefined;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'assistant') {
        const annotations = lastMessage.annotations as JSONValue[];
        const filteredAnnotations = (annotations?.filter(
          (annotation: JSONValue) =>
            annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
        ) || []) as { type: string; value: any } & { [key: string]: any }[];

        if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
          chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
        }
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = crypto.randomUUID();
        chatId.set(nextId);

        if (!urlId) {
          navigateChat(_urlId || nextId);
        }
      }

      const finalChatId = chatId.get();

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');
        return;
      }

      await saveChat(
        finalChatId,
        [...archivedMessages, ...messages],
        urlId,
        description.get(),
      );

      // Take snapshot only when AI assistant stops coding (sends message without code blocks)
      // Skip template messages (they have artifact IDs like "2-1761193460686" instead of "msg-xxx")
      const isRealAIMessage = lastMessage.id.startsWith('msg-');
      const shouldTakeSnapshot =
        lastMessage.role === 'assistant' &&
        !lastMessage.content.includes('```') &&
        isRealAIMessage;

      if (shouldTakeSnapshot) {
        // Wait for all file actions to complete before taking snapshot
        const artifacts = workbenchStore.artifacts.get();
        const artifactCount = Object.keys(artifacts).length;

        console.log('📦 [SNAPSHOT] AI response complete, initiating snapshot process...', {
          messageId: messages[messages.length - 1].id,
          artifactCount,
          hasSummary: !!chatSummary,
          isRealAIMessage,
        });

        console.log('📦 [SNAPSHOT] Waiting for all file actions to complete...');
        const waitPromises = Object.values(artifacts).map((artifact) =>
          artifact.runner.waitForExecutionComplete()
        );

        await Promise.all(waitPromises).catch((error) => {
          console.error('⚠️ [SNAPSHOT] Error waiting for actions:', error);
        });

        console.log('✅ [SNAPSHOT] All actions complete, taking snapshot now');
        takeSnapshot(messages[messages.length - 1].id, workbenchStore.files.get(), _urlId, chatSummary);
      } else {
        console.log('⏭️ [SNAPSHOT] Skipping snapshot:', {
          messageId: lastMessage.id,
          role: lastMessage.role,
          hasCodeBlocks: lastMessage.content.includes('```'),
          isRealAIMessage,
          reason: !isRealAIMessage ? 'Template/artifact message' : 'Has code blocks or not assistant',
        });
      }
    },
    duplicateCurrentChat: async (listItemId: string) => {
      if (!mixedId && !listItemId) {
        return;
      }

      try {
        const newId = await duplicateChat(mixedId || listItemId);
        contextualNavigate(`/chat/${newId}`);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat');
        console.log(error);
      }
    },
    importChat: async (description: string, messages: Message[], metadata?: IChatMetadata) => {
      try {
        const newId = await createChatFromMessages(description, messages, metadata);

        // Use contextual navigation to stay in meeting if applicable
        if (meetingContext) {
          window.location.href = `${meetingContext.basePath}?chat=${newId}`;
        } else {
          window.location.href = `/chat/${newId}`;
        }

        toast.success('Chat imported successfully');
      } catch (error) {
        if (error instanceof Error) {
          toast.error('Failed to import chat: ' + error.message);
        } else {
          toast.error('Failed to import chat');
        }
      }
    },
    exportChat: async (id = urlId) => {
      if (!id) {
        return;
      }

      const chat = await getChatById(id);
      if (!chat) {
        return;
      }
      const chatData = {
        messages: chat.messages,
        description: chat.description,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
