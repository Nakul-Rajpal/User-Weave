/**
 * Transcript and summary voting types
 */

export interface TranscriptEntry {
  timestamp: string;
  text: string;
  isFinal: boolean;
  participant?: string;
}

export interface MeetingTranscript {
  id: string;
  roomId: string;
  transcriptData: TranscriptEntry[];
  createdAt: string;
  createdByUserId: string;
}

export type SummaryCategory = 'decision' | 'action' | 'discussion' | 'question';

export type SummaryPointSource = 'ai' | 'host';

export interface SummaryPoint {
  id: string;
  text: string;
  category: SummaryCategory;
  source?: SummaryPointSource; // 'ai' for AI-generated, 'host' for host-added
  addedBy?: string; // User ID who added (for host-added points)
  addedAt?: string; // ISO timestamp when added
}

export interface TranscriptSummary {
  id: string;
  roomId: string;
  summaryPoints: SummaryPoint[];
  llmModel: string | null;
  generatedAt: string;
  generatedByUserId: string;
}

export type VoteType = 'agree' | 'disagree' | 'neutral';

export interface SummaryVote {
  id: string;
  summaryId: string;
  pointId: string;
  userId: string;
  vote: VoteType;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryPointWithVotes extends SummaryPoint {
  votes: {
    agree: number;
    disagree: number;
    neutral: number;
  };
  userVote?: VoteType; // Current user's vote
}

export interface SummaryWithVotes extends TranscriptSummary {
  points: SummaryPointWithVotes[];
}

// API request/response types
export interface SaveTranscriptRequest {
  roomName: string;
  transcript: TranscriptEntry[];
}

export interface GenerateSummaryRequest {
  roomId: string;
}

export interface GenerateSummaryResponse {
  success: boolean;
  summaryId: string;
  summary: TranscriptSummary;
}

export interface VoteRequest {
  summaryId: string;
  pointId: string;
  vote: VoteType;
}

export interface VoteResponse {
  success: boolean;
  vote: SummaryVote;
  updatedCounts: {
    agree: number;
    disagree: number;
    neutral: number;
  };
}

// Host-managed points API types
export interface AddPointRequest {
  roomId: string;
  text: string;
  category: SummaryCategory;
}

export interface AddPointResponse {
  success: boolean;
  point: SummaryPoint;
  summary: TranscriptSummary;
}

export interface EditPointRequest {
  summaryId: string;
  pointId: string;
  text: string;
  category: SummaryCategory;
}

export interface EditPointResponse {
  success: boolean;
  point: SummaryPoint;
  summary: TranscriptSummary;
}

export interface DeletePointRequest {
  summaryId: string;
  pointId: string;
}

export interface DeletePointResponse {
  success: boolean;
  deletedPointId: string;
  deletedVotesCount: number;
  summary: TranscriptSummary;
}
