import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';
import { withResolvers } from './promises';

export async function newShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
  const args: string[] = [];

  // we spawn a JSH process with a fallback cols and rows in case the process is not attached yet to a visible terminal
  const process = await webcontainer.spawn('/bin/jsh', ['--osc', ...args], {
    terminal: {
      cols: terminal.cols ?? 80,
      rows: terminal.rows ?? 15,
    },
  });

  const input = process.input.getWriter();
  const output = process.output;

  const jshReady = withResolvers<void>();

  let isInteractive = false;
  output.pipeTo(
    new WritableStream({
      write(data) {
        if (!isInteractive) {
          const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

          if (osc === 'interactive') {
            // wait until we see the interactive OSC
            isInteractive = true;

            jshReady.resolve();
          }
        }

        terminal.write(data);

        // Capture terminal output for debugging
        // Debug logging removed
      },
    }),
  );

  terminal.onData((data) => {
    // console.log('terminal onData', { data, isInteractive });

    if (isInteractive) {
      input.write(data);

      // Capture terminal input for debugging
      // Debug logging removed
    }
  });

  await jshReady.promise;

  return process;
}

export type ExecutionResult = { output: string; exitCode: number } | undefined;

export class BoltShell {
  #initialized: (() => void) | undefined;
  #readyPromise: Promise<void>;
  #webcontainer: WebContainer | undefined;
  #terminal: ITerminal | undefined;
  #process: WebContainerProcess | undefined;
  executionState: { sessionId: string; active: boolean; executionPrms?: Promise<any>; abort?: () => void } | undefined;
  #outputStream: ReadableStreamDefaultReader<string> | undefined;
  #shellInputStream: WritableStreamDefaultWriter<string> | undefined;

  constructor() {
    this.#readyPromise = new Promise((resolve) => {
      this.#initialized = resolve;
    });
  }

  ready() {
    return this.#readyPromise;
  }

  async init(webcontainer: WebContainer, terminal: ITerminal) {
    this.#webcontainer = webcontainer;
    this.#terminal = terminal;

    // Use streams from tee: one for terminal, one for command execution
    const { process, commandStream } = await this.newBoltShellProcess(webcontainer, terminal);
    this.#process = process;
    this.#outputStream = commandStream.getReader();

    await this.waitTillOscCode('interactive');
    this.#initialized?.();
  }

  async newBoltShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
    const args: string[] = [];
    const process = await webcontainer.spawn('/bin/jsh', ['--osc', ...args], {
      terminal: {
        cols: terminal.cols ?? 80,
        rows: terminal.rows ?? 15,
      },
    });

    const input = process.input.getWriter();
    this.#shellInputStream = input;

    // Tee the output so we can have three independent readers
    const [streamA, streamB] = process.output.tee();
    const [streamC, streamD] = streamB.tee();

    const jshReady = withResolvers<void>();
    let isInteractive = false;
    streamA.pipeTo(
      new WritableStream({
        write(data) {
          if (!isInteractive) {
            const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

            if (osc === 'interactive') {
              isInteractive = true;
              jshReady.resolve();
            }
          }

          terminal.write(data);
        },
      }),
    );

    terminal.onData((data) => {
      if (isInteractive) {
        input.write(data);
      }
    });

    await jshReady.promise;

    // Return all streams for use in init
    return { process, terminalStream: streamA, commandStream: streamC };
  }

  get terminal() {
    return this.#terminal;
  }

  get process() {
    return this.#process;
  }

  async executeCommand(sessionId: string, command: string, abort?: () => void): Promise<ExecutionResult> {
    console.log('🔍 [DEBUG-SHELL] ========== EXECUTE COMMAND ==========');
    console.log('🔍 [DEBUG-SHELL] Session ID:', sessionId);
    console.log('🔍 [DEBUG-SHELL] Command:', command);
    console.log('🔍 [DEBUG-SHELL] Has process:', !!this.process);
    console.log('🔍 [DEBUG-SHELL] Has terminal:', !!this.terminal);
    console.log('🔍 [DEBUG-SHELL] Current execution state:', this.executionState);

    if (!this.process || !this.terminal) {
      console.error('🔍 [DEBUG-SHELL] Cannot execute - missing process or terminal');
      return undefined;
    }

    const state = this.executionState;

    if (state?.active && state.abort) {
      console.log('🔍 [DEBUG-SHELL] Aborting previous active execution');
      state.abort();
    }

    /*
     * interrupt the current execution
     *  this.#shellInputStream?.write('\x03');
     */
    console.log('🔍 [DEBUG-SHELL] Sending Ctrl+C to interrupt current execution');
    this.terminal.input('\x03');
    console.log('🔍 [DEBUG-SHELL] Waiting for prompt...');
    await this.waitTillOscCode('prompt');
    console.log('🔍 [DEBUG-SHELL] Prompt received');

    if (state && state.executionPrms) {
      console.log('🔍 [DEBUG-SHELL] Waiting for previous execution promise to complete');
      await state.executionPrms;
      console.log('🔍 [DEBUG-SHELL] Previous execution promise completed');
    }

    //start a new execution
    console.log('🔍 [DEBUG-SHELL] Sending command to terminal:', command.trim());
    this.terminal.input(command.trim() + '\n');
    console.log('🔍 [DEBUG-SHELL] Command sent to terminal');

    //wait for the execution to finish
    console.log('🔍 [DEBUG-SHELL] Creating execution promise to wait for result...');
    const executionPromise = this.getCurrentExecutionResult();
    this.executionState = { sessionId, active: true, executionPrms: executionPromise, abort };
    console.log('🔍 [DEBUG-SHELL] Execution state set to active');

    console.log('🔍 [DEBUG-SHELL] Waiting for command execution to complete...');
    const resp = await executionPromise;
    console.log('🔍 [DEBUG-SHELL] Command execution completed');
    console.log('🔍 [DEBUG-SHELL] Exit code:', resp?.exitCode);
    console.log('🔍 [DEBUG-SHELL] Output length:', resp?.output?.length || 0);

    this.executionState = { sessionId, active: false };
    console.log('🔍 [DEBUG-SHELL] Execution state set to inactive');

    if (resp) {
      try {
        resp.output = cleanTerminalOutput(resp.output);
        console.log('🔍 [DEBUG-SHELL] Terminal output cleaned');
      } catch (error) {
        console.log('failed to format terminal output', error);
        console.error('🔍 [DEBUG-SHELL] Failed to clean terminal output:', error);
      }
    }

    console.log('🔍 [DEBUG-SHELL] Returning result:', { exitCode: resp?.exitCode, hasOutput: !!resp?.output });
    return resp;
  }

  async getCurrentExecutionResult(): Promise<ExecutionResult> {
    const { output, exitCode } = await this.waitTillOscCode('exit');
    return { output, exitCode };
  }

  onQRCodeDetected?: (qrCode: string) => void;

  async waitTillOscCode(waitCode: string) {
    let fullOutput = '';
    let exitCode: number = 0;

    if (!this.#outputStream) {
      return { output: fullOutput, exitCode };
    }

    const tappedStream = this.#outputStream;

    while (true) {
      const { value, done } = await tappedStream.read();

      if (done) {
        break;
      }

      const text = value || '';
      fullOutput += text;

      // Check if command completion signal with exit code
      const [, osc, , , code] = text.match(/\x1b\]654;([^\x07=]+)=?((-?\d+):(\d+))?\x07/) || [];

      if (osc === 'exit') {
        exitCode = parseInt(code, 10);
      }

      if (osc === waitCode) {
        break;
      }
    }

    return { output: fullOutput, exitCode };
  }
}

