import { memo, useState, useMemo } from 'react';
import type { FinalVersionWithDetails } from '~/lib/persistence/supabase';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

interface FinalVersionsListProps {
  finalVersions: FinalVersionWithDetails[];
  onSelectVersion: (version: FinalVersionWithDetails) => void;
  selectedVersionId?: string | null;
}

export const FinalVersionsList = memo(({ finalVersions, onSelectVersion, selectedVersionId }: FinalVersionsListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredVersions = useMemo(() => {
    if (!searchQuery) return finalVersions;

    const query = searchQuery.toLowerCase();
    return finalVersions.filter(
      (v) =>
        v.userName.toLowerCase().includes(query) ||
        v.chatTitle.toLowerCase().includes(query) ||
        v.notes?.toLowerCase().includes(query)
    );
  }, [finalVersions, searchQuery]);

  const handleDownloadCode = (version: FinalVersionWithDetails, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when downloading
    try {
      const filesJson = JSON.stringify(version.files, null, 2);
      const blob = new Blob([filesJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${version.userName}-final-version.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Code downloaded successfully');
    } catch (error) {
      toast.error('Failed to download code');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (finalVersions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <div className="i-ph:users text-6xl text-bolt-elements-textTertiary mb-4" />
        <h2 className="text-2xl font-semibold text-bolt-elements-textPrimary mb-2">
          No Final Versions Yet
        </h2>
        <p className="text-bolt-elements-textSecondary max-w-md">
          When users mark their versions as final, they will appear here for review and merging.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and view toggle */}
      <div className="flex flex-col gap-3 p-4 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
            <div className="i-ph:star-fill text-yellow-500" />
            <span>Final Versions ({filteredVersions.length})</span>
          </h1>
        </div>

        <div className="flex flex-col gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by user or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-9 text-sm rounded-lg bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
            />
            <div className="i-ph:magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-bolt-elements-textTertiary" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-center gap-1 bg-bolt-elements-background-depth-3 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-bolt-elements-button-primary-bg text-bolt-elements-button-primary-text'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
              }`}
              title="Grid view"
            >
              <div className="i-ph:squares-four text-lg mx-auto" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-bolt-elements-button-primary-bg text-bolt-elements-button-primary-text'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
              }`}
              title="List view"
            >
              <div className="i-ph:list text-lg mx-auto" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-3">
            {filteredVersions.map((version) => {
              const isSelected = selectedVersionId === version.id;
              return (
                <div
                  key={version.id}
                  onClick={() => onSelectVersion(version)}
                  className={classNames(
                    "rounded-lg border p-4 transition-all cursor-pointer",
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                      : "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive hover:shadow-md"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="i-ph:user-circle text-2xl text-bolt-elements-textSecondary" />
                      <div>
                        <h3 className="font-semibold text-bolt-elements-textPrimary">
                          {version.userName}
                        </h3>
                        <p className="text-xs text-bolt-elements-textTertiary">{version.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <div className="i-ph:check-circle-fill text-blue-500 text-xl" />
                      )}
                      <div className="i-ph:star-fill text-yellow-500" />
                    </div>
                  </div>

                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-bolt-elements-textSecondary mb-1">
                      Project
                    </h4>
                    <p className="text-sm text-bolt-elements-textPrimary">{version.chatTitle}</p>
                  </div>

                  {version.notes && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-bolt-elements-textSecondary mb-1">
                        Notes
                      </h4>
                      <p className="text-xs text-bolt-elements-textPrimary line-clamp-2">
                        {version.notes}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-bolt-elements-textTertiary mb-3">
                    Selected {formatDate(version.selectedAt)}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1.5 text-xs text-bolt-elements-textSecondary">
                      <div className="i-ph:eye" />
                      <span>{isSelected ? 'Viewing in workspace' : 'Click to view'}</span>
                    </div>
                    <button
                      onClick={(e) => handleDownloadCode(version, e)}
                      className="px-3 py-2 text-sm rounded-lg bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-4 transition-colors"
                      title="Download code"
                    >
                      <div className="i-ph:download-simple" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVersions.map((version) => {
              const isSelected = selectedVersionId === version.id;
              return (
                <div
                  key={version.id}
                  onClick={() => onSelectVersion(version)}
                  className={classNames(
                    "rounded-lg border p-4 transition-all cursor-pointer",
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                      : "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <div className="i-ph:check-circle-fill text-blue-500 text-xl" />
                        )}
                        <div className="i-ph:star-fill text-yellow-500 text-xl" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-bolt-elements-textPrimary">
                            {version.userName}
                          </h3>
                          <span className="text-sm text-bolt-elements-textSecondary">
                            {version.chatTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-bolt-elements-textTertiary">
                          <span>Selected {formatDate(version.selectedAt)}</span>
                          {version.notes && (
                            <>
                              <span>•</span>
                              <span className="line-clamp-1">{version.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-bolt-elements-textSecondary flex items-center gap-1.5">
                        <div className="i-ph:eye" />
                        <span>{isSelected ? 'Viewing' : 'Click to view'}</span>
                      </div>
                      <button
                        onClick={(e) => handleDownloadCode(version, e)}
                        className="px-3 py-2 text-sm rounded-lg bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-4 transition-colors"
                        title="Download code"
                      >
                        <div className="i-ph:download-simple" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
