import { webcontainer } from '~/lib/webcontainer';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs';
import { detectProjectCommands } from './projectCommands';
import { generateId } from './fileUtils';
import type { WebContainer } from '@webcontainer/api';

/**
 * Check if dependencies need to be installed by comparing package.json
 * between the new version and the current WebContainer state
 */
async function shouldInstallDependencies(
  newFiles: any,
  container: WebContainer
): Promise<boolean> {
  try {
    // Find package.json in new files
    const newPackageJsonPath = Object.keys(newFiles).find(
      path => path.endsWith('/package.json') || path === 'package.json' || path.endsWith('/project/package.json')
    );

    if (!newPackageJsonPath) {
      console.log('[FINAL VERSION] No package.json found, skipping dependency check');
      return false; // No package.json, no install needed
    }

    const newPackageJson = newFiles[newPackageJsonPath].content;

    // Check if node_modules exists in WebContainer
    // Use relative path - WebContainer's working directory is already /home/project
    try {
      const modules = await container.fs.readdir('node_modules');
      console.log('[FINAL VERSION] node_modules directory exists');
      console.log('🔍 [DEBUG-DEPS] node_modules found with', modules.length, 'entries');
    } catch {
      console.log('[FINAL VERSION] node_modules not found, install needed');
      console.log('🔍 [DEBUG-DEPS] node_modules does not exist, install required');
      return true;
    }

    // Read current package.json from WebContainer
    // Use relative path for consistency with other file operations
    try {
      const currentPackageJson = await container.fs.readFile(
        'package.json',
        'utf-8'
      );

      const newPkg = JSON.parse(newPackageJson);
      const currentPkg = JSON.parse(currentPackageJson);

      // Compare dependencies and devDependencies
      const newDepsStr = JSON.stringify({
        deps: newPkg.dependencies || {},
        devDeps: newPkg.devDependencies || {}
      });

      const currentDepsStr = JSON.stringify({
        deps: currentPkg.dependencies || {},
        devDeps: currentPkg.devDependencies || {}
      });

      const needsInstall = newDepsStr !== currentDepsStr;

      if (needsInstall) {
        console.log('[FINAL VERSION] Dependencies changed, install needed');
      } else {
        console.log('[FINAL VERSION] Dependencies unchanged, skipping install');
      }

      return needsInstall;
    } catch (error) {
      console.log('[FINAL VERSION] Error reading current package.json, will install:', error);
      return true;
    }
  } catch (error) {
    console.error('[FINAL VERSION] Error in dependency check:', error);
    return true; // On error, safer to install
  }
}

/**
 * Clean up WebContainer filesystem by removing old project files
 * Keeps node_modules for performance
 */
async function cleanupWebContainerFiles(container: WebContainer, keepNodeModules: boolean = true): Promise<void> {
  console.log('🧹 [CLEANUP] Starting WebContainer cleanup...');

  try {
    // Get all files/folders in root
    const entries = await container.fs.readdir('.', { withFileTypes: true });
    console.log('🧹 [CLEANUP] Found entries in container:', entries.map(e => e.name));

    const filesToRemove: string[] = [];

    // Determine what to remove
    for (const entry of entries) {
      // Skip WebContainer system files
      if (entry.name === '.webcontainer') {
        console.log('🧹 [CLEANUP] Skipping system file:', entry.name);
        continue;
      }

      // Optionally keep node_modules
      if (keepNodeModules && entry.name === 'node_modules') {
        console.log('🧹 [CLEANUP] Keeping node_modules for performance');
        continue;
      }

      filesToRemove.push(entry.name);
    }

    console.log('🧹 [CLEANUP] Files/folders to remove:', filesToRemove.length);

    // Remove all marked files/folders
    for (const name of filesToRemove) {
      try {
        await container.fs.rm(name, { recursive: true, force: true });
        console.log('🧹 [CLEANUP] Removed:', name);
      } catch (e) {
        console.warn(`⚠️ [CLEANUP] Could not remove ${name}:`, e);
      }
    }

    console.log('✅ [CLEANUP] Cleanup complete');

    // Verify cleanup
    const afterCleanup = await container.fs.readdir('.', { withFileTypes: true });
    console.log('✅ [CLEANUP] Remaining files:', afterCleanup.map(e => e.name));
  } catch (error) {
    console.error('❌ [CLEANUP] Cleanup failed:', error);
    // Don't throw - continue with loading even if cleanup fails
  }
}

/**
 * Load final version files into the workbench and start the dev server
 * Reuses the logic from VersionSelector component
 */
