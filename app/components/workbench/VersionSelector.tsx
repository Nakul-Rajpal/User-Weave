import { useStore } from '@nanostores/react';
import { memo, useState, useEffect } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { getVersionById, isSnapshotFinalVersion, setFinalVersion } from '~/lib/persistence/supabase';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import { webcontainer } from '~/lib/webcontainer';
import { chatId } from '~/lib/persistence/useChatHistory';

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

async function restoreVersionFiles(files: any) {
  try {
    const container = await webcontainer;

    if (!files) {
      return;
    }

    // Create directories first
    const directories = new Set<string>();
    Object.entries(files).forEach(([key, value]: [string, any]) => {
      let filePath = key;
      if (filePath.startsWith(container.workdir)) {
        filePath = filePath.replace(container.workdir, '');
      }

      if (value?.type === 'folder') {
        directories.add(filePath);
      } else if (value?.type === 'file') {
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        if (dir) directories.add(dir);
      }
    });

    // Create all directories
    for (const dir of directories) {
      try {
        await container.fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn('Failed to create directory during version restore:', dir, error);
      }
    }

    // Then write files
    for (const [key, value] of Object.entries(files)) {
      if ((value as any)?.type === 'file') {
        let filePath = key;
        if (filePath.startsWith(container.workdir)) {
          filePath = filePath.replace(container.workdir, '');
        }

        try {
          await container.fs.writeFile(filePath, (value as any).content, {
            encoding: (value as any).isBinary ? undefined : 'utf8'
          });
        } catch (error) {
          console.warn('Failed to write file during version restore:', filePath, error);
        }
      }
    }

    console.log('✅ [VERSION] Files restored successfully');
  } catch (error) {
    console.error('❌ [VERSION] Failed to restore version files:', error);
    logStore.logError('Version restoration failed', error);
    throw error;
  }
}

export const VersionSelector = memo(() => {
  const versions = useStore(workbenchStore.versions);
  const currentVersion = useStore(workbenchStore.currentVersion);
  const isViewingOldVersion = useStore(workbenchStore.isViewingOldVersion);
  const currentChatId = useStore(chatId);
  const [finalVersionId, setFinalVersionId] = useState<string | null>(null);
  const [isSettingFinal, setIsSettingFinal] = useState(false);

  // Check if current version is marked as final
  useEffect(() => {
    const checkFinalVersion = async () => {
      if (currentVersion) {
        const isFinal = await isSnapshotFinalVersion(currentVersion);
        if (isFinal) {
          setFinalVersionId(currentVersion);
        }
      }
    };
    checkFinalVersion();
  }, [currentVersion]);

  if (versions.length === 0) {
    return null; // Don't show dropdown if no versions
  }

  const handleVersionChange = async (versionId: string) => {
    if (versionId === currentVersion) {
      return; // Already on this version
    }

    try {
      console.log('📦 [VERSION] Switching to version:', versionId);

      // Get version snapshot data
      const versionData = await getVersionById(versionId);

      if (!versionData) {
        toast.error('Failed to load version data');
        return;
      }

      // Restore files to webcontainer
      await restoreVersionFiles(versionData.files);

      // Update current version
      workbenchStore.currentVersion.set(versionId);

      const version = versions.find(v => v.id === versionId);
      if (version) {
        toast.success(`Switched to Version ${version.versionNumber}`, {
          icon: <div className="i-ph:git-branch text-accent-500" />,
        });
      }

      // Check if this version is the final version
      const isFinal = await isSnapshotFinalVersion(versionId);
      if (isFinal) {
        setFinalVersionId(versionId);
      }
    } catch (error) {
      console.error('❌ [VERSION] Failed to switch version:', error);
      toast.error('Failed to switch version');
    }
  };

  const handleSetAsFinal = async () => {
    if (!currentVersion || !currentChatId) {
      toast.error('No version or chat selected');
      return;
    }

    setIsSettingFinal(true);
    try {
      await setFinalVersion(currentVersion, currentChatId);
      setFinalVersionId(currentVersion);
      toast.success('Version marked as final! 🎉', {
        icon: <div className="i-ph:star-fill text-yellow-500" />,
      });
    } catch (error: any) {
      console.error('❌ [VERSION] Failed to set final version:', error);
      toast.error(error.message || 'Failed to set final version');
    } finally {
      setIsSettingFinal(false);
    }
  };

  const isFinalVersion = currentVersion === finalVersionId;

  return (
    <div className="flex items-center gap-2 mr-2">
      {isViewingOldVersion && (
        <div className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
          <div className="i-ph:warning-circle" />
          <span>Viewing old version</span>
        </div>
      )}

      {isFinalVersion && (
        <div className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-500/10 text-green-500 border border-green-500/30">
          <div className="i-ph:star-fill" />
          <span>Final Version</span>
        </div>
      )}

      <select
        value={currentVersion || ''}
        onChange={(e) => handleVersionChange(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-colors text-bolt-elements-item-contentDefault border border-bolt-elements-borderColor cursor-pointer"
      >
        {versions.map((version) => {
          const isLatest = version.id === versions[0].id;
          const isFinal = version.id === finalVersionId;
          return (
            <option key={version.id} value={version.id}>
              {isFinal && '⭐ '}
              Version {version.versionNumber}
              {isLatest && ' (Latest)'}
              {isFinal && ' (Final)'}
              {' - '}
              {formatTimestamp(version.timestamp)}
            </option>
          );
        })}
      </select>

      <button
        onClick={handleSetAsFinal}
        disabled={isFinalVersion || isSettingFinal}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors
          ${isFinalVersion
            ? 'bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary cursor-not-allowed'
            : 'bg-bolt-elements-button-primary-bg text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-bg-hover cursor-pointer'
          }
        `}
        title={isFinalVersion ? 'This version is already marked as final' : 'Mark this version as your final submission'}
      >
        <div className={isFinalVersion ? 'i-ph:star-fill' : 'i-ph:star'} />
        <span>{isSettingFinal ? 'Setting...' : isFinalVersion ? 'Final' : 'Set as Final'}</span>
      </button>
    </div>
  );
});
