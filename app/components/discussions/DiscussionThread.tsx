/**
 * DiscussionThread Component
 * Recursively renders threaded discussion messages with replies
 * Features: User avatars, timestamps, edit indicator, nested replies (max 3 levels)
 */

import { useState } from 'react';
import type { DiscussionThread as DiscussionThreadType } from '~/types/final-versions';
import { DiscussionInput } from './DiscussionInput';

interface DiscussionThreadProps {
  thread: DiscussionThreadType;
  currentUserId: string;
  onReply: (parentId: string, message: string) => Promise<void>;
  onEdit?: (id: string, message: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  depth?: number;
  maxDepth?: number;
}

export function DiscussionThread({
  thread,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  depth = 0,
  maxDepth = 3,
}: DiscussionThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnMessage = thread.user_id === currentUserId;
  const canReply = depth < maxDepth;
  // Fallback: name > email > shortened user_id > "Unknown User"
  const userName = thread.user_name ||
                   thread.user_email ||
                   (thread.user_id ? `User ${thread.user_id.substring(0, 8)}` : 'Unknown User');
  const userInitial = userName[0]?.toUpperCase() || 'U';

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleReply = async (message: string) => {
    setIsReplying(true);
    try {
      await onReply(thread.id, message);
      setShowReplyInput(false);
    } finally {
      setIsReplying(false);
    }
  };

  const handleEdit = async (message: string) => {
    if (!onEdit) return;
    try {
      await onEdit(thread.id, message);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !confirm('Delete this message and all its replies?')) return;
    setIsDeleting(true);
    try {
      await onDelete(thread.id);
    } catch (error) {
      console.error('Failed to delete message:', error);
      setIsDeleting(false);
    }
  };

  // Left border colors based on depth
  const borderColors = [
    'border-l-blue-400',
    'border-l-purple-400',
    'border-l-pink-400',
    'border-l-orange-400',
  ];
  const borderColor = borderColors[depth % borderColors.length];

  return (
    <div
      className={`
        ${depth > 0 ? `ml-6 pl-4 border-l-2 ${borderColor}` : ''}
      `}
    >
      {/* Message Card */}
      <div
        className={`
          group relative bg-white dark:bg-gray-800 rounded-lg p-4 mb-3
          ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
          hover:shadow-sm transition-shadow
        `}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Header: User info and timestamp */}
        <div className="flex items-start gap-3 mb-2">
          {/* Avatar */}
          <div
            className={`
              w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm
              ${isOwnMessage ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'}
            `}
          >
            {userInitial}
          </div>

          {/* User name and timestamp */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                {userName}
              </span>
              {isOwnMessage && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  You
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimestamp(thread.created_at)}
              </span>
              {thread.is_edited && (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  (edited)
                </span>
              )}
            </div>
          </div>

          {/* Action buttons (show on hover) */}
          {showActions && !isEditing && (
            <div className="flex items-center gap-1">
              {canReply && (
                <button
                  onClick={() => setShowReplyInput(!showReplyInput)}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Reply"
                >
                  <i className="i-ph:arrow-bend-down-left text-sm" />
                </button>
              )}
              {isOwnMessage && onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                  title="Edit"
                >
                  <i className="i-ph:pencil-simple text-sm" />
                </button>
              )}
              {isOwnMessage && onDelete && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete"
                >
                  <i className="i-ph:trash text-sm" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Message content */}
        {isEditing ? (
          <div className="mt-2">
            <DiscussionInput
              onSubmit={handleEdit}
              onCancel={() => setIsEditing(false)}
              initialValue={thread.message_text}
              placeholder="Edit your message..."
              submitLabel="Save"
              showCancel={true}
              autoFocus={true}
            />
          </div>
        ) : (
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap ml-12">
            {thread.message_text}
          </div>
        )}

        {/* Reply count indicator */}
        {thread.replyCount > 0 && (
          <div className="mt-2 ml-12 text-xs text-gray-500 dark:text-gray-400">
            {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
          </div>
        )}
      </div>

      {/* Reply Input */}
      {showReplyInput && canReply && (
        <div className="ml-12 mb-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
          <DiscussionInput
            onSubmit={handleReply}
            onCancel={() => setShowReplyInput(false)}
            placeholder={`Reply to ${userName}...`}
            submitLabel={isReplying ? 'Sending...' : 'Reply'}
            showCancel={true}
            autoFocus={true}
            replyToUser={userName}
          />
        </div>
      )}

      {/* Nested Replies (Recursive) */}
      {thread.replies && thread.replies.length > 0 && (
        <div className={depth > 0 ? 'mt-2' : ''}>
          {thread.replies.map((reply) => (
            <DiscussionThread
              key={reply.id}
              thread={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}

      {/* Max depth reached message */}
      {!canReply && depth === maxDepth && (
        <div className="ml-12 text-xs text-gray-400 dark:text-gray-500 italic">
          Maximum reply depth reached
        </div>
      )}
    </div>
  );
}
