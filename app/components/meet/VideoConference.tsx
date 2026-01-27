'use client';

// Note: LiveKit CSS is loaded globally in root.tsx to ensure
// it's available during client-side navigation
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useNavigate } from '@remix-run/react';
import { useState, useRef } from 'react';
import TranscriptPanel, { type TranscriptPanelHandle } from './TranscriptPanel';
import DualChatPanel from './DualChatPanel';

// Unified message type for both text and images
interface ChatMessage {
  id: string;
  messageType: 'text' | 'image';
  senderUsername: string;
  content: string; // text content or image URL
  imagePrompt?: string;
  createdAt: string;
}

interface VideoConferenceProps {
  token: string;
  serverUrl: string;
  roomName: string;
}

export default function VideoConference({
  token,
  serverUrl,
  roomName
}: VideoConferenceProps) {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<'transcripts' | 'chat'>('transcripts');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const transcriptPanelRef = useRef<TranscriptPanelHandle>(null);

  // Navigate to workflow, saving transcripts first
  const handleNavigateToWorkflow = async () => {
    // Save transcripts before navigating
    if (transcriptPanelRef.current?.hasTranscripts()) {
      console.log('📝 Saving transcripts before navigating to workflow...');
      await transcriptPanelRef.current.saveTranscripts();
      console.log('✅ Transcripts saved, navigating to workflow');
    }
    navigate(`/${roomName}/workflow`);
  };

  const handleLeaveRoom = async () => {
    // Trigger transcript download before leaving if on transcript panel
    if (activePanel === 'transcripts') {
      const transcriptPanel = document.querySelector('[data-transcript-panel]');
      if (transcriptPanel) {
        const downloadButton = transcriptPanel.querySelector('button[title="Download JSON"]') as HTMLButtonElement;
        if (downloadButton) {
          downloadButton.click();
        }
      }
    }

    // Small delay to ensure download triggers
    setTimeout(() => {
      navigate('/');
    }, 500);
  };

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onConnected={() => console.log('Connected to room:', roomName)}
      onDisconnected={() => {
        console.log('Disconnected from room');
        navigate('/');
      }}
    >
      <div className="h-screen flex bg-gray-900">
        {/* Main video area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <MyVideoConference />
          </div>

          {/* Control bar with workflow button */}
          <div className="p-4 bg-black flex items-center justify-between">
            <button
              onClick={handleNavigateToWorkflow}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
            >
              🔀 Workflow
            </button>

            <div className="flex items-center gap-2">
              <ControlBar variation="minimal" />
            </div>
          </div>
        </div>

        {/* Side panel container */}
        <div className="w-[400px] bg-white dark:bg-gray-800 flex flex-col border-l border-gray-700">
          {/* Panel tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActivePanel('transcripts')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activePanel === 'transcripts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Transcripts
            </button>
            <button
              onClick={() => setActivePanel('chat')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activePanel === 'chat'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Panel content - both panels stay mounted to preserve state */}
          <div className="flex-1 overflow-hidden relative">
            <div
              data-transcript-panel
              style={{ height: '100%' }}
              className={activePanel === 'transcripts' ? 'block' : 'hidden'}
            >
              <TranscriptPanel ref={transcriptPanelRef} roomName={roomName} />
            </div>
            <div
              style={{ height: '100%' }}
              className={activePanel === 'chat' ? 'block' : 'hidden'}
            >
              <DualChatPanel
                roomName={roomName}
                messages={messages}
                setMessages={setMessages}
              />
            </div>
          </div>
        </div>
      </div>

      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function MyVideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Filter to only show camera tracks - explicitly exclude screen share tracks
  const filteredTracks = tracks.filter(trackRef => {
    const source = trackRef.publication?.source;
    // Only keep camera tracks, explicitly exclude screen share
    return source === Track.Source.Camera;
  });

  return (
    <GridLayout tracks={filteredTracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  );
}
