/**
 * Vote Comment Modal Component
 * Allows users to add comments when voting "Request Changes" or "Comment"
 * on a final version during code review
 */

import { useState } from 'react';
import { type FinalVersionVoteType } from '~/types/final-versions';

interface VoteCommentModalProps {
  versionId: string;
  versionTitle: string;
  voteType: 'request_changes' | 'comment';
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}

export function VoteCommentModal({
  versionId,
  versionTitle,
  voteType,
  onSubmit,
  onCancel,
}: VoteCommentModalProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxLength = 500;

  const handleSubmit = async () => {
    if (!comment.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(comment.trim());
      // Parent component will close modal
    } catch (error) {
      console.error('Failed to submit vote:', error);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    // Close on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const voteConfig = {
    request_changes: {
      icon: '⚠️',
      title: 'Request Changes',
      placeholder: 'Explain what changes you\'d like to see in this code...',
      submitLabel: 'Request Changes',
      color: 'orange',
    },
    comment: {
      icon: '💬',
      title: 'Add Comment',
      placeholder: 'Add your comment about this code version...',
      submitLabel: 'Submit Comment',
      color: 'blue',
    },
  };

  const config = voteConfig[voteType];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">{config.icon}</span>
                  {config.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  For: <span className="font-semibold">{versionTitle}</span>
                </p>
              </div>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                disabled={isSubmitting}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, maxLength))}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              className="
                w-full h-40 px-4 py-3 border border-gray-300 rounded-lg
                resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                text-gray-800 placeholder-gray-400
                transition-all
              "
              autoFocus
              disabled={isSubmitting}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-gray-500">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">
                  Ctrl+Enter
                </kbd>{' '}
                to submit
              </div>
              <div className="text-sm text-gray-600">
                <span className={comment.length >= maxLength ? 'text-red-600 font-semibold' : ''}>
                  {comment.length}
                </span>
                /{maxLength}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 flex gap-3 justify-end bg-gray-50">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="
                px-5 py-2.5 border border-gray-300 rounded-lg
                text-gray-700 font-medium
                hover:bg-gray-100 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!comment.trim() || isSubmitting}
              className={`
                px-5 py-2.5 rounded-lg font-medium
                text-white transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${config.color === 'orange'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                config.submitLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
