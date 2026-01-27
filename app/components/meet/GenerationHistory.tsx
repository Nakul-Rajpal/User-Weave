/**
 * Generation History
 * Shows history of AI design generations for the room
 * Allows navigation to previous designs
 */

'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { getRoomDesignChats, subscribeToRoomDesignChats, getUserForkOfDesign, forkRoomDesignChat } from '~/lib/persistence/supabase';
import type { RoomDesignChat } from '~/types/room-design';

interface GenerationHistoryProps {
  roomId: string;
}

export default function GenerationHistory({ roomId }: GenerationHistoryProps) {
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<RoomDesignChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingDesign, setLoadingDesign] = useState<string | null>(null);

  useEffect(() => {
    loadDesigns();

    // Subscribe to real-time updates
    const subscription = subscribeToRoomDesignChats(roomId, (newDesign) => {
      console.log('New design generated:', newDesign);
      // Prepend new design to the list
      setDesigns((prev) => [newDesign, ...prev]);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId]);

  const loadDesigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRoomDesignChats(roomId);
      setDesigns(data);
    } catch (err: any) {
      console.error('Failed to load design history:', err);
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDesign = async (chatId: string) => {
    try {
      setLoadingDesign(chatId);
      console.log('👀 [HISTORY] Viewing design:', chatId);

      // Check if user already has a fork of this design
      const existingFork = await getUserForkOfDesign(chatId);

      if (existingFork) {
        console.log('✅ [HISTORY] User has existing fork:', existingFork.url_id);
        // Navigate to existing fork in the meeting room code page
        navigate(`/${roomId}/design?chat=${existingFork.url_id}`);
      } else {
        console.log('🍴 [HISTORY] Creating fork for user...');
        // Create fork for this user
        const forkedChat = await forkRoomDesignChat(chatId, roomId);
        console.log('✅ [HISTORY] Fork created:', forkedChat.url_id);
        // Navigate to new fork in the meeting room code page
        navigate(`/${roomId}/design?chat=${forkedChat.url_id}`);
      }
    } catch (error: any) {
      console.error('❌ [HISTORY] Failed to access design:', error);
      setError(`Failed to open design: ${error.message}`);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoadingDesign(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (designs.length === 0 && !loading) {
    return null; // Don't show component if there's no history
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">Generation History</h3>
            <p className="text-xs text-gray-600">
              {designs.length} design{designs.length !== 1 ? 's' : ''} generated
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="p-4 flex items-center justify-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-sm">Loading history...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 text-sm">{error}</div>
          ) : designs.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No designs generated yet
            </div>
          ) : (
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {designs.map((design, index) => (
                <div
                  key={design.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">
                          Version {designs.length - index}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        Generated {formatDate(design.generated_at)}
                      </p>

                      {/* Show truncated prompt */}
                      {design.prompt_used && (
                        <details className="text-xs text-gray-500 mb-2">
                          <summary className="cursor-pointer hover:text-gray-700">
                            View prompt
                          </summary>
                          <pre className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap font-mono text-xs max-h-32 overflow-y-auto">
                            {design.prompt_used}
                          </pre>
                        </details>
                      )}
                    </div>

                    <button
                      onClick={() => handleViewDesign(design.chat_id)}
                      disabled={loadingDesign === design.chat_id}
                      className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium flex items-center gap-1"
                    >
                      {loadingDesign === design.chat_id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          <span>Loading...</span>
                        </>
                      ) : (
                        'View'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Info */}
          {designs.length > 0 && !loading && (
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                💡 Each generation creates a new chat. All users get their own editable copy.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
