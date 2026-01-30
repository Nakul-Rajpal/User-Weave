import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

interface APIKeyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface APIKeys {
  OpenAI?: string;
}

function getApiKeysFromCookies(): APIKeys {
  const storedApiKeys = Cookies.get('apiKeys');
  if (storedApiKeys) {
    try {
      return JSON.parse(storedApiKeys);
    } catch {
      return {};
    }
  }
  return {};
}

export default function APIKeyConfigModal({ isOpen, onClose }: APIKeyConfigModalProps) {
  const [openAIKey, setOpenAIKey] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing keys when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedKeys = getApiKeysFromCookies();
      setOpenAIKey(savedKeys.OpenAI || '');
    }
  }, [isOpen]);

  const handleSave = () => {
    setSaving(true);

    try {
      // Get existing keys from cookies
      const currentKeys = getApiKeysFromCookies();

      // Update with new keys (only if they're not empty)
      const newKeys = { ...currentKeys };

      if (openAIKey.trim()) {
        newKeys.OpenAI = openAIKey.trim();
      } else {
        delete newKeys.OpenAI;
      }

      // Save to cookies
      Cookies.set('apiKeys', JSON.stringify(newKeys), { expires: 365 });

      alert('✅ API key saved successfully! You can now use AI summarization.');
      onClose();
    } catch (error) {
      console.error('Failed to save API key:', error);
      alert('Failed to save API key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasKey = openAIKey.trim();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Configure API Key
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            To use AI summarization, you need to provide your OpenAI API key. Your key is stored securely in your browser and sent only when generating summaries.
          </p>

          {/* OpenAI API Key */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              OpenAI API Key (GPT-4)
            </label>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
            >
              Get OpenAI API key →
            </a>
          </div>

          {/* Show/Hide Toggle */}
          <div className="mb-6">
            <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showKeys}
                onChange={(e) => setShowKeys(e.target.checked)}
                className="mr-2"
              />
              Show API key
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                       transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasKey || saving}
              className={`flex-1 px-4 py-2 rounded-md text-white transition-colors ${
                hasKey && !saving
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving...' : 'Save Key'}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            💡 Your OpenAI API key will be used for AI-powered features like transcript summarization.
          </p>
        </div>
      </div>
    </>
  );
}
