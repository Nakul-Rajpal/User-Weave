import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from livekit import agents, rtc
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.plugins import deepgram
from livekit.agents.stt import SpeechEventType
from dotenv import load_dotenv
import threading

load_dotenv()

class TranscriptionAgent:
    def __init__(self):
        self.room = None
        self.stt = None
        self.processing_tracks = set()  # Track which audio tracks we're already processing

    async def entrypoint(self, ctx: JobContext):
        """Main entry point for the agent."""
        # Initialize Deepgram STT with valid parameters for LiveKit plugin
        self.stt = deepgram.STT(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            model="nova-2",
            language="en-US",
            punctuate=True,
            interim_results=True
        )
        
        # Connect to the room
        await ctx.connect()
        self.room = ctx.room
        
        print(f"🎙️ Transcription agent connected to room: {self.room.name}")
        print(f"👥 Participants in room: {len(self.room.remote_participants)}")
        
        # Process existing participants
        for participant in self.room.remote_participants.values():
            await self.process_participant_tracks(participant)
        
        # Handle new participants joining
        @self.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            print(f"👋 New participant joined: {participant.identity}")
            asyncio.create_task(self.process_participant_tracks(participant))
        
        # Handle track subscriptions
        @self.room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                print(f"🔊 New audio track from {participant.identity}")
                asyncio.create_task(self.process_audio_track(track, participant))
        
        # Handle track unsubscriptions
        @self.room.on("track_unsubscribed")
        def on_track_unsubscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                print(f"🔇 Audio track removed from {participant.identity}")
                track_id = f"{participant.sid}_{track.sid}"
                self.processing_tracks.discard(track_id)
        
        # Handle data messages (for chat coordination if needed)
        @self.room.on("data_received")
        def on_data_received(data: rtc.DataPacket):
            try:
                if data.topic == "lk.chat":
                    message = data.data.decode('utf-8')
                    print(f"💬 Chat message received: {message}")
            except Exception as e:
                print(f"Error processing data: {e}")
        
        # Optional: Send periodic status updates
        async def send_status_updates():
            while True:
                await asyncio.sleep(30)  # Every 30 seconds
                status_message = {
                    "type": "agent_status",
                    "status": "active",
                    "processing_tracks": len(self.processing_tracks),
                    "timestamp": datetime.now().isoformat()
                }
                data = json.dumps(status_message).encode('utf-8')
                await self.room.local_participant.publish_data(data, reliable=True)
                print(f"📊 Status update sent: {len(self.processing_tracks)} tracks processing")
        
        # Start status updates
        asyncio.create_task(send_status_updates())
        
        print("✅ Agent is running and processing audio...")
        
        # Keep the agent running
        await asyncio.Event().wait()

    async def process_participant_tracks(self, participant: rtc.RemoteParticipant):
        """Process all tracks from a participant."""
        for publication in participant.track_publications.values():
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
                await self.process_audio_track(publication.track, participant)

    async def process_audio_track(self, track: rtc.Track, participant: rtc.RemoteParticipant):
        """Process a single audio track for transcription."""
        track_id = f"{participant.sid}_{track.sid}"
        
        # Avoid processing the same track twice
        if track_id in self.processing_tracks:
            print(f"⚠️ Already processing track {track_id}")
            return
        
        self.processing_tracks.add(track_id)
        print(f"🎤 Starting transcription for {participant.identity} (track: {track_id})")
        
        try:
            # Create STT stream (no arguments)
            stt_stream = self.stt.stream()
            
            # Create audio stream from track
            audio_stream = rtc.AudioStream(track)
            
            # Process both streams concurrently
            async def process_stt_events():
                """Process events from STT stream"""
                async for event in stt_stream:
                    if event.type == SpeechEventType.INTERIM_TRANSCRIPT:
                        # Send interim transcript
                        if event.alternatives and len(event.alternatives) > 0:
                            text = event.alternatives[0].text
                            if text.strip():  # Only send non-empty transcripts
                                await self.send_transcription(
                                    text=text,
                                    is_final=False,
                                    participant=participant.identity,
                                    confidence=event.alternatives[0].confidence if hasattr(event.alternatives[0], 'confidence') else None
                                )
                    
                    elif event.type == SpeechEventType.FINAL_TRANSCRIPT:
                        # Send final transcript and save
                        if event.alternatives and len(event.alternatives) > 0:
                            text = event.alternatives[0].text
                            if text.strip():  # Only send non-empty transcripts
                                await self.send_transcription(
                                    text=text,
                                    is_final=True,
                                    participant=participant.identity,
                                    confidence=event.alternatives[0].confidence if hasattr(event.alternatives[0], 'confidence') else None
                                )
                                # Save to local file
                                self.save_transcript(text, participant.identity)
                    
                    elif event.type == SpeechEventType.END_OF_SPEECH:
                        print(f"🔚 End of speech detected for {participant.identity}")
            
            async def push_audio_frames():
                """Push audio frames to STT stream"""
                async for audio_event in audio_stream:
                    # Push audio frame to STT stream
                    stt_stream.push_frame(audio_event.frame)
                
                # End the input when audio stream is done
                stt_stream.end_input()
            
            # Run both tasks concurrently
            await asyncio.gather(
                process_stt_events(),
                push_audio_frames()
            )
        
        except Exception as e:
            print(f"❌ Error processing audio for {participant.identity}: {e}")
        finally:
            self.processing_tracks.discard(track_id)
            print(f"🛑 Stopped processing track {track_id}")
    
    async def send_transcription(self, text: str, is_final: bool, participant: str, confidence: float = None):
        """Send transcription to all participants via data message."""
        if not text.strip():
            return
        
        message = {
            "type": "transcription",
            "text": text,
            "isFinal": is_final,
            "participant": participant,
            "timestamp": datetime.now().isoformat(),
            "confidence": confidence  # Include confidence score if available
        }
        
        data = json.dumps(message).encode('utf-8')
        await self.room.local_participant.publish_data(
            data,
            reliable=True
        )
        
        if is_final:
            print(f"📝 [{participant}]: {text}")
        else:
            print(f"💭 [{participant}]: {text}...")
    
    def save_transcript(self, text: str, participant: str):
        """Save transcript to JSON file."""
        if not text.strip():
            return
        
        # Create transcripts directory at project root
        transcript_dir = Path(__file__).parent.parent / "transcripts"
        transcript_dir.mkdir(exist_ok=True, parents=True)
        
        # Create filename with room name and date
        filename = transcript_dir / f"{self.room.name}_{datetime.now().strftime('%Y-%m-%d')}.json"
        
        entry = {
            "timestamp": datetime.now().isoformat(),
            "participant": participant,
            "text": text,
            "room": self.room.name
        }
        
        # Load existing transcripts or create new list
        if filename.exists():
            try:
                with open(filename, 'r') as f:
                    transcripts = json.load(f)
            except json.JSONDecodeError:
                transcripts = []
        else:
            transcripts = []
        
        transcripts.append(entry)
        
        # Save updated transcripts
        with open(filename, 'w') as f:
            json.dump(transcripts, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved transcript to {filename}")

async def main(ctx: JobContext):
    """Main entrypoint for the worker."""
    agent = TranscriptionAgent()
    await agent.entrypoint(ctx)

# HTTP Server for Render health checks - runs in background thread
def run_health_server():
    """Run a simple HTTP server for health checks in a background thread"""
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import json

    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "transcription-agent",
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode())

        def log_message(self, format, *args):
            # Suppress default logging
            pass

    port = int(os.getenv("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), HealthHandler)
    print(f"🌐 Health check server running on port {port}")
    server.serve_forever()

if __name__ == "__main__":
    import sys

    # Get environment variables with defaults
    api_key = os.getenv("LIVEKIT_API_KEY", "devkey")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "secret")
    ws_url = os.getenv("LIVEKIT_WS_URL", "ws://localhost:7880")

    print(f"🚀 Starting Transcription Agent")
    print(f"📡 Connecting to LiveKit at: {ws_url}")
    print(f"🔑 Using API Key: {api_key[:10]}...")

    # Verify Deepgram API key
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    if not deepgram_key:
        print("⚠️ WARNING: DEEPGRAM_API_KEY not found in environment variables!")
        print("Please set DEEPGRAM_API_KEY in your .env file")
    else:
        print(f"🔑 Deepgram API Key: {deepgram_key[:10]}...")

    # Check if running in production (Render sets PORT env variable)
    is_production = os.getenv("PORT") is not None and "dev" not in sys.argv

    if is_production:
        print("🚀 Running in PRODUCTION mode (Render)")
        # Start health check server in background thread
        health_thread = threading.Thread(target=run_health_server, daemon=True)
        health_thread.start()
    else:
        print("🚀 Running in DEVELOPMENT mode")

    # IMPORTANT: Set sys.argv to include 'start' command for production mode
    # This simulates: python transcription_agent.py start
    if 'dev' not in sys.argv:
        sys.argv = ['transcription_agent.py', 'start']

    # Run LiveKit agent in main thread (required for signal handlers)
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=main,
            api_key=api_key,
            api_secret=api_secret,
            ws_url=ws_url
        )
    )