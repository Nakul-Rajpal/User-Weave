/**
 * Design Implications Panel
 * Displays AI-generated design implications from meeting transcript
 * All participants can edit when readOnly is false
 */

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '~/lib/supabase/client';
import { useWorkflowStore } from '~/lib/stores/workflowStore';
import type { SummaryWithVotes, SummaryPointWithVotes, SummaryCategory } from '~/types/transcript';

interface DesignImplicationsPanelProps {
  roomId: string;
  readOnly?: boolean; // When true, edit controls are hidden
}

const CATEGORY_COLORS = {
  decision: 'bg-green-100 text-green-800 border-green-300',
  action: 'bg-orange-100 text-orange-800 border-orange-300',
  discussion: 'bg-blue-100 text-blue-800 border-blue-300',
  question: 'bg-purple-100 text-purple-800 border-purple-300',
};

const HOST_CATEGORY_COLORS = {
  decision: 'bg-green-50 text-green-700 border-green-200 border-dashed',
  action: 'bg-orange-50 text-orange-700 border-orange-200 border-dashed',
  discussion: 'bg-blue-50 text-blue-700 border-blue-200 border-dashed',
  question: 'bg-purple-50 text-purple-700 border-purple-200 border-dashed',
};

const CATEGORY_ICONS = {
  decision: '(decision)',
  action: '(action)',
  discussion: '(discussion)',
  question: '(question)',
};

