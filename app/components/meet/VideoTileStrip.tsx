'use client';

// Note: LiveKit CSS is loaded globally in root.tsx to ensure
// it's available during client-side navigation
import {
  LiveKitRoom,
  useTracks,
  TrackRefContext,
  VideoTrack,
  ControlBar,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useNavigate } from '@remix-run/react';
import styles from './VideoTileStrip.module.scss';

interface Props {
  token: string;
  serverUrl: string;
  roomName: string;
  children?: React.ReactNode;
}

export default function VideoTileStrip({ token, serverUrl, roomName, children }: Props) {
  const navigate = useNavigate();

  console.log('📹 [VIDEO_STRIP] Rendering with:', {
    hasToken: !!token,
    serverUrl,
    roomName,
    tokenLength: token?.length,
    hasChildren: !!children,
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        className="flex flex-col h-full overflow-hidden"
        onConnected={() => console.log('✅ [VIDEO_STRIP] Connected to LiveKit room:', roomName)}
        onDisconnected={() => {
          console.log('🔌 [VIDEO_STRIP] Disconnected from room');
          navigate('/meet');
        }}
      >
        {/* Video tiles strip at top */}
        <div className={`${styles.videoTileStripContainer} border-b border-bolt-elements-borderColor bg-black flex-shrink-0`}>
          <div className={styles.stripContent}>
            <div className={styles.tilesContainer}>
              <VideoTiles />
            </div>

            <div className={styles.controlsContainer}>
              <ControlBar variation="minimal" />

              <button
                onClick={() => navigate(`/meet/${roomName}/workflow`)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 whitespace-nowrap text-sm"
              >
                🔀 Workflow
              </button>
            </div>
          </div>
        </div>

        {/* Render children inside LiveKitRoom context - fills remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </LiveKitRoom>
    </div>
  );
}

function VideoTiles() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );

  return (
    <>
      {tracks.slice(0, 6).map((trackRef) => (
        <TrackRefContext.Provider value={trackRef} key={trackRef.participant.sid}>
          <div className="w-24 h-16 shrink-0 rounded overflow-hidden bg-gray-800 relative">
            <VideoTrack className="w-full h-full object-cover" />
            <div className="absolute bottom-0.5 left-0.5 text-[10px] text-white bg-black/50 px-1 rounded">
              {trackRef.participant.identity}
            </div>
          </div>
        </TrackRefContext.Provider>
      ))}
      {tracks.length > 6 && (
        <div className="w-24 h-16 shrink-0 rounded bg-gray-700 flex items-center justify-center text-white text-xs">
          +{tracks.length - 6} more
        </div>
      )}
    </>
  );
}
