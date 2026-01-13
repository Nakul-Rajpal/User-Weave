/**
 * ThreadedDiscussionModal Component
 * Full-screen modal for viewing and participating in threaded discussions
 * Features: Real-time updates, nested threads, create/edit/delete messages
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/lib/supabase/client';
import { getCurrentUser } from '~/lib/supabase/auth';
import type { FinalVersionWithDetails } from '~/lib/persistence/supabase';
import type { DiscussionThread as DiscussionThreadType, FetchDiscussionsResponse, DiscussionResponse } from '~/types/final-versions';
import { DiscussionThread } from './DiscussionThread';
import { DiscussionInput } from './DiscussionInput';
import { toast } from 'react-toastify';

interface ThreadedDiscussionModalProps {
  finalVersion: FinalVersionWithDetails;
  roomId: string;
  onClose: () => void;
}

export function ThreadedDiscussionModal({
  finalVersion,
  roomId,
  onClose,
}: ThreadedDiscussionModalProps) {
  const [discussions, setDiscussions] = useState<DiscussionThreadType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  // Fetch discussions
  const fetchDiscussions = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[DISCUSSIONS CLIENT] 🚀 Fetching discussions...', {
        finalVersionId: finalVersion.id,
        roomId,
        url: `/api/meet/final-version-discussions/${finalVersion.id}/${roomId}`,
      });

      const response = await fetch(
        `/api/meet/final-version-discussions/${finalVersion.id}/${roomId}`
      );

      console.log('[DISCUSSIONS CLIENT] 📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      const data = (await response.json()) as FetchDiscussionsResponse;

      console.log('[DISCUSSIONS CLIENT] 📦 Response data:', {
        success: data.success,
        hasDiscussions: !!(data as any).discussions,
        discussionCount: (data as any).discussions?.length || 0,
        totalCount: (data as any).totalCount,
        error: data.error,
        debug: (data as any).debug,
      });

      if (data.success) {
        setDiscussions(data.discussions || []);
        setTotalCount(data.totalCount || 0);
        console.log('[DISCUSSIONS CLIENT] ✅ Discussions loaded successfully');
      } else {
        console.error('[DISCUSSIONS CLIENT] ❌ Failed to fetch discussions:', {
          error: data.error,
          debug: (data as any).debug,
          fullResponse: data,
        });
        toast.error(`Failed to load discussions: ${data.error}`);
      }
    } catch (error) {
      console.error('[DISCUSSIONS CLIENT] ❌ Error fetching discussions:', {
        error,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
      });
      toast.error('Error loading discussions');
    } finally {
      setLoading(false);
    }
  }, [finalVersion.id, roomId]);

  // Initial fetch
  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`discussions:${finalVersion.id}:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'final_version_discussions',
          filter: `final_version_id=eq.${finalVersion.id}`,
        },
        (payload) => {
          console.log('[Discussions] Real-time update:', payload);
          // Refetch discussions on any change
          fetchDiscussions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [finalVersion.id, roomId, fetchDiscussions]);

  // Create new top-level discussion
  const handleCreateDiscussion = async (message: string) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/meet/final-version-discussion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalVersionId: finalVersion.id,
          roomId,
          messageText: message,
          userId: currentUserId,
        }),
      });

      const data = (await response.json()) as DiscussionResponse;
      if (data.success) {
        toast.success('Message posted!');
        // Real-time subscription will update the list
      } else {
        toast.error(data.error || 'Failed to post message');
      }
    } catch (error) {
      console.error('Error creating discussion:', error);
      toast.error('Error posting message');
    } finally {
      setSubmitting(false);
    }
  };

  // Reply to existing discussion
  const handleReply = async (parentId: string, message: string) => {
    try {
      const response = await fetch('/api/meet/final-version-discussion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalVersionId: finalVersion.id,
          roomId,
          messageText: message,
          parentId,
          userId: currentUserId,
        }),
      });

      const data = (await response.json()) as DiscussionResponse;
      if (data.success) {
        toast.success('Reply posted!');
      } else {
        toast.error(data.error || 'Failed to post reply');
      }
    } catch (error) {
      console.error('Error replying:', error);
      toast.error('Error posting reply');
    }
  };

  // Edit discussion
  const handleEdit = async (id: string, message: string) => {
    try {
      const response = await fetch('/api/meet/final-version-discussion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, messageText: message, userId: currentUserId }),
      });

      const data = (await response.json()) as DiscussionResponse;
      if (data.success) {
        toast.success('Message updated!');
      } else {
        toast.error(data.error || 'Failed to update message');
      }
    } catch (error) {
      console.error('Error editing discussion:', error);
      toast.error('Error updating message');
    }
  };

  // Delete discussion
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch('/api/meet/final-version-discussion', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId: currentUserId }),
      });

      const data = (await response.json()) as { success: boolean; id?: string; error?: string };
      if (data.success) {
        toast.success('Message deleted!');
      } else {
        toast.error(data.error || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting discussion:', error);
      toast.error('Error deleting message');
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const versionTitle = finalVersion.chatTitle || 'Untitled Project';
  const userName = finalVersion.userName || 'Unknown User';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 truncate">
                Discussion: {versionTitle}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                by {userName} • {totalCount} {totalCount === 1 ? 'message' : 'messages'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <i className="i-ph:x text-xl" />
            </button>
          </div>

          {/* Discussion List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Loading discussions...</p>
                </div>
              </div>
            ) : discussions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  No discussions yet
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                  Start the conversation! Share your thoughts, feedback, or questions about this design.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {discussions.map((thread) => (
                  <DiscussionThread
                    key={thread.id}
                    thread={thread}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* New Message Input */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <DiscussionInput
              onSubmit={handleCreateDiscussion}
              placeholder="Share your thoughts on this design..."
              submitLabel={submitting ? 'Posting...' : 'Post'}
              autoFocus={false}
            />
          </div>
        </div>
      </div>
    </>
  );
}