export default function DesignImplicationsPanel({ roomId, readOnly = false }: DesignImplicationsPanelProps) {
  const { isHost } = useWorkflowStore();
  const [summary, setSummary] = useState<SummaryWithVotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Point management state
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [newPointText, setNewPointText] = useState('');
  const [newPointCategory, setNewPointCategory] = useState<SummaryCategory>('discussion');
  const [addingPoint, setAddingPoint] = useState(false);

  // Edit point state
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState<SummaryCategory>('discussion');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [roomId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/meet/summary/${roomId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      setSummary(data.summary);
    } catch (err: any) {
      console.error('Failed to fetch design implications:', err);
      setError(err.message || 'Failed to load design implications');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPoint = async () => {
    if (!newPointText.trim()) return;

    try {
      setAddingPoint(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/meet/summary/add-point', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          roomId,
          text: newPointText.trim(),
          category: newPointCategory,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // Refresh to get updated points
      await fetchSummary();

      // Reset form
      setNewPointText('');
      setNewPointCategory('discussion');
      setIsAddingPoint(false);

      console.log('Design implication added successfully');
    } catch (err: any) {
      console.error('Failed to add design implication:', err);
      alert(`Failed to add: ${err.message}`);
    } finally {
      setAddingPoint(false);
    }
  };

  const handleStartEdit = (point: SummaryPointWithVotes) => {
    setEditingPointId(point.id);
    setEditText(point.text);
    setEditCategory(point.category);
  };

  const handleCancelEdit = () => {
    setEditingPointId(null);
    setEditText('');
    setEditCategory('discussion');
  };

  const handleSaveEdit = async (pointId: string) => {
    if (!summary || !editText.trim()) return;

    try {
      setSavingEdit(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/meet/summary/edit-point', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          summaryId: summary.id,
          pointId,
          text: editText.trim(),
          category: editCategory,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // Refresh to get updated points
      await fetchSummary();
      handleCancelEdit();

      console.log('Design implication edited successfully');
    } catch (err: any) {
      console.error('Failed to edit design implication:', err);
      alert(`Failed to edit: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!summary) return;

    if (!confirm('Delete this design implication?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/meet/summary/delete-point', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          summaryId: summary.id,
          pointId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // Refresh to get updated points
      await fetchSummary();

      console.log('Design implication deleted');
    } catch (err: any) {
      console.error('Failed to delete design implication:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2">Loading...</div>
          <div className="text-sm text-gray-600">Loading design implications...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2">Error</div>
          <div className="text-sm text-red-600">{error}</div>
          <button
            onClick={fetchSummary}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Determine source type for badge display
  const summarySource = summary?.llmModel ? 'ai_generated' : 'manual';

  return (
    <div className="h-full flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800">Design Implications</h2>
            {summary && (
              <span
                className={`text-xs px-2 py-1 rounded font-medium ${
                  summarySource === 'ai_generated'
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-blue-100 text-blue-700 border border-blue-300'
                }`}
              >
                {summarySource === 'ai_generated' ? 'AI Generated' : 'Manually Created'}
              </span>
            )}
          </div>
          <button
            onClick={fetchSummary}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {summary
            ? 'Review and manage design implications from the meeting'
            : 'No design implications yet - start by adding one manually'}
        </p>
      </div>

      {/* Design Implications List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {summary && summary.points.length > 0 ? (
          summary.points.map((point) => (
            <DesignImplicationCard
              key={point.id}
              point={point}
              canEdit={!readOnly}
              onEdit={handleStartEdit}
              onDelete={handleDeletePoint}
              isEditing={editingPointId === point.id}
              editText={editText}
              editCategory={editCategory}
              onEditTextChange={setEditText}
              onEditCategoryChange={setEditCategory}
              onSaveEdit={() => handleSaveEdit(point.id)}
              onCancelEdit={handleCancelEdit}
              isSavingEdit={savingEdit}
              readOnly={readOnly}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-48">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">No implications yet</div>
              <p className="text-sm">No design implications yet</p>
              {!readOnly && (
                <p className="text-xs mt-1">Click "Add Design Implication" below to get started</p>
              )}
            </div>
          </div>
        )}

        {/* Add Implication Form */}
        {!readOnly && (
          <div className="mt-4">
            {!isAddingPoint ? (
              <button
                onClick={() => setIsAddingPoint(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <span className="text-xl">+</span>
                <span>Add Design Implication</span>
              </button>
            ) : (
              <div className="bg-white rounded-lg border-2 border-violet-400 p-4 shadow-md">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Implication</h3>

                {/* Category Selector */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Category
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(['decision', 'action', 'discussion', 'question'] as SummaryCategory[]).map(
                      (cat) => (
                        <button
                          key={cat}
                          onClick={() => setNewPointCategory(cat)}
                          className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                            newPointCategory === cat
                              ? CATEGORY_COLORS[cat]
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {CATEGORY_ICONS[cat]} {cat}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Text Input */}
                <textarea
                  value={newPointText}
                  onChange={(e) => setNewPointText(e.target.value)}
                  placeholder="Enter design implication..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm resize-none"
                  rows={3}
                  disabled={addingPoint}
                />

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddPoint}
                    disabled={!newPointText.trim() || addingPoint}
                    className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    {addingPoint ? 'Adding...' : 'Add Implication'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingPoint(false);
                      setNewPointText('');
                      setNewPointCategory('discussion');
                    }}
                    disabled={addingPoint}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {summary && (
        <div className="mt-4 pt-4 border-t border-gray-300">
          <div className="text-xs text-gray-500">
            {summary.llmModel ? `Generated with ${summary.llmModel}` : 'Manually created'} •{' '}
            {new Date(summary.generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

interface DesignImplicationCardProps {
  point: SummaryPointWithVotes;
  canEdit: boolean;
  onEdit: (point: SummaryPointWithVotes) => void;
  onDelete: (pointId: string) => void;
  isEditing: boolean;
  editText: string;
  editCategory: SummaryCategory;
  onEditTextChange: (text: string) => void;
  onEditCategoryChange: (category: SummaryCategory) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  isSavingEdit: boolean;
  readOnly?: boolean;
}

function DesignImplicationCard({
  point,
  canEdit,
  onEdit,
  onDelete,
  isEditing,
  editText,
  editCategory,
  onEditTextChange,
  onEditCategoryChange,
  onSaveEdit,
  onCancelEdit,
  isSavingEdit,
  readOnly = false,
}: DesignImplicationCardProps) {
  const isHostAdded = point.source === 'host';

  // Use lighter colors for host-added points
  const cardColors = isHostAdded ? HOST_CATEGORY_COLORS : CATEGORY_COLORS;
  const cardClassName = `bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow ${
    isHostAdded ? 'border-2' : 'border-gray-200'
  } ${isEditing ? 'border-violet-400 ring-2 ring-violet-200' : ''}`;

  return (
    <div className={cardClassName}>
      {/* Category Badge and Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm px-2 py-1 rounded border ${
              cardColors[point.category]
            } font-medium`}
          >
            {CATEGORY_ICONS[point.category]} {point.category}
          </span>
          {isHostAdded && (
            <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              User Added
            </span>
          )}
        </div>

        {/* Edit Controls */}
        {canEdit && !isEditing && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(point)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <span className="text-sm">Edit</span>
            </button>
            <button
              onClick={() => onDelete(point.id)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <span className="text-sm">Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Point Text or Edit Mode */}
      {isEditing ? (
        <div className="mb-4">
          {/* Category Selector in Edit Mode */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
            <div className="flex gap-2 flex-wrap">
              {(['decision', 'action', 'discussion', 'question'] as SummaryCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => onEditCategoryChange(cat)}
                    disabled={isSavingEdit}
                    className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                      editCategory === cat
                        ? CATEGORY_COLORS[cat]
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {CATEGORY_ICONS[cat]} {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Text Input */}
          <textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm resize-none"
            rows={3}
            disabled={isSavingEdit}
          />

          {/* Edit Action Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={onSaveEdit}
              disabled={!editText.trim() || isSavingEdit}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {isSavingEdit ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onCancelEdit}
              disabled={isSavingEdit}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-800">{point.text}</p>
      )}
    </div>
  );
}