/**
 * Cleans and formats terminal output while preserving structure and paths
 * Handles ANSI, OSC, and various terminal control sequences
 */
export function cleanTerminalOutput(input: string): string {
  // Step 1: Remove OSC sequences (including those with parameters)
  const removeOsc = input
    .replace(/\x1b\](\d+;[^\x07\x1b]*|\d+[^\x07\x1b]*)\x07/g, '')
    .replace(/\](\d+;[^\n]*|\d+[^\n]*)/g, '');

  // Step 2: Remove ANSI escape sequences and color codes more thoroughly
  const removeAnsi = removeOsc
    // Remove all escape sequences with parameters
    .replace(/\u001b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    // Remove color codes
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    // Clean up any remaining escape characters
    .replace(/\u001b/g, '')
    .replace(/\x1b/g, '');

  // Step 3: Clean up carriage returns and newlines
  const cleanNewlines = removeAnsi
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Step 4: Add newlines at key breakpoints while preserving paths
  const formatOutput = cleanNewlines
    // Preserve prompt line
    .replace(/^([~\/][^\n❯]+)❯/m, '$1\n❯')
    // Add newline before command output indicators
    .replace(/(?<!^|\n)>/g, '\n>')
    // Add newline before error keywords without breaking paths
    .replace(/(?<!^|\n|\w)(error|failed|warning|Error|Failed|Warning):/g, '\n$1:')
    // Add newline before 'at' in stack traces without breaking paths
    .replace(/(?<!^|\n|\/)(at\s+(?!async|sync))/g, '\nat ')
    // Ensure 'at async' stays on same line
    .replace(/\bat\s+async/g, 'at async')
    // Add newline before npm error indicators
    .replace(/(?<!^|\n)(npm ERR!)/g, '\n$1');

  // Step 5: Clean up whitespace while preserving intentional spacing
  const cleanSpaces = formatOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  // Step 6: Final cleanup
  return cleanSpaces
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .replace(/:\s+/g, ': ') // Normalize spacing after colons
    .replace(/\s{2,}/g, ' ') // Remove multiple spaces
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/\u0000/g, ''); // Remove null characters
}

export function newBoltShellProcess() {
  return new BoltShell();
}
