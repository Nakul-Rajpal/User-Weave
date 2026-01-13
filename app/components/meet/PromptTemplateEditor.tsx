/**
 * Prompt Template Editor
 * Allows host to configure the AI design generation prompt template
 * Includes template text and configuration fields
 */

'use client';

import { useState, useEffect } from 'react';
import { getOrCreatePromptTemplate, updatePromptTemplate } from '~/lib/persistence/supabase';
import type { PromptTemplate, ComplexityLevel } from '~/types/room-design';

interface PromptTemplateEditorProps {
  roomId: string;
}

export default function PromptTemplateEditor({ roomId }: PromptTemplateEditorProps) {
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Form fields
  const [templateText, setTemplateText] = useState('');
  const [techStack, setTechStack] = useState('');
  const [designPreference, setDesignPreference] = useState('');
  const [complexityLevel, setComplexityLevel] = useState<ComplexityLevel>('Production-ready');

  useEffect(() => {
    loadTemplate();
  }, [roomId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrCreatePromptTemplate(roomId);
      setTemplate(data);

      // Populate form fields
      setTemplateText(data.template);
      setTechStack(data.tech_stack);
      setDesignPreference(data.design_preference);
      setComplexityLevel(data.complexity_level as ComplexityLevel);
    } catch (err: any) {
      console.error('Failed to load prompt template:', err);
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await updatePromptTemplate(roomId, {
        template: templateText,
        tech_stack: techStack,
        design_preference: designPreference,
        complexity_level: complexityLevel,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Reload to get updated timestamp
      await loadTemplate();
    } catch (err: any) {
      console.error('Failed to save prompt template:', err);
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (template) {
      setTemplateText(template.template);
      setTechStack(template.tech_stack);
      setDesignPreference(template.design_preference);
      setComplexityLevel(template.complexity_level as ComplexityLevel);
      setSuccess(false);
      setError(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm text-gray-600">Loading template...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">Prompt Template Settings</h3>
            <p className="text-xs text-gray-600">
              Configure AI design generation parameters
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
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
          {/* Tech Stack */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tech Stack
            </label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="e.g., React, TypeScript, Tailwind CSS"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Design Preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Design Preference
            </label>
            <input
              type="text"
              value={designPreference}
              onChange={(e) => setDesignPreference(e.target.value)}
              placeholder="e.g., Modern, Clean UI"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Complexity Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Complexity Level
            </label>
            <select
              value={complexityLevel}
              onChange={(e) => setComplexityLevel(e.target.value as ComplexityLevel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="Simple">Simple</option>
              <option value="Medium">Medium</option>
              <option value="Production-ready">Production-ready</option>
            </select>
          </div>

          {/* Template Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt Template
              <span className="text-xs text-gray-500 ml-2">
                (Use placeholders: {'{SUMMARY_POINTS}'}, {'{TECH_STACK}'}, {'{DESIGN_PREFERENCE}'}, {'{COMPLEXITY}'})
              </span>
            </label>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              placeholder="Enter your prompt template here..."
            />
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
              ✓ Template saved successfully!
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </span>
              ) : (
                'Save Template'
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-medium rounded-md transition-colors text-sm"
            >
              Reset
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-700">
            <strong>💡 Tip:</strong> The placeholders will be automatically replaced with actual data when generating the design.
          </div>
        </div>
      )}
    </div>
  );
}
