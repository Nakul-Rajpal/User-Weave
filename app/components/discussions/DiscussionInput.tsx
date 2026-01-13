/**
 * DiscussionInput Component
 * Text input for creating new discussion messages or replies
 * Features: Character limit, keyboard shortcuts, auto-focus
 */

import { useState, useRef, useEffect } from 'react';

interface DiscussionInputProps {
  onSubmit: (message: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  initialValue?: string;
  autoFocus?: boolean;
  showCancel?: boolean;
  submitLabel?: string;
  maxLength?: number;
  replyToUser?: string | null;
}

export function DiscussionInput({
  onSubmit,
  onCancel,
  placeholder = 'Write your message...',
  initialValue = '',
  autoFocus = true,
  showCancel = false,
  submitLabel = 'Send',
  maxLength = 1000,
  replyToUser,
}: DiscussionInputProps) {
  const [message, setMessage] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 0 && trimmedMessage.length <= maxLength) {
      onSubmit(trimmedMessage);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    // Escape to cancel (if cancel handler provided)
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const remainingChars = maxLength - message.length;
  const isOverLimit = message.length > maxLength;
  const isEmpty = message.trim().length === 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Reply indicator */}
      {replyToUser && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
          <i className="i-ph:arrow-bend-down-right text-blue-600 dark:text-blue-400" />
          <span>
            Replying to <span className="font-medium">{replyToUser}</span>
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="ml-auto text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Cancel reply"
            >
              <i className="i-ph:x text-sm" />
            </button>
          )}
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`
            w-full px-4 py-3 rounded-lg border resize-none
            focus:outline-none focus:ring-2 focus:ring-blue-500
            dark:bg-gray-800 dark:border-gray-700 dark:text-white
            ${isOverLimit ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
          `}
          rows={3}
          maxLength={maxLength + 100} // Allow typing over limit to show error
        />
      </div>

      {/* Footer with character count and buttons */}
      <div className="flex items-center justify-between gap-3">
        {/* Character count */}
        <div
          className={`text-sm ${
            isOverLimit
              ? 'text-red-600 dark:text-red-400 font-medium'
              : remainingChars < 50
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {remainingChars} characters remaining
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Keyboard hint */}
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            {submitLabel}: <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl</kbd>
            +<kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd>
          </span>

          {showCancel && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={isEmpty || isOverLimit}
            className={`
              px-5 py-2 text-sm font-medium rounded-lg transition-all
              ${
                isEmpty || isOverLimit
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
              }
            `}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
