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

  return (
    <div className="min-h-screen flex flex-col bg-bolt-elements-bg-depth-1">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        className="flex flex-col min-h-screen"
        onDisconnected={() => navigate('/')}
      >
        {/* Video tiles strip at top - FIXED HEIGHT, cannot expand */}
        <div
          className={`${styles.videoTileStripContainer} border-b border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1`}
          style={{
            height: '6rem',
            maxHeight: '6rem',
            minHeight: '6rem',
            flexShrink: 0,
            flexGrow: 0,
            overflow: 'hidden'
          }}
        >
          <div className={styles.stripContent}>
            <div className={styles.tilesContainer}>
              <VideoTiles />
            </div>

            <div className={styles.controlsContainer}>
              <ControlBar variation="minimal" />
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
