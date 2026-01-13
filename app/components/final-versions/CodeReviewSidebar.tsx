/**
 * Code Review Sidebar Component
 * Optimized for narrow sidebar display with voting functionality
 * Single-column layout with compact cards
 */

import { useState } from 'react';
import type { FinalVersionWithDetails } from '~/lib/persistence/supabase';
import type { FinalVersionVoteType, VoteData } from '~/types/final-versions';
import { ThreadedDiscussionModal } from '../discussions/ThreadedDiscussionModal';

interface CodeReviewSidebarProps {
  finalVersions: FinalVersionWithDetails[];
  votes: Record<string, VoteData>;
  currentUserId: string;
  selectedVersionId: string | null;
  roomId: string;
  onVote: (versionId: string, vote: FinalVersionVoteType, comment?: string) => Promise<void>;
  onViewCode: (version: FinalVersionWithDetails) => void;
  loading?: boolean;
}

export function CodeReviewSidebar({
  finalVersions,
  votes,
  currentUserId,
  selectedVersionId,
  roomId,
  onVote,
  onViewCode,
  loading = false,
}: CodeReviewSidebarProps) {
  const [votingVersionId, setVotingVersionId] = useState<string | null>(null);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [discussionVersion, setDiscussionVersion] = useState<FinalVersionWithDetails | null>(null);

  const handleVoteClick = async (versionId: string, vote: FinalVersionVoteType) => {
    setVotingVersionId(versionId);
    try {
      await onVote(versionId, vote);
    } finally {
      setVotingVersionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Loading versions...</p>
        </div>
      </div>
    );
  }

  if (finalVersions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Final Versions</h3>
          <p className="text-sm text-gray-600">
            Final versions will appear here once users mark their work as complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>📋</span>
            Final Versions ({finalVersions.length})
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            Review and vote on code submissions
          </p>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {finalVersions.map((version) => {
            const voteData = votes[version.id] || {
              like: 0,
              dislike: 0,
            };
            const isVoting = votingVersionId === version.id;
            const isSelected = selectedVersionId === version.id;

            return (
              <div
                key={version.id}
                className={`
                  rounded-lg border bg-white shadow-sm hover:shadow-md transition-all
                  ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                `}
              >
                {/* User Header */}
                <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0">
                      {version.userName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800 truncate">
                        {version.userName}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {version.userEmail}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 text-blue-500" title="Currently viewing">
                        👁️
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-gray-800 mb-1 line-clamp-2">
                    {version.chatTitle || 'Untitled Project'}
                  </h3>

                  {version.notes && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {version.notes}
                    </p>
                  )}

                  <div className="text-xs text-gray-500 mb-3">
                    📅 {new Date(version.selectedAt).toLocaleDateString()}
                  </div>

                  {/* Like/Dislike Vote Buttons */}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => handleVoteClick(version.id, 'like')}
                      disabled={isVoting}
                      className={`
                        flex-1 px-3 py-2 rounded text-sm font-medium transition-all
                        ${
                          voteData.userVote?.vote === 'like'
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700 border border-gray-300'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                      title="Like this version"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base">👍</span>
                        <span>{voteData.like > 0 ? voteData.like : ''}</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleVoteClick(version.id, 'dislike')}
                      disabled={isVoting}
                      className={`
                        flex-1 px-3 py-2 rounded text-sm font-medium transition-all
                        ${
                          voteData.userVote?.vote === 'dislike'
                            ? 'bg-red-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700 border border-gray-300'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                      title="Dislike this version"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base">👎</span>
                        <span>{voteData.dislike > 0 ? voteData.dislike : ''}</span>
                      </div>
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {/* View Code Button */}
                    <button
                      onClick={() => onViewCode(version)}
                      className={`
                        flex-1 px-3 py-2 rounded text-sm font-medium transition-all
                        ${
                          isSelected
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                        }
                      `}
                    >
                      {isSelected ? '👁️ Viewing' : '👁️ View Code'}
                    </button>

                    {/* Discussion Button */}
                    <button
                      onClick={() => {
                        setDiscussionVersion(version);
                        setShowDiscussionModal(true);
                      }}
                      className="px-3 py-2 rounded text-sm font-medium transition-all bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300"
                      title="View discussions"
                    >
                      💬
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Discussion Modal */}
      {showDiscussionModal && discussionVersion && (
        <ThreadedDiscussionModal
          finalVersion={discussionVersion}
          roomId={roomId}
          onClose={() => {
            setShowDiscussionModal(false);
            setDiscussionVersion(null);
          }}
        />
      )}
    </>
  );
}
