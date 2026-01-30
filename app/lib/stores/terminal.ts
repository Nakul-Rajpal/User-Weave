import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';
import { coloredText } from '~/utils/terminal';

/**
 * Headless terminal for BoltShell initialization
 * Used when the UI terminal isn't available yet
 * Can forward output to a UI terminal when attached
 */
class HeadlessTerminal implements ITerminal {
  #outputBuffer: string[] = [];
  #onDataCallbacks: ((data: string) => void)[] = [];
  #uiTerminal: ITerminal | null = null;
  cols: number = 80;
  rows: number = 24;

  write(data: string): void {
    // Forward to UI terminal if attached
    if (this.#uiTerminal) {
      this.#uiTerminal.write(data);
    }
    // Also buffer output
    this.#outputBuffer.push(data);
    // Keep buffer manageable
    if (this.#outputBuffer.length > 1000) {
      this.#outputBuffer.shift();
    }
  }

  onData(callback: (data: string) => void): void {
    this.#onDataCallbacks.push(callback);
  }

  input(data: string): void {
    this.#onDataCallbacks.forEach((cb) => cb(data));
  }

  reset(): void {
    this.#outputBuffer = [];
  }

  getOutput(): string {
    return this.#outputBuffer.join('');
  }

  /**
   * Attach a UI terminal to receive output
   */
  attachUITerminal(terminal: ITerminal): void {
    this.#uiTerminal = terminal;
    // Write buffered output to the new terminal
    const bufferedOutput = this.#outputBuffer.join('');
    if (bufferedOutput) {
      terminal.write(bufferedOutput);
    }
    // Also forward input from UI terminal
    terminal.onData((data) => {
      this.input(data);
    });
  }
}

export class TerminalStore {
  #webcontainer: Promise<WebContainer>;
  #terminals: Array<{ terminal: ITerminal; process: WebContainerProcess }> = [];
  #boltTerminal = newBoltShellProcess();
  #headlessTerminal: HeadlessTerminal | null = null;
  #uiTerminal: ITerminal | null = null;
  #initialized = false;
  #initPromise: Promise<void> | null = null;

  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(true);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }

    // Initialize BoltShell with headless terminal immediately
    this.#initPromise = this.#initBoltShellWithHeadless();
  }

  async #initBoltShellWithHeadless() {
    if (this.#initialized) {
      return;
    }

    try {
      console.log('[TerminalStore] Initializing BoltShell with headless terminal...');
      this.#headlessTerminal = new HeadlessTerminal();
      const wc = await this.#webcontainer;
      await this.#boltTerminal.init(wc, this.#headlessTerminal);
      this.#initialized = true;
      console.log('[TerminalStore] BoltShell initialized successfully with headless terminal');
    } catch (error: any) {
      console.error('[TerminalStore] Failed to initialize BoltShell:', error);
    }
  }

  get boltTerminal() {
    return this.#boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }

  async attachBoltTerminal(terminal: ITerminal) {
    this.#uiTerminal = terminal;

    // Wait for headless initialization to complete first
    if (this.#initPromise) {
      await this.#initPromise;
    }

    // If already initialized with headless, attach the UI terminal to receive output
    if (this.#initialized && this.#headlessTerminal) {
      console.log('[TerminalStore] BoltShell already initialized, attaching UI terminal for display');
      this.#headlessTerminal.attachUITerminal(terminal);
      return;
    }

    // Fallback: initialize with UI terminal if headless init failed
    try {
      console.log('[TerminalStore] Initializing BoltShell with UI terminal...');
      const wc = await this.#webcontainer;
      await this.#boltTerminal.init(wc, terminal);
      this.#initialized = true;
      console.log('[TerminalStore] BoltShell initialized successfully with UI terminal');
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn bolt shell\n\n') + error.message);
      return;
    }
  }

  async attachTerminal(terminal: ITerminal) {
    try {
      const shellProcess = await newShellProcess(await this.#webcontainer, terminal);
      this.#terminals.push({ terminal, process: shellProcess });
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);
      return;
    }
  }

  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.#terminals) {
      process.resize({ cols, rows });
    }
  }

  async detachTerminal(terminal: ITerminal) {
    const terminalIndex = this.#terminals.findIndex((t) => t.terminal === terminal);

    if (terminalIndex !== -1) {
      const { process } = this.#terminals[terminalIndex];

      try {
        process.kill();
      } catch (error) {
        console.warn('Failed to kill terminal process:', error);
      }
      this.#terminals.splice(terminalIndex, 1);
    }
  }
}
