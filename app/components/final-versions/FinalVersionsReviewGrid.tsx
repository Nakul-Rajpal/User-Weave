/**
 * Final Versions Review Grid Component
 * Displays all final versions in a grid layout with voting buttons
 * Used in the code review page
 */

import { useState } from 'react';
import { type FinalVersionWithDetails } from '~/lib/persistence/supabase';
import { type FinalVersionVoteType, type VoteData } from '~/types/final-versions';
import { FinalVersionVoteButton } from './FinalVersionVoteButton';
import { VoteCommentModal } from './VoteCommentModal';

interface FinalVersionsReviewGridProps {
  finalVersions: FinalVersionWithDetails[];
  votes: Record<string, VoteData>;
  roomId: string;
  currentUserId: string;
  onVote: (versionId: string, vote: FinalVersionVoteType, comment?: string) => Promise<void>;
  onViewCode?: (version: FinalVersionWithDetails) => void;
  loading?: boolean;
}

export function FinalVersionsReviewGrid({
  finalVersions,
  votes,
  roomId,
  currentUserId,
  onVote,
  onViewCode,
  loading = false,
}: FinalVersionsReviewGridProps) {
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentModalData, setCommentModalData] = useState<{
    versionId: string;
    versionTitle: string;
    voteType: 'request_changes' | 'comment';
  } | null>(null);
  const [votingVersionId, setVotingVersionId] = useState<string | null>(null);

  const handleVoteClick = async (
    versionId: string,
    vote: FinalVersionVoteType,
    versionTitle: string,
    comment?: string
  ) => {
    // For 'approve', vote immediately
    if (vote === 'approve') {
      setVotingVersionId(versionId);
      try {
        await onVote(versionId, vote);
      } finally {
        setVotingVersionId(null);
      }
      return;
    }

    // For 'request_changes' or 'comment', show modal
    if (vote === 'request_changes' || vote === 'comment') {
      setCommentModalData({
        versionId,
        versionTitle,
        voteType: vote,
      });
      setShowCommentModal(true);
    }
  };

  const handleCommentSubmit = async (comment: string) => {
    if (!commentModalData) return;

    setVotingVersionId(commentModalData.versionId);
    try {
      await onVote(commentModalData.versionId, commentModalData.voteType, comment);
      setShowCommentModal(false);
      setCommentModalData(null);
    } finally {
      setVotingVersionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading final versions...</p>
        </div>
      </div>
    );
  }

  if (finalVersions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No Final Versions Yet</h3>
          <p className="text-gray-600">
            No users have selected a final version yet. Final versions will appear here once users mark their work as complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Final Versions ({finalVersions.length})
          </h2>
          <p className="text-gray-600">
            Review and vote on each user's final code version. Click vote buttons to provide feedback.
          </p>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {finalVersions.map((version) => {
            const voteData = votes[version.id] || {
              approve: 0,
              request_changes: 0,
              comment: 0,
            };
            const isVoting = votingVersionId === version.id;

            return (
              <div
                key={version.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* User Info Header */}
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {version.userName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 truncate">
                        {version.userName}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {version.userEmail}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-800 mb-2 line-clamp-2">
                    {version.chatTitle || 'Untitled Project'}
                  </h3>

                  {version.notes && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {version.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Selected {new Date(version.selectedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Vote Buttons */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-2 mb-3">
                    <FinalVersionVoteButton
                      icon="✅"
                      label="Approve"
                      count={voteData.approve}
                      isActive={voteData.userVote?.vote === 'approve'}
                      onClick={() => handleVoteClick(version.id, 'approve', version.chatTitle)}
                      color="green"
                      disabled={isVoting}
                    />
                    <FinalVersionVoteButton
                      icon="⚠️"
                      label="Changes"
                      count={voteData.request_changes}
                      isActive={voteData.userVote?.vote === 'request_changes'}
                      onClick={() =>
                        handleVoteClick(version.id, 'request_changes', version.chatTitle)
                      }
                      color="orange"
                      disabled={isVoting}
                    />
                    <FinalVersionVoteButton
                      icon="💬"
                      label="Comment"
                      count={voteData.comment}
                      isActive={voteData.userVote?.vote === 'comment'}
                      onClick={() => handleVoteClick(version.id, 'comment', version.chatTitle)}
                      color="blue"
                      disabled={isVoting}
                    />
                  </div>

                  {/* User's Vote Comment (if exists) */}
                  {voteData.userVote?.comment && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs font-semibold text-blue-800 mb-1">Your comment:</div>
                      <div className="text-sm text-blue-900">{voteData.userVote.comment}</div>
                    </div>
                  )}

                  {/* View Code Button */}
                  <button
                    onClick={() => onViewCode?.(version)}
                    className="
                      w-full mt-3 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg
                      hover:bg-gray-50 hover:border-gray-400
                      transition-colors text-sm font-medium
                      flex items-center justify-center gap-2
                    "
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View Code
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comment Modal */}
      {showCommentModal && commentModalData && (
        <VoteCommentModal
          versionId={commentModalData.versionId}
          versionTitle={commentModalData.versionTitle}
          voteType={commentModalData.voteType}
          onSubmit={handleCommentSubmit}
          onCancel={() => {
            setShowCommentModal(false);
            setCommentModalData(null);
          }}
        />
      )}
    </>
  );
}
