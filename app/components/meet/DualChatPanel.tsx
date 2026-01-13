'use client';

import { useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { subscribeToChatMessages } from '~/lib/persistence/supabase';

interface ChatMessage {
  id: string;
  messageType: 'text' | 'image';
  senderUsername: string;
  content: string; // text content or image URL
  imagePrompt?: string;
  createdAt: string;
}

interface DualChatPanelProps {
  roomName: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export default function DualChatPanel({ roomName, messages, setMessages }: DualChatPanelProps) {
  const [userInput, setUserInput] = useState('');
  const [isImageMode, setIsImageMode] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isTextSending, setIsTextSending] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const room = useRoomContext();

  // Fetch chat history from Supabase on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await fetch(`/api/meet/chat-message?roomId=${encodeURIComponent(roomName)}`);
        const data = await response.json();

        if (data.messages) {
          // Transform database format to component format
          const transformedMessages = data.messages.map((msg: any) => ({
            id: msg.id,
            messageType: msg.message_type,
            senderUsername: msg.sender_username,
            content: msg.content,
            imagePrompt: msg.image_prompt,
            createdAt: msg.created_at,
          }));
          setMessages(transformedMessages);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [roomName]);

  // Subscribe to real-time messages from Supabase
  useEffect(() => {
    const subscription = subscribeToChatMessages(roomName, (newMessage: any) => {
      const transformedMessage: ChatMessage = {
        id: newMessage.id,
        messageType: newMessage.message_type,
        senderUsername: newMessage.sender_username,
        content: newMessage.content,
        imagePrompt: newMessage.image_prompt,
        createdAt: newMessage.created_at,
      };

      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === transformedMessage.id)) {
          return prev;
        }
        return [...prev, transformedMessage];
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [roomName]);

  const sendUserMessage = async () => {
    if (!userInput.trim() || isTextSending || isImageMode) return;

    const messageContent = userInput.trim();
    const username = room?.localParticipant?.identity || 'Anonymous';

    setIsTextSending(true);
    setUserInput('');

    try {
      // Save to Supabase
      const response = await fetch('/api/meet/chat-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomName,
          messageType: 'text',
          content: messageContent,
          senderUsername: username,
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Error sending message: ${data.error}`);
        setUserInput(messageContent); // Restore message on error
      }
      // Message will appear via Supabase realtime subscription
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
      setUserInput(messageContent); // Restore message on error
    } finally {
      setIsTextSending(false);
    }
  };

  const generateImage = async () => {
    if (!userInput.trim() || isImageLoading) return;

    const prompt = userInput;
    const username = room?.localParticipant?.identity || 'Anonymous';

    setIsImageLoading(true);
    setUserInput('');

    try {
      // Generate image
      const imageResponse = await fetch('/api/meet/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          roomId: roomName,
          username: username,
        }),
      });

      const imageData = await imageResponse.json();

      if (imageData.imageUrl) {
        // Convert OpenAI URL to our proxy URL to avoid CORS issues
        const proxyImageUrl = `/api/meet/image/proxy?url=${encodeURIComponent(imageData.imageUrl)}`;

        // Save image message to Supabase
        const saveResponse = await fetch('/api/meet/chat-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomName,
            messageType: 'image',
            content: proxyImageUrl,
            senderUsername: username,
            imagePrompt: prompt,
          }),
        });

        const saveData = await saveResponse.json();

        if (saveData.error) {
          alert(`Error saving image: ${saveData.error}`);
        }

        // Exit image mode after successful generation
        setIsImageMode(false);
        // Message will appear via Supabase realtime subscription
      } else if (imageData.error) {
        alert(`Error: ${imageData.error}`);
        setUserInput(prompt); // Restore prompt on error
      }
    } catch (error) {
      console.error('Image generation error:', error);
      alert('Sorry, I encountered an error. Please try again.');
      setUserInput(prompt); // Restore prompt on error
    } finally {
      setIsImageLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (isImageMode) {
      generateImage();
    } else {
      sendUserMessage();
    }
  };

  return (
    <div className={`h-full flex flex-col relative transition-all duration-300 ${
      isImageMode
        ? 'bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/30 dark:via-pink-900/20 dark:to-blue-900/30'
        : 'bg-white dark:bg-gray-800'
    }`}>
      {/* Animated background overlay for image mode */}
      {isImageMode && (
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 dark:bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 right-0 w-72 h-72 bg-pink-300 dark:bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-blue-300 dark:bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      )}

      {/* Header with title */}
      <div className={`relative z-10 p-4 pb-2 border-b transition-colors ${
        isImageMode
          ? 'border-purple-200 dark:border-purple-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm'
          : 'border-gray-200 dark:border-gray-700'
      }`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Team Chat
        </h2>
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-4 pt-2 min-h-0 overflow-hidden">
        {/* Chat messages */}
        <div className={`flex-1 overflow-y-auto rounded-lg p-4 mb-4 min-h-0 transition-colors ${
          isImageMode
            ? 'bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm'
            : 'bg-gray-50 dark:bg-gray-900'
        }`}>
          {isLoadingHistory ? (
            <div className="text-center py-8 text-gray-500">
              Loading chat history...
            </div>
          ) : messages.length === 0 ? (
            <div className={`text-center py-8 ${isImageMode ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-500'}`}>
              {isImageMode
                ? '🎨 Describe an image you want to generate!'
                : 'No messages yet. Start chatting with other participants!'}
            </div>
          ) : (
            /* Render all messages in chronological order */
            messages.map((msg) => (
              msg.messageType === 'text' ? (
                <div key={msg.id} className="mb-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {msg.senderUsername}:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {msg.content}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ) : (
                <div key={msg.id} className="mb-4 pb-4 border-b border-purple-200 dark:border-purple-700 last:border-0 animate-fadeIn">
                  <div className="mb-2">
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      {msg.senderUsername}
                    </span>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      generated an image ✨
                    </span>
                  </div>
                  <div className="ml-4 p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg shadow-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 italic font-medium">
                      "{msg.imagePrompt}"
                    </p>
                    <div className="relative w-full">
                      {imageErrors.has(msg.id) ? (
                        <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-center">
                          <p className="text-red-600 dark:text-red-400 mb-2">Failed to load image</p>
                          <a
                            href={msg.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 underline text-sm"
                          >
                            Open image in new tab
                          </a>
                        </div>
                      ) : (
                        <img
                          src={msg.content}
                          alt={msg.imagePrompt || 'Generated image'}
                          className="w-full h-auto rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
                          crossOrigin="anonymous"
                          onError={() => {
                            console.error('Image load error:', msg.content);
                            setImageErrors(prev => new Set(prev).add(msg.id));
                          }}
                          onLoad={() => {
                            console.log('Image loaded successfully:', msg.content);
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                      {!imageErrors.has(msg.id) && (
                        <a
                          href={msg.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          Open full size →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            ))
          )}

          {isImageLoading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              {/* Animated spinner with gradient */}
              <div className="relative">
                <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-800 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin"></div>
                <div className="absolute top-2 left-2 w-12 h-12 border-4 border-transparent border-t-pink-600 dark:border-t-pink-400 rounded-full animate-spin-slow"></div>
              </div>

              {/* Loading text with animation */}
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-purple-600 dark:text-purple-400 animate-pulse">
                  ✨ Generating your image...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI is creating something amazing for you
                </p>
              </div>

              {/* Progress dots */}
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce animation-delay-200"></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce animation-delay-400"></div>
              </div>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isImageMode
                ? 'Describe the image to generate...'
                : 'Type a message...'
            }
            className={`flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
              isImageMode
                ? 'border-purple-300 dark:border-purple-600 focus:ring-purple-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            }`}
            disabled={isTextSending || isImageLoading}
          />
          <button
            onClick={() => setIsImageMode(!isImageMode)}
            className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-105 ${
              isImageMode
                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/50'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title={isImageMode ? 'Switch to text chat' : 'Generate image'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleSendMessage}
            disabled={(isTextSending && !isImageMode) || (isImageLoading && isImageMode) || !userInput.trim()}
            className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              isImageMode
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isImageMode
              ? (isImageLoading ? 'Generating...' : 'Generate')
              : (isTextSending ? 'Sending...' : 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}
