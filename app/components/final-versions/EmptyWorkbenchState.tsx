import { memo } from 'react';

export const EmptyWorkbenchState = memo(() => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-bolt-elements-background-depth-1 text-center px-8">
      <div className="i-ph:code-simple text-8xl text-bolt-elements-textTertiary mb-6 opacity-50" />
      <h2 className="text-2xl font-semibold text-bolt-elements-textPrimary mb-3">
        Select a Version to View
      </h2>
      <p className="text-bolt-elements-textSecondary max-w-md mb-6">
        Click on any user's final version from the list to view their code in the workspace.
      </p>
      <div className="flex flex-col gap-3 text-sm text-bolt-elements-textSecondary">
        <div className="flex items-center gap-2">
          <div className="i-ph:file-code text-lg" />
          <span>Browse code files and folder structure</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="i-ph:monitor text-lg" />
          <span>View live preview of the application</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="i-ph:terminal-window text-lg" />
          <span>See terminal output</span>
        </div>
      </div>
    </div>
  );
});
