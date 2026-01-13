/**
 * Type definitions for Room Design Generation Feature
 * Allows admin to generate AI designs from polling summary for all users
 */

/**
 * Complexity level options for design generation
 */
export type ComplexityLevel = 'Simple' | 'Medium' | 'Production-ready';

/**
 * Prompt template record from database
 * Stores configurable template and preferences for AI design generation
 */
export interface PromptTemplate {
  id: string;
  room_id: string;
  template: string;
  tech_stack: string;
  design_preference: string;
  complexity_level: ComplexityLevel;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

/**
 * Room design chat record from database
 * Tracks each AI design generation and links to the created chat
 */
export interface RoomDesignChat {
  id: string;
  room_id: string;
  chat_id: string;
  generated_by: string;
  generated_at: string;
  prompt_used: string;
  metadata: Record<string, any>;
}

/**
 * Payload for creating a new prompt template
 */
export interface CreatePromptTemplatePayload {
  room_id: string;
  template: string;
  tech_stack: string;
  design_preference: string;
  complexity_level: ComplexityLevel;
}

/**
 * Payload for updating an existing prompt template
 */
export interface UpdatePromptTemplatePayload {
  template?: string;
  tech_stack?: string;
  design_preference?: string;
  complexity_level?: ComplexityLevel;
}

/**
 * Payload for generating a room design
 */
export interface GenerateRoomDesignPayload {
  roomId: string;
}

/**
 * Response from room design generation API
 */
export interface GenerateRoomDesignResponse {
  success: boolean;
  chatId?: string;
  designChatId?: string;
  error?: string;
  message?: string;
}

/**
 * Response from fetching prompt template
 */
export interface FetchPromptTemplateResponse {
  success: boolean;
  template?: PromptTemplate;
  error?: string;
}

/**
 * Response from saving prompt template
 */
export interface SavePromptTemplateResponse {
  success: boolean;
  template?: PromptTemplate;
  error?: string;
  message?: string;
}

/**
 * Response from fetching room design history
 */
export interface FetchRoomDesignHistoryResponse {
  success: boolean;
  designs?: RoomDesignChat[];
  error?: string;
}

/**
 * Placeholder types used in prompt template
 */
export const PROMPT_PLACEHOLDERS = {
  SUMMARY_POINTS: '{SUMMARY_POINTS}',
  TECH_STACK: '{TECH_STACK}',
  DESIGN_PREFERENCE: '{DESIGN_PREFERENCE}',
  COMPLEXITY: '{COMPLEXITY}',
} as const;

/**
 * Default prompt template text
 */
export const DEFAULT_PROMPT_TEMPLATE = `You are building a web application based on meeting requirements and discussions.

REQUIREMENTS FROM MEETING:
{SUMMARY_POINTS}

TECHNICAL SPECIFICATIONS:
- Tech Stack: {TECH_STACK}
- Design Preference: {DESIGN_PREFERENCE}
- Complexity Level: {COMPLEXITY}

Please create a complete, functional web application with:
1. Modern, responsive UI following the design preferences
2. Well-structured component architecture
3. Proper error handling and loading states
4. Clean, maintainable code
5. All necessary configuration files

Generate all necessary files to run this application immediately.`;

/**
 * Default values for prompt template fields
 */
export const DEFAULT_TEMPLATE_VALUES = {
  tech_stack: 'React, TypeScript, Tailwind CSS',
  design_preference: 'Modern, Clean UI',
  complexity_level: 'Production-ready' as ComplexityLevel,
};

/**
 * Chat metadata for room design chats
 */
export interface RoomDesignChatMetadata {
  type: 'room_design';
  room_id: string;
}

/**
 * Chat metadata for forked design chats
 */
export interface ForkedDesignChatMetadata {
  type?: 'forked_design';
  forked_from: string; // Source chat_id
  room_id: string;
}