export async function loadFinalVersionFiles(files: any, onProgress?: (message: string) => void): Promise<void> {
  try {
    console.log('🔍 [DEBUG-LOAD] ========== STARTING LOAD ==========');
    console.log('🔍 [DEBUG-LOAD] Files to load:', Object.keys(files).length);
    console.log('🔍 [DEBUG-LOAD] First 5 files:', Object.keys(files).slice(0, 5));

    const container = await webcontainer;
    console.log('🔍 [DEBUG-LOAD] WebContainer workdir:', container.workdir);

    if (!files) {
      console.warn('[FINAL VERSION] No files to load');
      return;
    }

    // Check existing state
    try {
      const existingFiles = await container.fs.readdir('.', { withFileTypes: true });
      console.log('🔍 [DEBUG-LOAD] Existing files in container:', existingFiles.map(f => f.name));
    } catch (e) {
      console.log('🔍 [DEBUG-LOAD] Could not read existing files:', e);
    }

    // CRITICAL: Clean up WebContainer before loading new files
    onProgress?.('Cleaning workspace...');
    console.log('🔍 [DEBUG-LOAD] Calling cleanup to remove old files...');
    await cleanupWebContainerFiles(container, true);

    // Clear workbench state to ensure fresh start
    console.log('🔍 [DEBUG-LOAD] Clearing workbench state...');
    workbenchStore.files.set({});
    console.log('🔍 [DEBUG-LOAD] Workbench state cleared');

    onProgress?.('Loading files into workspace...');

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
        console.warn('[FINAL VERSION] Failed to create directory:', dir, error);
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
          console.warn('[FINAL VERSION] Failed to write file:', filePath, error);
        }
      }
    }

    // Update workbench to show the files - this automatically selects the first file
    workbenchStore.setDocuments(files);
    workbenchStore.setShowWorkbench(true);

    // Make sure terminal is visible to see command output
    workbenchStore.toggleTerminal(true);

    console.log('✅ [FINAL VERSION] Files loaded successfully');
    console.log('🔍 [DEBUG-LOAD] Workbench files count:', Object.keys(workbenchStore.files.get()).length);
    console.log('🔍 [DEBUG-LOAD] Workbench visible:', workbenchStore.showWorkbench.get());
    console.log('🔍 [DEBUG-LOAD] Terminal visible:', workbenchStore.showTerminal.get());

    // Detect and run project commands
    onProgress?.('Detecting project type...');

    // Convert files to FileContent format for detectProjectCommands
    const fileContents = Object.entries(files)
      .filter(([_, value]) => (value as any)?.type === 'file')
      .map(([path, value]) => {
        let cleanPath = path;
        if (cleanPath.startsWith(container.workdir)) {
          cleanPath = cleanPath.replace(container.workdir, '');
        }
        // Remove leading slash
        cleanPath = cleanPath.replace(/^\/+/, '');

        return {
          path: cleanPath,
          content: (value as any).content || ''
        };
      });

    const commands = await detectProjectCommands(fileContents);
    console.log('[FINAL VERSION] Detected commands:', commands);
    console.log('🔍 [DEBUG-LOAD] Commands detected:', {
      type: commands.type,
      hasSetup: !!commands.setupCommand,
      hasStart: !!commands.startCommand,
      setupCmd: commands.setupCommand,
      startCmd: commands.startCommand
    });

    // Get the bolt terminal to run commands
    const shell = workbenchStore.boltTerminal;
    console.log('🔍 [DEBUG-LOAD] Waiting for shell to be ready...');
    await shell.ready();
    console.log('🔍 [DEBUG-LOAD] Shell is ready');
    console.log('🔍 [DEBUG-LOAD] Shell execution state:', shell.executionState);

    const runnerId = generateId();
    console.log('🔍 [DEBUG-LOAD] Runner ID:', runnerId);

    // Run setup command (npm install)
    // For final versions, use a simpler install command to avoid issues
    // BUT first check if dependencies actually changed to avoid unnecessary reinstalls
    if (commands.setupCommand || commands.type === 'Node.js') {
      console.log('🔍 [DEBUG-LOAD] Checking if dependencies need to be installed...');

      // Check if installation is actually needed by comparing dependencies
      const needsInstall = await shouldInstallDependencies(files, container);
      console.log('🔍 [DEBUG-LOAD] Dependency check result:', needsInstall);
      console.log('🔍 [DEBUG-LOAD] Has package.json:', Object.keys(files).some(k => k.includes('package.json')));

      if (needsInstall) {
        onProgress?.('Installing dependencies...');

        // Use simple npm install instead of the complex non-interactive version
        const simpleInstallCommand = 'npm install';
        console.log('[FINAL VERSION] Running setup command:', simpleInstallCommand);
        console.log('🔍 [DEBUG-LOAD] About to execute npm install...');

        try {
          const setupResult = await shell.executeCommand(runnerId, simpleInstallCommand);
          console.log('🔍 [DEBUG-LOAD] Setup command completed, result:', setupResult);

          if (setupResult && setupResult.exitCode === 0) {
            console.log('✅ [FINAL VERSION] Setup completed successfully');
          } else if (setupResult) {
            console.warn(`⚠️ [FINAL VERSION] Setup completed with exit code ${setupResult.exitCode}`);
            console.warn('Setup output:', setupResult.output);
          } else {
            console.warn('⚠️ [FINAL VERSION] Setup command returned undefined result');
          }
        } catch (error) {
          console.error('❌ [FINAL VERSION] Setup failed:', error);
          logStore.logError('Setup command failed', error);
          // Don't throw - try to continue with start command
        }
      } else {
        console.log('[FINAL VERSION] Dependencies already installed, skipping npm install');
        console.log('🔍 [DEBUG-LOAD] Skipping npm install (dependencies unchanged)');
        onProgress?.('Dependencies already installed, loading files...');
      }
    }

    // Run start command (npm run dev)
    if (commands.startCommand) {
      onProgress?.('Starting dev server...');
      console.log('[FINAL VERSION] Running start command:', commands.startCommand);
      console.log('🔍 [DEBUG-LOAD] ========== STARTING DEV SERVER ==========');
      console.log('🔍 [DEBUG-LOAD] Current shell execution state:', shell.executionState);
      console.log('🔍 [DEBUG-LOAD] Shell terminal exists:', !!shell.terminal);
      console.log('🔍 [DEBUG-LOAD] Shell process exists:', !!shell.process);

      try {
        // CRITICAL: Terminate any existing processes before starting new dev server
        console.log('🔍 [DEBUG-LOAD] Attempting to terminate existing processes...');
        if (shell.terminal) {
          shell.terminal.input('\x03'); // Send Ctrl+C
          console.log('🔍 [DEBUG-LOAD] Sent Ctrl+C to terminal');
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for termination
          console.log('🔍 [DEBUG-LOAD] Waited 500ms for process termination');
        }

        console.log('🔍 [DEBUG-LOAD] About to execute start command...');
        console.log('🔍 [DEBUG-LOAD] Runner ID:', runnerId);
        console.log('🔍 [DEBUG-LOAD] Start command:', commands.startCommand);

        // Run start command in background (it runs indefinitely)
        // Note: We don't await the result because dev servers run continuously
        const startPromise = shell.executeCommand(runnerId, commands.startCommand);
        console.log('🔍 [DEBUG-LOAD] executeCommand called, promise created:', !!startPromise);
        console.log('✅ [FINAL VERSION] Dev server command issued');

        // Give it a moment to start
        console.log('🔍 [DEBUG-LOAD] Waiting 1000ms for dev server to start...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('🔍 [DEBUG-LOAD] Wait complete, checking shell state...');
        console.log('🔍 [DEBUG-LOAD] Shell execution state after start:', shell.executionState);
      } catch (error) {
        console.error('❌ [FINAL VERSION] Failed to start dev server:', error);
        console.error('🔍 [DEBUG-LOAD] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        logStore.logError('Start command failed', error);
        throw error;
      }
    } else {
      console.log('🔍 [DEBUG-LOAD] No start command detected, skipping dev server');
    }

    onProgress?.('Workspace ready!');
    console.log('🔍 [DEBUG-LOAD] ========== LOAD COMPLETE ==========');
    console.log('🔍 [DEBUG-LOAD] Final workbench state:', {
      filesCount: Object.keys(workbenchStore.files.get()).length,
      showWorkbench: workbenchStore.showWorkbench.get(),
      showTerminal: workbenchStore.showTerminal.get()
    });
  } catch (error) {
    console.error('❌ [FINAL VERSION] Failed to load files:', error);
    console.error('🔍 [DEBUG-LOAD] ========== LOAD FAILED ==========');
    console.error('🔍 [DEBUG-LOAD] Error details:', error);
    logStore.logError('Final version loading failed', error);
    throw error;
  }
}

/**
 * Clear the workbench (useful when switching between versions)
 */
export async function clearWorkbench(): Promise<void> {
  try {
    workbenchStore.setShowWorkbench(false);
    workbenchStore.files.set({});
    console.log('✅ [FINAL VERSION] Workbench cleared');
  } catch (error) {
    console.error('❌ [FINAL VERSION] Failed to clear workbench:', error);
  }
}
