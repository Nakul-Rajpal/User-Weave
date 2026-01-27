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

  // Check if we're on a room route (/:roomId or /:roomId/*)
  // Exclude known non-room routes
  const pathParts = location.pathname.split('/').filter(Boolean);
  const firstSegment = pathParts[0];
  const knownNonRoomRoutes = ['api', 'chat', 'git', 'final-versions', 'webcontainer'];

  const roomId = params.roomId;
  const isMeeting = !!roomId || (!!firstSegment && !knownNonRoomRoutes.includes(firstSegment));
  const isCodeMode = isMeeting && location.pathname.includes('/design');

  const basePath = isMeeting && (roomId || firstSegment) ? `/${roomId || firstSegment}/design` : null;

  return {
    isMeeting,
    isCodeMode,
    roomId: roomId || firstSegment,
    basePath,
  };
}
