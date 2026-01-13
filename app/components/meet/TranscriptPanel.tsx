'use client';

import { useEffect, useState, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { supabase } from '~/lib/supabase/client';
import Cookies from 'js-cookie';
import APIKeyConfigModal from './APIKeyConfigModal';

interface TranscriptEntry {
  timestamp: string;
  text: string;
  isFinal: boolean;
  participant?: string;
}

export default function TranscriptPanel({ roomName }: { roomName: string }) {
  const room = useRoomContext();
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [currentInterim, setCurrentInterim] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const [hasAPIKeys, setHasAPIKeys] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if current user is global admin
  const checkAdminStatus = async () => {
    // Check localStorage first (fast)
    const localAdminStatus = localStorage.getItem('isAdmin');
    if (localAdminStatus === 'true') {
      setIsAdmin(true);
    }

    // Always verify with server
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/meet/check-admin', { headers });
      const data = await response.json();

      setIsAdmin(data.isAdmin);

      if (data.isAdmin) {
        localStorage.setItem('isAdmin', 'true');
      } else {
        localStorage.removeItem('isAdmin');
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
      localStorage.removeItem('isAdmin');
    }
  };

  // Check if API keys are configured (only for admins)
  const checkAPIKeys = () => {
    const storedApiKeys = Cookies.get('apiKeys');
    if (storedApiKeys) {
      try {
        const keys = JSON.parse(storedApiKeys);
        const hasKeys = !!(keys.OpenAI || keys.Anthropic);
        setHasAPIKeys(hasKeys);
        return hasKeys;
      } catch {
        setHasAPIKeys(false);
        return false;
      }
    }
    setHasAPIKeys(false);
    return false;
  };

  // Check admin status on mount
  useEffect(() => {
    checkAdminStatus();
  }, []);

  // Check API keys on mount and when modal closes (only if admin)
  useEffect(() => {
    if (isAdmin) {
      checkAPIKeys();
    }
  }, [isAdmin, showAPIKeyModal]);

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      try {
        const message = JSON.parse(decoder.decode(payload));

        if (message.type === 'transcription') {
          if (message.isFinal) {
            setTranscripts(prev => {
              const newTranscripts = [...prev, {
                timestamp: new Date().toLocaleTimeString(),
                text: message.text,
                isFinal: true,
                participant: message.participant
              }];
              return newTranscripts;
            });
            setCurrentInterim('');
          } else {
            setCurrentInterim(message.text);
          }
        }
      } catch (error) {
        console.error('Error parsing transcription:', error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, roomName]);

  // Auto-save transcripts when component unmounts (user leaves)
  useEffect(() => {
    return () => {
      if (transcripts.length > 0) {
        saveTranscriptsToServer();
      }
    };
  }, [transcripts]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, currentInterim]);

  const saveTranscriptsToServer = async () => {
    if (transcripts.length === 0) return;

    try {
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      await fetch('/api/meet/transcript', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          roomName,
          transcript: transcripts
        })
      });
      console.log('Transcripts saved to server');
    } catch (error) {
      console.error('Failed to save transcripts:', error);
    }
  };

  const downloadTranscripts = () => {
    if (transcripts.length === 0) {
      alert('No transcripts to download');
      return;
    }

    const transcriptData = {
      room: roomName,
      date: new Date().toISOString(),
      duration: {
        start: transcripts[0]?.timestamp,
        end: transcripts[transcripts.length - 1]?.timestamp
      },
      transcripts: transcripts.map(t => ({
        timestamp: t.timestamp,
        participant: t.participant || 'Unknown',
        text: t.text
      }))
    };

    // Create blob and download
    const blob = new Blob([JSON.stringify(transcriptData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${roomName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also save to server
    saveTranscriptsToServer();
  };

  const exportAsText = () => {
    if (transcripts.length === 0) {
      alert('No transcripts to export');
      return;
    }

    let textContent = `Meeting Transcript\n`;
    textContent += `Room: ${roomName}\n`;
    textContent += `Date: ${new Date().toLocaleDateString()}\n`;
    textContent += `Time: ${new Date().toLocaleTimeString()}\n`;
    textContent += `${'='.repeat(50)}\n\n`;

    transcripts.forEach(entry => {
      textContent += `[${entry.timestamp}] ${entry.participant || 'Unknown'}: ${entry.text}\n\n`;
    });

    // Create blob and download
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${roomName}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateSummary = async () => {
    if (transcripts.length === 0) {
      alert('No transcripts to summarize');
      return;
    }

    // Check if API keys are configured
    if (!checkAPIKeys()) {
      if (confirm('No API keys configured. Would you like to configure them now?')) {
        setShowAPIKeyModal(true);
      }
      return;
    }

    if (!confirm('Generate AI summary from this transcript? This will use your LLM API credits.')) {
      return;
    }

    try {
      setGeneratingSummary(true);

      // First save transcripts to ensure they're in the database
      await saveTranscriptsToServer();

      // Get auth token for summary generation
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Then generate summary
      const response = await fetch('/api/meet/summarize', {
        method: 'POST',
        headers,
        body: JSON.stringify({ roomId: roomName }),
      });

      const data = await response.json();

      if (!data.success) {
        // Log debug information if present
        if (data.debug) {
          console.log('🔍 === SERVER DEBUG INFO ===');
          console.log('Environment Variables:', {
            processEnvAvailable: data.debug.processEnvAvailable,
            openaiKeyInProcessEnv: data.debug.openaiKeyInProcessEnv,
            anthropicKeyInProcessEnv: data.debug.anthropicKeyInProcessEnv,
            openaiKeyInServerEnv: data.debug.openaiKeyInServerEnv,
            anthropicKeyInServerEnv: data.debug.anthropicKeyInServerEnv,
          });
          console.log('Context:', {
            contextType: data.debug.contextType,
            contextEnvExists: data.debug.contextEnvExists,
            contextEnvKeys: data.debug.contextEnvKeys,
          });
          console.log('Process Env Keys:', data.debug.processEnvKeys);
          console.log('Merged Server Env Keys:', data.debug.mergedServerEnvKeys);
          console.log('API Keys Detection:', data.debug.apiKeyDetection);
          console.log('Available Models:', {
            total: data.debug.totalModelsAvailable,
            providers: data.debug.availableProviders,
            byProvider: data.debug.modelsByProvider,
          });
          console.log('Full Debug Info:', data.debug);
          console.log('🔍 === END DEBUG INFO ===');
        }
        throw new Error(data.message);
      }

      alert(`✅ Summary generated successfully! ${data.pointCount} points extracted.\n\nGo to the Poll page to view and vote on summary points.`);
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      alert(`Failed to generate summary: ${error.message}`);
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Live Transcripts
          {isAdmin && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500 text-white rounded uppercase">
              ADMIN
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          {/* Admin-only features */}
          {isAdmin && (
            <>
              {!hasAPIKeys && (
                <button
                  onClick={() => setShowAPIKeyModal(true)}
                  className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                  title="Configure API Keys for AI Summarization"
                >
                  ⚙️ API Keys
                </button>
              )}
              <button
                onClick={generateSummary}
                disabled={generatingSummary || transcripts.length === 0}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  generatingSummary || transcripts.length === 0
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
                title="Generate AI Summary"
              >
                {generatingSummary ? '⏳ Generating...' : '🤖 AI Summary'}
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2"
      >
        {transcripts.length === 0 && !currentInterim && (
          <div className="text-gray-500 text-center py-8">
            Transcriptions will appear here when people speak...
          </div>
        )}

        {transcripts.map((entry, idx) => (
          <div key={idx} className="border-l-4 border-blue-500 pl-3 py-1">
            <div className="flex justify-between items-start">
              <span className="text-xs text-gray-500">{entry.timestamp}</span>
              {entry.participant && (
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                  {entry.participant}
                </span>
              )}
            </div>
            <p className="text-gray-900 dark:text-white mt-1">{entry.text}</p>
          </div>
        ))}

        {currentInterim && (
          <div className="border-l-4 border-gray-400 pl-3 py-1 italic">
            <p className="text-gray-600 dark:text-gray-400">{currentInterim}...</p>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        {transcripts.length} transcripts • Auto-saves on exit
        {isAdmin && !hasAPIKeys && (
          <span className="ml-2 text-orange-500">• Configure API keys to enable AI summarization</span>
        )}
        {!isAdmin && (
          <span className="ml-2 text-gray-400">• Admin-only features hidden</span>
        )}
      </div>

      {/* API Key Configuration Modal - Only for admins */}
      {isAdmin && (
        <APIKeyConfigModal
          isOpen={showAPIKeyModal}
          onClose={() => setShowAPIKeyModal(false)}
        />
      )}
    </div>
  );
}
