import { useLocation, useParams } from '@remix-run/react';

export interface MeetingContext {
  /**
   * Whether the user is currently in a meeting context
   */
  isMeeting: boolean;

  /**
   * Whether the user is in coding mode within a meeting
   */
  isCodeMode: boolean;

  /**
   * The current room ID if in a meeting
   */
  roomId: string | undefined;

  /**
   * The base path for the current meeting context
   * e.g., "/meet/room-xyz/code" or null if not in a meeting
   */
  basePath: string | null;
}

/**
 * Hook to detect and provide meeting context information
 *
 * Use this hook to determine if the user is currently in a meeting
 * and to get the appropriate navigation paths that keep them in the meeting.
 *
 * @returns {MeetingContext} Meeting context information
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isMeeting, basePath } = useMeetingContext();
 *
 *   const chatLink = isMeeting && basePath
 *     ? `${basePath}?chat=${chatId}`
 *     : `/chat/${chatId}`;
 *
 *   return <a href={chatLink}>Chat</a>;
 * }
 * ```
 */
export function useMeetingContext(): MeetingContext {
  const location = useLocation();
  const params = useParams();

  const isMeeting = location.pathname.startsWith('/meet/');
  const roomId = params.roomId;
  const isCodeMode = isMeeting && location.pathname.includes('/code');

  const basePath = isMeeting && roomId ? `/meet/${roomId}/code` : null;

  return {
    isMeeting,
    isCodeMode,
    roomId,
    basePath,
  };
}
