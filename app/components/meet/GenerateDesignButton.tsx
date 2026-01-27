/**
 * Generate Design Button
 * Triggers AI design generation from polling summary
 * Shows progress during generation
 */

'use client';

import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { supabase } from '~/lib/supabase/client';
import type { GenerateRoomDesignResponse } from '~/types/room-design';

interface GenerateDesignButtonProps {
  roomId: string;
  disabled?: boolean;
  summaryPointsCount: number;
  onSuccess?: (chatId: string) => void;
  onError?: (error: string) => void;
}

export default function GenerateDesignButton({
  roomId,
  disabled = false,
  summaryPointsCount,
  onSuccess,
  onError,
}: GenerateDesignButtonProps) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setProgress(10);
      setProgressMessage('Preparing prompt...');

      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('You must be logged in to generate designs');
      }

      setProgress(20);
      setProgressMessage('Sending to AI...');

      // Call the API to generate room design
      // Note: This will now wait for the AI to generate the complete response
      const response = await fetch('/api/meet/generate-room-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomId }),
      });

      setProgress(40);
      setProgressMessage('AI is generating code...');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate design');
      }

      setProgress(70);
      setProgressMessage('Saving design...');

      const data: GenerateRoomDesignResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setProgress(90);
      setProgressMessage('Opening code page...');

      // Success! Call the onSuccess callback
      if (onSuccess && data.chatId) {
        onSuccess(data.chatId);
      }

      setProgress(100);
      setProgressMessage('Complete!');

      // Navigate admin to the code page to view the generated design
      setTimeout(() => {
        navigate(`/${roomId}/design?chat=${data.chatId}`);
        setGenerating(false);
        setProgress(0);
        setProgressMessage('');
      }, 500);
    } catch (err: any) {
      console.error('Failed to generate room design:', err);
      setGenerating(false);
      setProgress(0);
      setProgressMessage('');

      if (onError) {
        onError(err.message || 'Failed to generate design');
      }
    }
  };

  const isDisabled = disabled || generating || summaryPointsCount === 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleGenerate}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
          isDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
        }`}
      >
        {generating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Generating Design...</span>
          </>
        ) : (
          <>
            <span className="text-xl">🎨</span>
            <span>Generate AI Design</span>
          </>
        )}
      </button>

      {/* Progress Bar */}
      {generating && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Help Text */}
      {summaryPointsCount === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
          ⚠️ Add at least one summary point before generating a design
        </p>
      )}

      {!generating && summaryPointsCount > 0 && (
        <p className="text-xs text-gray-600">
          Will create an initial UI design based on <strong>{summaryPointsCount}</strong> summary point
          {summaryPointsCount !== 1 ? 's' : ''}
        </p>
      )}

      {generating && (
        <div className="text-xs text-gray-600 space-y-1">
          <p className="flex items-center gap-2">
            {progress >= 20 && <span className="text-green-500">✓</span>}
            <span className={progress >= 20 ? 'text-gray-800' : 'text-gray-500'}>
              Preparing prompt...
            </span>
          </p>
          <p className="flex items-center gap-2">
            {progress >= 40 && <span className="text-green-500">✓</span>}
            <span className={progress >= 40 ? 'text-gray-800' : 'text-gray-500'}>
              Sending to AI...
            </span>
          </p>
          <p className="flex items-center gap-2">
            {progress >= 70 && <span className="text-green-500">✓</span>}
            <span className={progress >= 70 ? 'text-gray-800' : 'text-gray-500'}>
              AI is generating code... (this may take 30-60 seconds)
            </span>
          </p>
          <p className="flex items-center gap-2">
            {progress >= 90 && <span className="text-green-500">✓</span>}
            <span className={progress >= 90 ? 'text-gray-800' : 'text-gray-500'}>
              Saving and opening design...
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
