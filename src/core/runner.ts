import { spawn, ChildProcess } from 'node:child_process';
import { CommandResult, RunOptions } from './types';

export class RunnerError extends Error {
  public readonly exitCode: number;
  public readonly stdout: string;
  public readonly stderr: string;
  public readonly timedOut: boolean;

  constructor(
    message: string,
    result: { exitCode: number; stdout: string; stderr: string; timedOut: boolean }
  ) {
    super(message);
    this.name = 'RunnerError';
    this.exitCode = result.exitCode;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.timedOut = result.timedOut;
  }
}

export class Runner {
  private activeChildren: Set<ChildProcess> = new Set();
  private signalHandlersRegistered = false;

  constructor() {
    this.registerSignalHandlers();
  }

  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) return;
    this.signalHandlersRegistered = true;

    const cleanup = (signal: NodeJS.Signals) => {
      this.killAll(signal);
    };

    process.once('SIGINT', () => cleanup('SIGINT'));
    process.once('SIGTERM', () => cleanup('SIGTERM'));
  }

  public killAll(signal: NodeJS.Signals = 'SIGTERM'): void {
    for (const child of this.activeChildren) {
      this.killProcess(child, signal);
    }
    this.activeChildren.clear();
  }

  private killProcess(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
    try {
      if (child.pid && process.platform !== 'win32') {
        // Kill the whole process group
        process.kill(-child.pid, signal);
      } else {
        child.kill(signal);
      }
    } catch {
      // Process already terminated or does not exist
    }
  }

  private validateArgs(args: string[]): void {
    if (!Array.isArray(args)) {
      throw new TypeError('Command arguments must be an array of strings');
    }
    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new TypeError(`Argument must be a string, got ${typeof arg}`);
      }
      if (arg.includes('\0')) {
        throw new Error('Command arguments must not contain NUL bytes');
      }
    }
  }

  public run(file: string, args: string[] = [], options: RunOptions = {}): Promise<CommandResult> {
    this.validateArgs(args);

    const cwd = options.cwd || process.cwd();
    const env = { ...process.env, ...(options.env || {}) };
    const timeoutMs = options.timeoutMs ?? 60_000;
    const maxBuffer = options.maxBuffer ?? 10 * 1024 * 1024; // 10MB default

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let timedOut = false;
      let timer: NodeJS.Timeout | null = null;
      let killTimer: NodeJS.Timeout | null = null;

      let child: ChildProcess;
      try {
        child = spawn(file, args, {
          cwd,
          env,
          shell: false,
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        return reject(err);
      }

      this.activeChildren.add(child);

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          this.killProcess(child, 'SIGTERM');
          // If still alive after 2 seconds, send SIGKILL
          killTimer = setTimeout(() => {
            this.killProcess(child, 'SIGKILL');
          }, 2000);
          killTimer.unref();
        }, timeoutMs);
        timer.unref();
      }

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        this.activeChildren.delete(child);
      };

      if (child.stdout) {
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          stdoutBuffer += chunk;
          if (stdoutBuffer.length > maxBuffer) {
            cleanup();
            this.killProcess(child, 'SIGKILL');
            reject(new Error(`stdout maxBuffer (${maxBuffer} bytes) exceeded for command: ${file}`));
          }
        });
      }

      if (child.stderr) {
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk: string) => {
          stderrBuffer += chunk;
          if (stderrBuffer.length > maxBuffer) {
            cleanup();
            this.killProcess(child, 'SIGKILL');
            reject(new Error(`stderr maxBuffer (${maxBuffer} bytes) exceeded for command: ${file}`));
          }
        });
      }

      child.on('error', (err: Error) => {
        cleanup();
        reject(err);
      });

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        const durationMs = Date.now() - startTime;
        let exitCode = code ?? (signal ? 128 + 15 : 1);
        if (timedOut) {
          exitCode = 124; // standard POSIX timeout exit code
        }

        resolve({
          exitCode,
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          durationMs,
          timedOut,
        });
      });
    });
  }

  public async capture(file: string, args: string[] = [], options: RunOptions = {}): Promise<string> {
    const res = await this.run(file, args, options);
    if (res.exitCode !== 0) {
      throw new RunnerError(
        `Command '${file} ${args.join(' ')}' exited with code ${res.exitCode}: ${res.stderr || res.stdout}`,
        res
      );
    }
    return res.stdout.trim();
  }
}

export const defaultRunner = new Runner();
