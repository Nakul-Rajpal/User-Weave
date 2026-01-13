/**
 * Type definitions for Final Version Voting in Code Review
 */

/**
 * Vote types for final versions
 */
export type FinalVersionVoteType = 'like' | 'dislike';

/**
 * Final version vote record from database
 */
export interface FinalVersionVote {
  id: string;
  final_version_id: string;
  room_id: string;
  user_id: string;
  vote: FinalVersionVoteType;
  comment_text: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Aggregated vote data for a single final version
 */
export interface VoteData {
  like: number;
  dislike: number;
  userVote?: {
    vote: FinalVersionVoteType;
    comment: string | null;
    createdAt: string;
  };
}

/**
 * Map of final version IDs to their vote data
 */
export type VoteDataMap = Map<string, VoteData>;

/**
 * Vote submission payload
 */
export interface VoteSubmission {
  finalVersionId: string;
  roomId: string;
  vote: FinalVersionVoteType;
  commentText?: string;
}

/**
 * API response for vote submission
 */
export interface VoteResponse {
  success: boolean;
  vote?: FinalVersionVote;
  updatedCounts?: {
    like: number;
    dislike: number;
  };
  error?: string;
}

/**
 * API response for fetching votes
 */
export interface FetchVotesResponse {
  success: boolean;
  votes?: Record<string, VoteData>;
  error?: string;
}

// ============================================
// Discussion/Thread Types
// ============================================

/**
 * Discussion message record from database
 */
export interface FinalVersionDiscussion {
  id: string;
  final_version_id: string;
  room_id: string;
  user_id: string;
  parent_id: string | null;
  message_text: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Discussion message with user profile information
 */
export interface FinalVersionDiscussionWithUser extends FinalVersionDiscussion {
  user_email: string | null;
  user_name: string | null;
  user_avatar: string | null;
}

/**
 * Nested discussion thread structure
 */
export interface DiscussionThread extends FinalVersionDiscussionWithUser {
  replies: DiscussionThread[];
  replyCount: number;
}

/**
 * Discussion submission payload
 */
export interface DiscussionSubmission {
  finalVersionId: string;
  roomId: string;
  messageText: string;
  parentId?: string;
}

/**
 * API response for discussion submission
 */
export interface DiscussionResponse {
  success: boolean;
  discussion?: FinalVersionDiscussionWithUser;
  error?: string;
}

/**
 * API response for fetching discussions
 */
export interface FetchDiscussionsResponse {
  success: boolean;
  discussions?: DiscussionThread[];
  totalCount?: number;
  error?: string;
}

/**
 * Discussion update payload
 */
export interface DiscussionUpdate {
  id: string;
  messageText: string;
}
