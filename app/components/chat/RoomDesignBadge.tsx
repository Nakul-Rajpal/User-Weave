/**
 * Room Design Badge
 * Shows when a chat is a forked room design
 * Displays information about the source and provides link to view original
 */

'use client';

import { useMemo } from 'react';
import type { ForkedDesignChatMetadata } from '~/types/room-design';

interface RoomDesignBadgeProps {
  metadata?: Record<string, any>;
  className?: string;
}

export default function RoomDesignBadge({ metadata, className = '' }: RoomDesignBadgeProps) {
  const isForkedDesign = useMemo(() => {
    if (!metadata) return false;
    return metadata.type === 'forked_design' || metadata.forked_from;
  }, [metadata]);

  const forkedInfo = useMemo(() => {
    if (!isForkedDesign || !metadata) return null;

    const forkedFrom = metadata.forked_from;
    const roomId = metadata.room_id;
    const forkedAt = metadata.forked_at;

    return { forkedFrom, roomId, forkedAt };
  }, [isForkedDesign, metadata]);

  if (!isForkedDesign || !forkedInfo) {
    return null;
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown time';

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return 'Unknown time';
    }
  };

  return (
    <div className={`bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <span className="text-2xl">🎨</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-purple-900">Room Design</span>
            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
              Your Copy
            </span>
          </div>

          <p className="text-xs text-purple-700 mb-2">
            This is your personal copy of the room design. You can modify and build upon it independently.
          </p>

          <div className="flex items-center gap-4 text-xs text-purple-600">
            {forkedInfo.roomId && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Room: <span className="font-mono font-medium">{forkedInfo.roomId}</span>
              </span>
            )}
            {forkedInfo.forkedAt && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Created {formatDate(forkedInfo.forkedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Additional info */}
      <div className="mt-2 pt-2 border-t border-purple-200">
        <p className="text-xs text-purple-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Your changes won't affect other users' designs. Check{' '}
            <a href={`/${forkedInfo.roomId}/design-implications`} className="underline hover:text-purple-800">
              Design Implications
            </a>
            {' '}for design history.
          </span>
        </p>
      </div>
    </div>
  );
}
